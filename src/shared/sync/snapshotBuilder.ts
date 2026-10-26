import { db } from '../db/schema';
import { cryptoService } from '../services/cryptoService';
import type {
  Account,
  ConfigDef,
  ConfigProject,
  Group,
  Middleware,
  Server,
  System,
  Tag,
} from '../types/entities';
import type { SnapshotData, SyncSnapshot } from '@protocol/types';
import { normalizeData } from '@protocol/normalize';

export class VaultLockedError extends Error {
  constructor() {
    super('保险库已锁定，请先解锁主密码');
    this.name = 'VaultLockedError';
  }
}

export interface SnapshotBuildOptions {
  /** 覆盖云端时把所有记录的更新时间抬到该值，越过旧的删除墓碑 */
  forceUpdatedAt?: number;
}

function tagIdsByParent<T extends { tagId: string }>(rows: T[], parentKey: keyof T & string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const id = row[parentKey] as string;
    const list = map.get(id) ?? [];
    list.push(row.tagId);
    map.set(id, list);
  }
  return map;
}

/**
 * 构建全量云端快照。敏感字段解密失败时整体失败，绝不写空密码。
 */
export async function buildLocalSnapshot(options: SnapshotBuildOptions = {}): Promise<SyncSnapshot> {
  if (await cryptoService.isEnabled() && !cryptoService.isUnlocked()) {
    throw new VaultLockedError();
  }
  const stamp = options.forceUpdatedAt;

  const [
    groups,
    tags,
    systems,
    accounts,
    servers,
    middlewares,
    configProjects,
    configDefs,
    systemTags,
    serverTags,
    middlewareTags,
  ] = await Promise.all([
    db.groups.toArray(),
    db.tags.toArray(),
    db.systems.toArray(),
    db.accounts.toArray(),
    db.servers.toArray(),
    db.middlewares.toArray(),
    db.configProjects.toArray(),
    db.configDefs.toArray(),
    db.systemTags.toArray(),
    db.serverTags.toArray(),
    db.middlewareTags.toArray(),
  ]);

  const systemTagMap = tagIdsByParent(systemTags, 'systemId');
  const serverTagMap = tagIdsByParent(serverTags, 'serverId');
  const middlewareTagMap = tagIdsByParent(middlewareTags, 'middlewareId');

  const data: SnapshotData = {
    groups: groups.map((group: Group) => ({ ...group, updatedAt: stamp ?? group.updatedAt })),
    tags: tags.map((tag: Tag) => ({ ...tag, updatedAt: stamp ?? tag.updatedAt })),
    systems: systems.map((system: System) => {
      const { id, name, url, icon, iconColor, environment, color, favorite, sort, sortOrder, groupId, remark, createdAt, updatedAt } = system;
      return {
        id, name, url, icon, iconColor, environment, color, favorite, sort, sortOrder, groupId, remark, createdAt,
        updatedAt: stamp ?? updatedAt,
        tagIds: systemTagMap.get(system.id) ?? [],
      };
    }),
    accounts: await Promise.all(accounts.map(async (account: Account) => {
      const { id, systemId, role, username, isDefault, remark, createdAt, updatedAt } = account;
      return {
        id,
        systemId,
        role,
        username,
        password: await cryptoService.decryptField(account.password),
        isDefault,
        remark,
        createdAt,
        updatedAt: stamp ?? updatedAt,
      };
    })),
    servers: await Promise.all(servers.map(async (server: Server) => {
      const { id, name, ip, sshPort, username, environment, status, purpose, remark, favorite, sortOrder, groupId, createdAt, updatedAt } = server;
      return {
        id,
        name,
        ip,
        sshPort,
        username,
        password: await cryptoService.decryptField(server.password),
        sshKey: server.sshKey ? await cryptoService.decryptField(server.sshKey) : undefined,
        environment,
        status,
        purpose,
        remark,
        favorite,
        sortOrder,
        groupId,
        createdAt,
        updatedAt: stamp ?? updatedAt,
        tagIds: serverTagMap.get(server.id) ?? [],
      };
    })),
    middlewares: await Promise.all(middlewares.map(async (middleware: Middleware) => {
      const { id, type, name, version, host, port, database, username, extra, remark, favorite, sortOrder, groupId, createdAt, updatedAt } = middleware;
      return {
        id,
        type,
        name,
        version,
        host,
        port,
        database,
        username,
        password: middleware.password ? await cryptoService.decryptField(middleware.password) : undefined,
        extra,
        remark,
        favorite,
        sortOrder,
        groupId,
        createdAt,
        updatedAt: stamp ?? updatedAt,
        tagIds: middlewareTagMap.get(middleware.id) ?? [],
      };
    })),
    configProjects: configProjects.map((project: ConfigProject) => ({ ...project, updatedAt: stamp ?? project.updatedAt })),
    configDefs: configDefs.map((config: ConfigDef) => ({ ...config, updatedAt: stamp ?? config.updatedAt, fields: config.fields.map(field => ({ ...field })) })),
  };

  return {
    schemaVersion: 1,
    generatedAt: stamp ?? Date.now(),
    data: normalizeData(data),
  };
}
