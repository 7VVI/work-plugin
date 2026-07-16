export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class ValidationError extends DomainError {}
export class NotFoundError extends DomainError {}
export class EncryptionError extends DomainError {}
export class ImportExportError extends DomainError {}
export class CryptoLockedError extends DomainError {}

export function extractUserMessage(err: unknown): string {
  if (err instanceof DomainError) return err.message;
  if (err instanceof Error) return err.message;
  return '未知错误';
}
