import { db } from '../db/schema';
import { noteRepo } from '../db/repositories/noteRepo';
import { bufferToBase64 } from '../db/repositories/noteAssetRepo';
import { cryptoService } from '../services/cryptoService';
import {
  MAX_ASSET_BYTES,
  MAX_NOTE_CONTENT,
  MAX_TOTAL_ASSET_BYTES,
  MAX_TOTAL_NOTE_BYTES,
} from '@protocol/limits';
import { utf8Bytes } from '../utils/noteUtils';
import type {
  Account,
  ConfigDef,
  ConfigProject,
  Group,
  Middleware,
  Note,
  NoteBook,
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

export class NoteStorageLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoteStorageLimitError';
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
  await noteRepo.repairOrphanNotes();
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
    noteBooks,
    notes,
    noteAssets,
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
    db.noteBooks.toArray(),
    db.notes.toArray(),
    db.noteAssets.toArray(),
  ]);

  const systemTagMap = tagIdsByParent(systemTags, 'systemId');
  const serverTagMap = tagIdsByParent(serverTags, 'serverId');
  const middlewareTagMap = tagIdsByParent(middlewareTags, 'middlewareId');

  let noteBytes = 0;
  for (const note of notes as Note[]) {
    if (note.content.length > MAX_NOTE_CONTENT) {
      throw new NoteStorageLimitError(
        `笔记「${note.title || '未命名笔记'}」超过单篇 ${MAX_NOTE_CONTENT} 字符限制，无法同步`,
      );
    }
    noteBytes += utf8Bytes(note.content);
  }
  if (noteBytes > MAX_TOTAL_NOTE_BYTES) {
    throw new NoteStorageLimitError(
      `笔记总大小超过 ${Math.floor(MAX_TOTAL_NOTE_BYTES / 1024 / 1024)}MB，无法同步`,
    );
  }

  let assetBytes = 0;
  for (const asset of noteAssets) {
    if (asset.size > MAX_ASSET_BYTES) {
      throw new NoteStorageLimitError('图片资源超过单张上限，无法同步');
    }
    assetBytes += asset.size;
  }
  if (assetBytes > MAX_TOTAL_ASSET_BYTES) {
    throw new NoteStorageLimitError(
      `图片资源总大小超过 ${Math.floor(MAX_TOTAL_ASSET_BYTES / 1024 / 1024)}MB，无法同步`,
    );
  }

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
    noteBooks: noteBooks.map((book: NoteBook) => ({
      id: book.id,
      name: book.name,
      sortOrder: book.sortOrder,
      createdAt: book.createdAt,
      updatedAt: stamp ?? book.updatedAt,
    })),
    notes: notes.map((note: Note) => ({
      id: note.id,
      notebookId: note.notebookId,
      title: note.title,
      content: note.content,
      sortOrder: note.sortOrder,
      createdAt: note.createdAt,
      updatedAt: stamp ?? note.updatedAt,
    })),
    noteAssets: noteAssets.map(asset => ({
      id: asset.id,
      mime: asset.mime,
      size: asset.size,
      hash: asset.hash,
      data: bufferToBase64(asset.data),
      createdAt: asset.createdAt,
      updatedAt: stamp ?? asset.updatedAt,
    })),
  };

  return {
    schemaVersion: 1,
    generatedAt: stamp ?? Date.now(),
    data: normalizeData(data),
  };
}
