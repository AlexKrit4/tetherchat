export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, 'bad_request', message, details);
  }

  static unauthorized(message = 'Нужна авторизация') {
    return new ApiError(401, 'unauthorized', message);
  }

  static forbidden(message = 'Недостаточно прав') {
    return new ApiError(403, 'forbidden', message);
  }

  static banned(message: string) {
    return new ApiError(403, 'account_banned', message);
  }

  static notFound(message = 'Не найдено') {
    return new ApiError(404, 'not_found', message);
  }

  static conflict(message: string) {
    return new ApiError(409, 'conflict', message);
  }

  static payloadTooLarge(message: string) {
    return new ApiError(413, 'payload_too_large', message);
  }

  static tooManyRequests(message = 'Подождите') {
    return new ApiError(429, 'rate_limited', message);
  }

  static internal(message = 'Внутренняя ошибка сервера') {
    return new ApiError(500, 'internal_error', message);
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
