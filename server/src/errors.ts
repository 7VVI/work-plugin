export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'HttpError';
  }
}

export function badRequest(code: string, message?: string): never {
  throw new HttpError(400, code, message);
}

export function unauthorized(message = 'Unauthorized'): never {
  throw new HttpError(401, 'UNAUTHORIZED', message);
}

export function forbidden(code = 'FORBIDDEN', message?: string): never {
  throw new HttpError(403, code, message);
}
