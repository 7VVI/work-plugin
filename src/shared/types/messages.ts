import type { Account } from './entities';

export type Message =
  | { type: 'GET_MATCHING_ACCOUNTS'; url: string }
  | { type: 'GET_SYSTEM_FOR_URL'; url: string }
  | { type: 'RECORD_ACCESS'; entityType: 'system' | 'server' | 'middleware'; entityId: string; role?: string }
  | { type: 'PAGE_HAS_LOGIN_FORM'; count: number }
  | { type: 'CRYPTO_KEY_SYNC'; keyBytes: ArrayBuffer }
  | { type: 'CRYPTO_ACTIVITY' }
  | { type: 'LOCK_CRYPTO' }
  | { type: 'AUTO_FILL'; payload: AutoFillPayload };

export type AutoFillPayload =
  | { systemId: string; systemName: string; account: Account & { plainPassword: string } }
  | { picker: Array<{ systemId: string; systemName: string; account: Account & { plainPassword: string } }> };

export interface MessageResponse<T = unknown> {
  data?: T;
  error?: string;
}

export interface AccountMatch {
  systemId: string;
  systemName: string;
  account: Account & { plainPassword: string };
}
