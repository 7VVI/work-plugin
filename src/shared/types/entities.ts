import type { MiddlewareType } from './enums';

export type EncryptedField =
  | { __encrypted: true; iv: string; ciphertext: string }
  | { __encrypted: false; value: string };

export type Environment = 'production' | 'development' | 'test' | 'staging';
export type EntityType = 'system' | 'server' | 'middleware';

export interface System {
  id: string;
  name: string;
  url: string;
  icon?: string;
  iconColor?: string;
  environment: Environment;
  color?: string;
  favorite: boolean;
  sort: number;
  sortOrder?: number;
  remark?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Account {
  id: string;
  systemId: string;
  role: string;
  username: string;
  password: EncryptedField;
  isDefault: boolean;
  remark?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Server {
  id: string;
  name: string;
  ip: string;
  sshPort: number;
  username: string;
  password: EncryptedField;
  sshKey?: EncryptedField;
  environment: Environment;
  status?: 'online' | 'warn' | 'offline';
  purpose?: string;
  remark?: string;
  favorite: boolean;
  sortOrder?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Middleware {
  id: string;
  type: MiddlewareType;
  name: string;
  version?: string;
  host: string;
  port: number;
  database?: string;
  username?: string;
  password?: EncryptedField;
  extra?: Record<string, unknown>;
  remark?: string;
  favorite: boolean;
  sortOrder?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
  createdAt: number;
}

export interface SystemTag { systemId: string; tagId: string; }
export interface ServerTag { serverId: string; tagId: string; }
export interface MiddlewareTag { middlewareId: string; tagId: string; }

export interface Recent {
  id: string;
  entityType: EntityType;
  entityId: string;
  lastAccessedAt: number;
  role?: string;
}

export interface ConfigItem {
  key: string;
  label?: string;
  defaultValue?: string;
  value?: string;
}

export interface ConfigGroup {
  id: string;
  name: string;
  items: ConfigItem[];
  createdAt: number;
  updatedAt: number;
}

export type ConfigGroupInput = Omit<ConfigGroup, 'id' | 'createdAt' | 'updatedAt'>;

export interface MetaEntry {
  key: string;
  value: unknown;
}

// Input types (no audit fields, no id)
export type SystemInput = Omit<System, 'id' | 'createdAt' | 'updatedAt'>;
export type AccountInput = Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'password'> & { password: string };
export type ServerInput = Omit<Server, 'id' | 'createdAt' | 'updatedAt' | 'password' | 'sshKey'> & { password: string; sshKey?: string };
export type MiddlewareInput = Omit<Middleware, 'id' | 'createdAt' | 'updatedAt' | 'password'> & { password?: string };
