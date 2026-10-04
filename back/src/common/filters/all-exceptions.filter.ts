import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { ApiErrorBody, ErrorCode } from '@market/shared';
import type { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client';
import { AppException } from '../errors/app.exception';

const STATUS_CODES: Partial<Record<number, ErrorCode>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'INVALID_FILE',
  415: 'INVALID_FILE',
  422: 'BAD_REQUEST',
  429: 'RATE_LIMITED',
};

/**
 * Converts every error into the single API error format:
 * `{ error: { code, message, fields?, requestId } }`.
 * Unknown errors are logged with details but answered with a generic 500.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: unknown }>();
    const { status, body } = this.toResponse(exception);
    body.error.requestId = req.id !== undefined ? String(req.id) : undefined;

    if (status >= 500) {
      this.logger.error(
        { err: exception, method: req.method, path: req.path },
        'Unhandled exception',
      );
    }

    if (!res.headersSent) res.status(status).json(body);
  }

  private toResponse(exception: unknown): { status: number; body: ApiErrorBody } {
    if (exception instanceof AppException) {
      const status = exception.getStatus();
      return {
        status,
        body: {
          error: { code: exception.code, message: exception.message, fields: exception.fields },
        },
      };
    }

    if (exception instanceof ThrottlerException) {
      return this.body(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED', 'Too many requests');
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = STATUS_CODES[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
      const message = status >= 500 ? 'Internal server error' : exception.message;
      return this.body(status, code, message);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          return this.body(HttpStatus.CONFLICT, 'CONFLICT', 'Resource already exists');
        case 'P2003':
          return this.body(HttpStatus.CONFLICT, 'CONFLICT', 'Resource is referenced by other data');
        case 'P2025':
          return this.body(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Resource not found');
        default:
          break;
      }
    }

    return this.body(HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR', 'Internal server error');
  }

  private body(status: number, code: ErrorCode, message: string) {
    return { status, body: { error: { code, message } } };
  }
}
