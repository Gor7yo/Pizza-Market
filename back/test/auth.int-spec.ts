import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import type { RedisService } from '../src/infrastructure/redis/redis.service';
import { createTestApp, createVerifiedUser, resetState, waitFor } from './utils';

function cookieValue(setCookie: string[] | string | undefined, name: string): string | undefined {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const entry = list.find((c) => c.startsWith(`${name}=`));
  return entry?.split(';')[0]?.slice(name.length + 1);
}

describe('Auth (integration)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let redis: RedisService;

  beforeAll(async () => {
    ({ app, prisma, redis } = await createTestApp());
  });

  beforeEach(async () => {
    await resetState(prisma, redis);
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers, verifies the e-mail code and starts a session', async () => {
    const agent = request.agent(app.getHttpServer());
    const email = 'new.user@example.com';

    await agent
      .post('/api/v1/auth/register')
      .send({ email, password: 'Secret123', firstName: 'New' })
      .expect(201);

    // not usable before verification
    const login = await agent
      .post('/api/v1/auth/login')
      .send({ email, password: 'Secret123' })
      .expect(403);
    expect(login.body.error.code).toBe('EMAIL_NOT_VERIFIED');

    const mail = await waitFor(async () => {
      const res = await agent.get(`/api/v1/dev/emails?to=${email}`);
      return (res.body as { text: string }[])[0];
    });
    const code = /(\d{6})/.exec(mail.text)?.[1];
    expect(code).toBeDefined();

    await agent
      .post('/api/v1/auth/verify-email')
      .send({ email, code: '000000' === code ? '111111' : '000000' })
      .expect(400);
    const verified = await agent
      .post('/api/v1/auth/verify-email')
      .send({ email, code })
      .expect(200);
    expect(verified.body.user).toMatchObject({ email, emailVerified: true, role: 'USER' });
    expect(cookieValue(verified.headers['set-cookie'], 'access_token')).toBeDefined();

    const me = await agent.get('/api/v1/auth/me').expect(200);
    expect(me.body.email).toBe(email);

    // codes are single-use
    await agent.post('/api/v1/auth/verify-email').send({ email, code }).expect(400);
  });

  it('rejects unknown fields (mass assignment) and invalid input', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'x@example.com', password: 'Secret123', firstName: 'X', role: 'ADMIN' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('does not reveal whether an e-mail exists on forgot-password', async () => {
    await createVerifiedUser(prisma, 'known@example.com', 'Secret123');
    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'known@example.com' })
      .expect(204);
    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody@example.com' })
      .expect(204);
  });

  it('rotates refresh tokens and revokes the session when an old token is replayed', async () => {
    await createVerifiedUser(prisma, 'rotate@example.com', 'Secret123');
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'rotate@example.com', password: 'Secret123' })
      .expect(200);
    const first = cookieValue(login.headers['set-cookie'], 'refresh_token')!;

    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${first}`)
      .expect(200);
    const second = cookieValue(refreshed.headers['set-cookie'], 'refresh_token')!;
    expect(second).toBeDefined();
    expect(second).not.toBe(first);

    // move rotation outside the concurrency grace window
    await prisma.session.updateMany({ data: { rotatedAt: new Date(Date.now() - 60_000) } });

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${first}`)
      .expect(401);
    // the whole session is now revoked, including the newest token
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${second}`)
      .expect(401);
  });

  it('logout revokes the access token immediately', async () => {
    await createVerifiedUser(prisma, 'logout@example.com', 'Secret123');
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/auth/login')
      .send({ email: 'logout@example.com', password: 'Secret123' })
      .expect(200);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'logout@example.com', password: 'Secret123' });
    const access = cookieValue(login.headers['set-cookie'], 'access_token')!;

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', `access_token=${access}`)
      .expect(204);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', `access_token=${access}`)
      .expect(401);
    // other sessions are unaffected
    await agent.get('/api/v1/auth/me').expect(200);
  });

  it('rejects state-changing requests from foreign origins', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: 'a@b.cd', password: 'x' })
      .expect(403);
    expect(res.body.error.code).toBe('CSRF_REJECTED');
  });

  it('locks login after repeated failures', async () => {
    await createVerifiedUser(prisma, 'brute@example.com', 'Secret123');
    for (let i = 0; i < 10; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', `10.0.0.${i}`)
        .send({ email: 'brute@example.com', password: 'wrong-password1' });
    }
    // even the correct password is refused from a fresh IP: the lock is per account
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '10.0.1.1')
      .send({ email: 'brute@example.com', password: 'Secret123' });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('TOO_MANY_ATTEMPTS');
  });
});
