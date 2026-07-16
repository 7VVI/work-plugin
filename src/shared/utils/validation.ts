import { ValidationError } from '../types/errors';

export function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError('REQUIRED_FIELD', `${field} 不能为空`);
  }
  return value.trim();
}

export function requireNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new ValidationError('REQUIRED_FIELD', `${field} 必须是数字`);
  }
  return value;
}

export function optionalString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  return undefined;
}
