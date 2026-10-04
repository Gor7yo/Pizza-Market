import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@market/shared';

export interface AppExceptionBody {
  code: ErrorCode;
  message: string;
  fields?: Record<string, string>;
}

/** Domain error with a stable machine-readable code (see ERROR_CODES). */
export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    status: HttpStatus,
    message?: string,
    readonly fields?: Record<string, string>,
  ) {
    super({ code, message: message ?? code, fields } satisfies AppExceptionBody, status);
  }

  static badRequest(code: ErrorCode, message?: string, fields?: Record<string, string>) {
    return new AppException(code, HttpStatus.BAD_REQUEST, message, fields);
  }

  static unauthorized(code: ErrorCode = 'UNAUTHORIZED', message?: string) {
    return new AppException(code, HttpStatus.UNAUTHORIZED, message);
  }

  static forbidden(code: ErrorCode = 'FORBIDDEN', message?: string) {
    return new AppException(code, HttpStatus.FORBIDDEN, message);
  }

  static notFound(entity = 'Resource') {
    return new AppException('NOT_FOUND', HttpStatus.NOT_FOUND, `${entity} not found`);
  }

  static conflict(code: ErrorCode = 'CONFLICT', message?: string) {
    return new AppException(code, HttpStatus.CONFLICT, message);
  }

  static unprocessable(code: ErrorCode, message?: string) {
    return new AppException(code, HttpStatus.UNPROCESSABLE_ENTITY, message);
  }

  static tooMany(code: ErrorCode = 'RATE_LIMITED', message?: string) {
    return new AppException(code, HttpStatus.TOO_MANY_REQUESTS, message);
  }
}
