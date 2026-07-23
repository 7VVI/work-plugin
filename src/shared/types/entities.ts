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

// 配置三级结构（与 v3 dashboard.html 对齐）：项目 → 配置 → 字段
// 项目(ConfigProject) 对应 v3 左侧项目列表；配置(ConfigDef) 对应 v3 右侧 chips；字段(ConfigField) 对应 v3 表格行
export interface ConfigField {
  key: string;
  label?: string;
  value?: string;
}

export interface ConfigDef {
  id: string;
  name: string;
  fields: ConfigField[];
}

export interface ConfigProject {
  id: string;
  name: string;
  configs: ConfigDef[];
  createdAt: number;
  updatedAt: number;
}

export type ConfigProjectInput = Omit<ConfigProject, 'id' | 'createdAt' | 'updatedAt'>;

export interface MetaEntry {
  key: string;
  value: unknown;
}

// Input types (no audit fields, no id)
export type SystemInput = Omit<System, 'id' | 'createdAt' | 'updatedAt'>;
export type AccountInput = Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'password'> & { password: string };
export type ServerInput = Omit<Server, 'id' | 'createdAt' | 'updatedAt' | 'password' | 'sshKey'> & { password: string; sshKey?: string };
export type MiddlewareInput = Omit<Middleware, 'id' | 'createdAt' | 'updatedAt' | 'password'> & { password?: string };
