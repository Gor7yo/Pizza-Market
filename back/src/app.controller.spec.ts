import { Test, type TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let controller: AppController;
  const health = jest.fn();

  beforeEach(async () => {
    health.mockReset();
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: AppService, useValue: { health } }],
    }).compile();
    controller = app.get(AppController);
  });

  it('reports ok with 200', async () => {
    health.mockResolvedValue({
      status: 'ok',
      checks: { database: true, redis: true },
      uptimeSeconds: 1,
    });
    const res = { status: jest.fn() } as unknown as Response;
    await expect(controller.health(res)).resolves.toMatchObject({ status: 'ok' });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('answers 503 when a dependency is down', async () => {
    health.mockResolvedValue({
      status: 'degraded',
      checks: { database: false, redis: true },
      uptimeSeconds: 1,
    });
    const res = { status: jest.fn() } as unknown as Response;
    await controller.health(res);
    expect(res.status).toHaveBeenCalledWith(503);
  });
});
