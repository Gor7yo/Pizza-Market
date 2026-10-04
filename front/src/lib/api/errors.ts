import { type ErrorCode, isApiErrorBody } from '@market/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly fields?: Record<string, string>,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static async fromResponse(res: Response): Promise<ApiError> {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // non-JSON error (proxy/gateway)
    }
    if (isApiErrorBody(body)) {
      const { code, message, fields, requestId } = body.error;
      return new ApiError(res.status, code, message, fields, requestId);
    }
    return new ApiError(
      res.status,
      res.status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST',
      res.statusText,
    );
  }
}

export function isApiError(error: unknown, code?: ErrorCode): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}
