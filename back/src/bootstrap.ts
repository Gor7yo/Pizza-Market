import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppConfig } from './config/app-config.service';
import { ACCESS_COOKIE } from './modules/auth/auth.constants';

export const API_PREFIX = 'api/v1';

/** Shared by main.ts and integration tests so both run the exact same pipeline. */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(AppConfig);

  app.useLogger(app.get(Logger));
  app.set('trust proxy', config.get('TRUST_PROXY'));
  app.disable('x-powered-by');
  app.use(
    helmet({
      // JSON API: the strict default CSP is fine in production; Swagger UI needs it relaxed in dev.
      contentSecurityPolicy: config.swaggerEnabled ? false : undefined,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(cookieParser());
  app.setGlobalPrefix(API_PREFIX);
  app.enableCors({
    origin: config.get('WEB_ORIGIN'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Idempotency-Key', 'X-Request-Id'],
    maxAge: 600,
  });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  if (config.swaggerEnabled) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Tonir Pizza API')
        .setDescription(
          'REST API of the pizza shop. Money values are integer minor units of the store currency. ' +
            'Errors always look like `{ "error": { "code", "message", "fields?", "requestId" } }`.',
        )
        .setVersion('1.0')
        .addCookieAuth(
          ACCESS_COOKIE,
          { type: 'apiKey', in: 'cookie', name: ACCESS_COOKIE },
          ACCESS_COOKIE,
        )
        .build(),
    );
    SwaggerModule.setup(`${API_PREFIX}/docs`, app, document, {
      swaggerOptions: { withCredentials: true, persistAuthorization: true },
    });
  }
}
