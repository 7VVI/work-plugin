import { systemRepo } from '../db/repositories/systemRepo';
import { serverRepo } from '../db/repositories/serverRepo';
import { middlewareRepo } from '../db/repositories/middlewareRepo';
import { tagRepo } from '../db/repositories/tagRepo';
import { accountRepo } from '../db/repositories/accountRepo';
import { configProjectRepo } from '../db/repositories/configProjectRepo';
import { configDefRepo } from '../db/repositories/configDefRepo';
import { configService } from './configService';
import { groupRepo } from '../db/repositories/groupRepo';
import { noteBookRepo } from '../db/repositories/noteBookRepo';
import { noteRepo } from '../db/repositories/noteRepo';
import { db } from '../db/schema';
import { deletionId } from '../db/deletionLog';
import { generateId } from '../utils/id';
import { MAX_NOTE_CONTENT } from '@protocol/limits';
import { strToU8, zipSync } from 'fflate';
import { sanitizeFilename } from '../utils/noteUtils';
import { cryptoService } from './cryptoService';
import { parseMarkdown, type ParsedBackup } from './markdownParser';
import { serializeMarkdown } from './markdownSerializer';
import { systemTagRepo } from '../db/repositories/systemTagRepo';
import type { EntityType, EncryptedField } from '../types/entities';

/**
 * 将导入数据中的密码字段归一化为 EncryptedField：
 * - JSON 备份导出的是明文字符串 → 重新加密（未启用主密码时包装为明文字段）
 * - 旧备份可能已是 EncryptedField 对象 → 直接沿用
 */
async function normalizeEncryptedField(pwd: unknown): Promise<EncryptedField> {
  if (pwd && typeof pwd === 'object' && '__encrypted' in (pwd as Record<string, unknown>)) {
    return pwd as EncryptedField;
  }
  return cryptoService.encryptField(typeof pwd === 'string' ? pwd : '');
}

export interface ImportSummary {
  created: {
    systems: number;
    servers: number;
    middlewares: number;
    configs: number;
    tags: number;
    noteBooks: number;
    notes: number;
  };
  updated: {
    systems: number;
    servers: number;
    middlewares: number;
    configs: number;
    noteBooks: number;
    notes: number;
  };
  skipped: { count: number; reasons: string[] };
  errors: string[];
}

export interface NoteFileImportResult {
  notebookId: string;
  created: number;
  skipped: Array<{ name: string; reason: string }>;
}

/** 从文件名/首个标题推断笔记标题 */
export function noteTitleFromFile(name: string, content: string): string {
  const base = name.replace(/\.(md|markdown)$/i, '').trim();
  if (base) return base.slice(0, 200);
  const heading = content.match(/^\s*#{1,6}\s+(.+?)\s*$/m);
  return (heading?.[1] ?? '').trim().slice(0, 200);
}

/** 把笔记按「目录/标题.md」装进 zip 文件表；folderOf 返回空串表示放根目录 */
function packNoteFiles<T extends { title: string; content: string }>(
  notes: T[],
  folderOf: (note: T) => string,
): Record<string, Uint8Array> {
  const files: Record<string, Uint8Array> = {};
  const used = new Set<string>();
  for (const note of notes) {
    const folder = folderOf(note);
    const base = sanitizeFilename(note.title) || '未命名笔记';
    let path = folder ? `${folder}/${base}.md` : `${base}.md`;
    let index = 2;
    while (used.has(path)) {
      path = folder ? `${folder}/${base} (${index}).md` : `${base} (${index}).md`;
      index += 1;
    }
    used.add(path);
    files[path] = strToU8(note.content);
  }
  return files;
}

export const importExportService = {
  async exportMarkdown(options: { includePasswords: boolean; scope?: { systems?: boolean; servers?: boolean; middlewares?: boolean; configs?: boolean; groups?: boolean } }): Promise<string> {
    const [systems, servers, middlewares, tags, projects, groups] = await Promise.all([
      systemRepo.all(),
      serverRepo.all(),
      middlewareRepo.all(),
      tagRepo.all(),
      configService.allProjectsWithConfigs(),
      groupRepo.all(),
    ]);

    const encrypted = await cryptoService.isEnabled();

    if (options.includePasswords && encrypted && !cryptoService.isUnlocked()) {
      throw new Error('已启用主密码加密，请先在设置中解锁主密码后再导出明文密码');
    }

    const serversWithPlain = await Promise.all(servers.map(async s => ({
      ...s,
      plainPassword: await cryptoService.decryptField(s.password).catch(() => ''),
    })));

    const middlewaresWithPlain = await Promise.all(middlewares.map(async m => ({
      ...m,
      plainPassword: m.password ? await cryptoService.decryptField(m.password).catch(() => '') : '',
    })));

    const resolvedSystems = await Promise.all(systems.map(async s => {
      const tagIds = await systemTagRepo.tagsFor(s.id);
      const tagNames = await Promise.all(tagIds.map(async tid => (await tagRepo.byId(tid))?.name ?? ''));
      const accounts = await accountRepo.bySystemId(s.id);
      const plainAccounts = await Promise.all(accounts.map(async a => ({
        role: a.role,
        username: a.username,
        password: await cryptoService.decryptField(a.password).catch(() => ''),
        isDefault: a.isDefault,
      })));
      return { ...s, tags: tagNames, plainAccounts };
    }));

    const scope = options.scope ?? {};
    return serializeMarkdown({
      meta: { encrypted },
      systems: scope.systems === false ? [] : resolvedSystems as any,
      servers: scope.servers === false ? [] : serversWithPlain as any,
      middlewares: scope.middlewares === false ? [] : middlewaresWithPlain as any,
      projects: scope.configs === false ? [] : projects,
      groups: scope.groups === false ? [] : groups,
      tags,
    }, options);
  },

  async exportJSON(): Promise<string> {
    const [systems, servers, middlewares, tags, projects, groups, noteBooks, notes] = await Promise.all([
      systemRepo.all(),
      serverRepo.all(),
      middlewareRepo.all(),
      tagRepo.all(),
      configService.allProjectsWithConfigs(),
      groupRepo.all(),
      noteBookRepo.all(),
      noteRepo.all(),
    ]);

    // 解密密码为明文（与 v3 一致，导出文件即明文备份）
    const systemsOut = await Promise.all(systems.map(async (s) => {
      const tagIds = await systemTagRepo.tagsFor(s.id);
      const tagNames = await Promise.all(tagIds.map(async tid => (await tagRepo.byId(tid))?.name ?? ''));
      const accounts = await accountRepo.bySystemId(s.id);
      const plainAccounts = await Promise.all(accounts.map(async a => ({
        role: a.role,
        username: a.username,
        password: await cryptoService.decryptField(a.password).catch(() => ''),
        isDefault: a.isDefault,
      })));
      return { ...s, tags: tagNames, accounts: plainAccounts };
    }));

    const serversOut = await Promise.all(servers.map(async s => ({
      ...s,
      password: await cryptoService.decryptField(s.password).catch(() => ''),
    })));

    const middlewaresOut = await Promise.all(middlewares.map(async m => ({
      ...m,
      password: m.password ? await cryptoService.decryptField(m.password).catch(() => '') : '',
    })));

    return JSON.stringify({
      meta: { version: 1, exportedAt: new Date().toISOString(), encrypted: false },
      systems: systemsOut,
      servers: serversOut,
      middlewares: middlewaresOut,
      projects,
      groups,
      tags,
      noteBooks,
      notes,
    }, null, 2);
  },

  async importMarkdown(content: string, options: { mode: 'merge' | 'replace' }): Promise<ImportSummary> {
    const parsed = parseMarkdown(content);
    if (options.mode === 'replace') {
      await this.clearAll();
    }
    return this.upsertParsed(parsed);
  },

  async importJSON(content: string, options: { mode: 'merge' | 'replace' }): Promise<ImportSummary> {
    const data = JSON.parse(content);
    if (options.mode === 'replace') {
      await this.clearAll();
    }
    return this.upsertJson(data);
  },

  async upsertParsed(parsed: ParsedBackup): Promise<ImportSummary> {
    const summary: ImportSummary = {
      created: {
        systems: 0, servers: 0, middlewares: 0, configs: 0, tags: 0,
        noteBooks: 0, notes: 0,
      },
      updated: {
        systems: 0, servers: 0, middlewares: 0, configs: 0,
        noteBooks: 0, notes: 0,
      },
      skipped: { count: 0, reasons: [] },
      errors: [],
    };

    for (const tag of parsed.tags) {
      if (tag.name) {
        const existing = await tagRepo.byName(tag.name);
        if (!existing) {
          await tagRepo.create({ name: tag.name, color: tag.color });
          summary.created.tags++;
        }
      }
    }

    // 分组：Markdown 用名称引用，按 entityType+name 建立名称→id 映射
    const groupNameToId = new Map<string, string>();
    const groupOrderMap = new Map<EntityType, number>();
    for (const g of parsed.groups) {
      if (g.entityType && g.name) {
        const et = g.entityType as EntityType;
        const key = `${et}:${g.name}`;
        if (!groupNameToId.has(key)) {
          const existing = (await groupRepo.allByType(et)).find(x => x.name === g.name);
          if (existing) {
            groupNameToId.set(key, existing.id);
            const current = groupOrderMap.get(et) ?? (await groupRepo.allByType(et)).length;
            groupOrderMap.set(et, Math.max(current, (existing.sortOrder ?? 0)) + 1);
          } else {
            const order = groupOrderMap.get(et) ?? (await groupRepo.allByType(et)).length;
            const id = await groupRepo.create({ entityType: et, name: g.name, color: g.color || '#2E6BF0', sortOrder: order });
            groupNameToId.set(key, id);
            groupOrderMap.set(et, order + 1);
          }
        }
      }
    }
    const resolveGroupId = (entityType: string, name?: string) => (name ? groupNameToId.get(`${entityType}:${name}`) : undefined);

    let systemOrder = (await systemRepo.all()).length;
    for (const s of parsed.systems) {
      if (!s.name || !s.url) {
        summary.skipped.count++;
        summary.skipped.reasons.push('System missing name or url');
        continue;
      }
      const all = await systemRepo.all();
      const existing = all.find(x => x.name === s.name && x.url === s.url);
      let systemId: string;
      if (existing) {
        await systemRepo.update(existing.id, { environment: s.environment, remark: s.remark, icon: s.icon, iconColor: s.iconColor, color: s.color, groupId: resolveGroupId('system', s.groupName) });
        systemId = existing.id;
        summary.updated.systems++;
      } else {
        systemId = await systemRepo.create({
          name: s.name,
          url: s.url,
          environment: s.environment || 'development',
          favorite: false,
          sort: systemOrder++,
          remark: s.remark,
          icon: s.icon,
          iconColor: s.iconColor,
          color: s.color,
          groupId: resolveGroupId('system', s.groupName),
        });
        summary.created.systems++;
      }
      // Import accounts for this system
      if (s.accounts && s.accounts.length > 0) {
        const existingAccounts = await accountRepo.bySystemId(systemId);
        for (const acc of s.accounts) {
          if (!acc.username) continue;
          const alreadyExists = existingAccounts.some(a => a.username === acc.username && a.role === acc.role);
          if (!alreadyExists) {
            const encryptedPwd = await cryptoService.encryptField(acc.password || '');
            await accountRepo.create({
              systemId,
              role: acc.role || 'admin',
              username: acc.username,
              password: encryptedPwd,
              isDefault: acc.isDefault ?? false,
            });
          }
        }
        // 导入数据可能带多个默认账号，导入后校正为唯一默认
        await accountRepo.normalizeDefault(systemId);
      }
    }

    let serverOrder = (await serverRepo.all()).length;
    for (const s of parsed.servers) {
      if (!s.name || !s.ip) {
        summary.skipped.count++;
        summary.skipped.reasons.push('Server missing name or ip');
        continue;
      }
      const all = await serverRepo.all();
      const existing = all.find(x => x.name === s.name && x.ip === s.ip);
      const encryptedPassword = await cryptoService.encryptField(s.plainPassword || '');
      if (existing) {
        await serverRepo.update(existing.id, { sshPort: s.sshPort, username: s.username, password: encryptedPassword, environment: s.environment, groupId: resolveGroupId('server', s.groupName) });
        summary.updated.servers++;
      } else {
        await serverRepo.create({
          name: s.name,
          ip: s.ip,
          sshPort: s.sshPort || 22,
          username: s.username || '',
          password: encryptedPassword,
          environment: s.environment || 'development',
          favorite: false,
          // sortOrder 必须为数字，否则 serverRepo 会因索引缺失而排除该记录
          sortOrder: serverOrder++,
          groupId: resolveGroupId('server', s.groupName),
        });
        summary.created.servers++;
      }
    }

    let mwOrder = (await middlewareRepo.all()).length;
    for (const m of parsed.middlewares) {
      if (!m.name || !m.host) {
        summary.skipped.count++;
        summary.skipped.reasons.push('Middleware missing name or host');
        continue;
      }
      const all = await middlewareRepo.all();
      const existing = all.find(x => x.name === m.name && x.host === m.host);
      const encryptedPassword = await cryptoService.encryptField(m.plainPassword || '');
      if (existing) {
        await middlewareRepo.update(existing.id, { type: m.type, version: m.version, port: m.port, database: m.database, username: m.username, password: encryptedPassword, groupId: resolveGroupId('middleware', m.groupName) });
        summary.updated.middlewares++;
      } else {
        await middlewareRepo.create({
          type: (m.type as any) || 'redis',
          name: m.name,
          version: m.version,
          host: m.host,
          port: m.port ?? 0,
          database: m.database,
          username: m.username,
          password: encryptedPassword,
          remark: m.remark,
          favorite: false,
          // sortOrder 必须为数字，否则 middlewareRepo 会因索引缺失而排除该记录
          sortOrder: mwOrder++,
          groupId: resolveGroupId('middleware', m.groupName),
        });
        summary.created.middlewares++;
      }
    }

    for (const p of parsed.projects) {
      if (!p.name) {
        summary.skipped.count++;
        summary.skipped.reasons.push('Config project missing name');
        continue;
      }
      const allProjects = await configProjectRepo.all();
      const existingProject = allProjects.find(x => x.name === p.name);
      const projectId = existingProject ? existingProject.id : await configProjectRepo.create(p.name);
      const existingConfigs = await configDefRepo.byProject(projectId);
      let cfgOrder = existingConfigs.length;
      for (const c of p.configs) {
        if (!c.name) continue;
        const fields = c.fields.map(f => ({ key: f.key ?? '', label: f.label ?? '', value: f.value ?? '' }));
        const existingCfg = existingConfigs.find(x => x.name === c.name);
        if (existingCfg) {
          await configDefRepo.setFields(existingCfg.id, fields);
          if (c.environment && existingCfg.environment !== c.environment) {
            await configDefRepo.setEnvironment(existingCfg.id, c.environment as any);
          }
        } else {
          const cfgId = await configDefRepo.create(projectId, c.name, c.environment as any, cfgOrder++);
          await configDefRepo.setFields(cfgId, fields);
          summary.created.configs++;
        }
      }
    }

    return summary;
  },

  async upsertJson(data: any): Promise<ImportSummary> {
    const summary: ImportSummary = {
      created: {
        systems: 0, servers: 0, middlewares: 0, configs: 0, tags: 0,
        noteBooks: 0, notes: 0,
      },
      updated: {
        systems: 0, servers: 0, middlewares: 0, configs: 0,
        noteBooks: 0, notes: 0,
      },
      skipped: { count: 0, reasons: [] },
      errors: [],
    };

    const tags: Array<any> = data.tags ?? [];
    for (const tag of tags) {
      if (tag.name) {
        const existing = await tagRepo.byName(tag.name);
        if (!existing) {
          await tagRepo.create({ name: tag.name, color: tag.color });
          summary.created.tags++;
        }
      }
    }

    // 分组：按原 id 直接写入（插入或覆盖），保证记录的 groupId 仍能命中
    const groupsIn: Array<any> = data.groups ?? [];
    for (const g of groupsIn) {
      if (g && g.id && g.entityType && g.name) {
        await groupRepo.put({
          id: g.id,
          entityType: g.entityType,
          name: g.name,
          color: g.color || '#2E6BF0',
          sortOrder: g.sortOrder,
          createdAt: g.createdAt || Date.now(),
          // 导入视为一次新的本地变更，避免被清空时留下的分组墓碑拒绝
          updatedAt: Date.now(),
        });
      }
    }

    const systems: Array<any> = data.systems ?? [];
    let systemOrder = (await systemRepo.all()).length;
    for (const s of systems) {
      if (!s.name || !s.url) {
        summary.skipped.count++;
        summary.skipped.reasons.push('System missing name or url');
        continue;
      }
      const all = await systemRepo.all();
      const existing = all.find(x => x.name === s.name && x.url === s.url);
      let systemId: string;
      if (existing) {
        await systemRepo.update(existing.id, { environment: s.environment, remark: s.remark, icon: s.icon, iconColor: s.iconColor, color: s.color, groupId: s.groupId });
        systemId = existing.id;
        summary.updated.systems++;
      } else {
        systemId = await systemRepo.create({
          name: s.name,
          url: s.url,
          environment: s.environment || 'development',
          favorite: s.favorite ?? false,
          sort: typeof s.sort === 'number' ? s.sort : systemOrder++,
          remark: s.remark,
          icon: s.icon,
          iconColor: s.iconColor,
          color: s.color,
          groupId: s.groupId,
        });
        summary.created.systems++;
      }
      // 导入该系统的账号
      if (s.accounts && s.accounts.length > 0) {
        const existingAccounts = await accountRepo.bySystemId(systemId);
        for (const acc of s.accounts) {
          if (!acc.username) continue;
          const alreadyExists = existingAccounts.some(a => a.username === acc.username && a.role === acc.role);
          if (!alreadyExists) {
            const encryptedPwd = await cryptoService.encryptField(acc.password || '');
            await accountRepo.create({
              systemId,
              role: acc.role || 'admin',
              username: acc.username,
              password: encryptedPwd,
              isDefault: acc.isDefault ?? false,
            });
          }
        }
        // 导入数据可能带多个默认账号，导入后校正为唯一默认
        await accountRepo.normalizeDefault(systemId);
      }
    }

    const servers: Array<any> = data.servers ?? [];
    let serverOrder = (await serverRepo.all()).length;
    for (const s of servers) {
      if (!s.name || !s.ip) {
        summary.skipped.count++;
        summary.skipped.reasons.push('Server missing name or ip');
        continue;
      }
      const all = await serverRepo.all();
      const existing = all.find(x => x.name === s.name && x.ip === s.ip);
      const password = await normalizeEncryptedField(s.password);
      const sshKey = (s.sshKey !== undefined && s.sshKey !== null && s.sshKey !== '')
        ? await normalizeEncryptedField(s.sshKey)
        : undefined;
      if (existing) {
        await serverRepo.update(existing.id, {
          sshPort: s.sshPort,
          username: s.username,
          password,
          sshKey,
          environment: s.environment,
          status: s.status,
          purpose: s.purpose,
          remark: s.remark,
          groupId: s.groupId,
        });
        summary.updated.servers++;
      } else {
        await serverRepo.create({
          name: s.name,
          ip: s.ip,
          sshPort: s.sshPort ?? 22,
          username: s.username ?? '',
          password,
          sshKey,
          environment: s.environment || 'development',
          status: s.status,
          purpose: s.purpose,
          remark: s.remark,
          favorite: s.favorite ?? false,
          // sortOrder 必须为数字，否则 serverRepo 会因索引缺失而排除该记录
          sortOrder: typeof s.sortOrder === 'number' ? s.sortOrder : serverOrder++,
          groupId: s.groupId,
        });
        summary.created.servers++;
      }
    }

    const middlewares: Array<any> = data.middlewares ?? [];
    let mwOrder = (await middlewareRepo.all()).length;
    for (const m of middlewares) {
      if (!m.name || !m.host) {
        summary.skipped.count++;
        summary.skipped.reasons.push('Middleware missing name or host');
        continue;
      }
      const all = await middlewareRepo.all();
      const existing = all.find(x => x.name === m.name && x.host === m.host);
      const password = (m.password !== undefined && m.password !== null)
        ? await normalizeEncryptedField(m.password)
        : undefined;
      if (existing) {
        await middlewareRepo.update(existing.id, { type: m.type, version: m.version, port: m.port, username: m.username, password, database: m.database, extra: m.extra, remark: m.remark, groupId: m.groupId });
        summary.updated.middlewares++;
      } else {
        await middlewareRepo.create({
          type: m.type || 'redis',
          name: m.name,
          version: m.version,
          host: m.host,
          port: m.port ?? 0,
          database: m.database,
          username: m.username,
          password,
          extra: m.extra,
          remark: m.remark,
          favorite: m.favorite ?? false,
          // sortOrder 必须为数字，否则 middlewareRepo 会因索引缺失而排除该记录
          sortOrder: typeof m.sortOrder === 'number' ? m.sortOrder : mwOrder++,
          groupId: m.groupId,
        });
        summary.created.middlewares++;
      }
    }

    const projects: Array<any> = data.projects ?? data.configs ?? [];
    for (const p of projects) {
      if (!p || !p.name) {
        summary.skipped.count++;
        summary.skipped.reasons.push('Config project missing name');
        continue;
      }
      const allProjects = await configProjectRepo.all();
      const existingProject = allProjects.find(x => x.name === p.name);
      const projectId = existingProject ? existingProject.id : await configProjectRepo.create(p.name);
      const existingConfigs = await configDefRepo.byProject(projectId);
      // 兼容旧的两级结构（items → 默认配置）与新的三级结构（configs）
      const rawConfigs: Array<any> = Array.isArray(p.configs) ? p.configs
        : (Array.isArray(p.items) ? [{ name: '默认配置', fields: (p.items as any[]).map((it) => ({ key: it.key ?? '', label: it.label ?? '', value: it.value ?? it.defaultValue ?? '' })) }] : []);
      let cfgOrder = existingConfigs.length;
      for (const c of rawConfigs) {
        if (!c || !c.name) continue;
        const fields = (c.fields ?? []).map((f: any) => ({ key: f.key ?? '', label: f.label ?? '', value: f.value ?? f.defaultValue ?? '' }));
        const existingCfg = existingConfigs.find(x => x.name === c.name);
        if (existingCfg) {
          await configDefRepo.setFields(existingCfg.id, fields);
          if (c.environment && existingCfg.environment !== c.environment) {
            await configDefRepo.setEnvironment(existingCfg.id, c.environment);
          }
        } else {
          const cfgId = await configDefRepo.create(projectId, c.name, c.environment, cfgOrder++);
          await configDefRepo.setFields(cfgId, fields);
          summary.created.configs++;
        }
      }
    }

    const importedBooks: Array<any> = Array.isArray(data.noteBooks) ? data.noteBooks : [];
    const bookIdMap = new Map<string, string>();
    let bookOrder = (await noteBookRepo.all()).length;
    for (const b of importedBooks) {
      if (!b || typeof b !== 'object') {
        summary.skipped.count++;
        summary.skipped.reasons.push('Notebook record is invalid');
        continue;
      }
      const oldId = typeof b.id === 'string' && b.id ? b.id : '';
      const id = oldId || generateId();
      const existing = oldId ? await noteBookRepo.byId(oldId) : undefined;
      const now = Date.now();
      await noteBookRepo.put({
        id,
        name: typeof b.name === 'string' && b.name.trim() ? b.name : '导入笔记本',
        sortOrder: Number.isFinite(b.sortOrder) ? b.sortOrder : bookOrder++,
        createdAt: Number.isFinite(b.createdAt) ? b.createdAt : now,
        updatedAt: now,
      });
      await db.deletions.delete(deletionId('noteBook', id));
      if (oldId) bookIdMap.set(oldId, id);
      if (existing) summary.updated.noteBooks++;
      else summary.created.noteBooks++;
    }

    const importedNotes: Array<any> = Array.isArray(data.notes) ? data.notes : [];
    let fallbackBookId = '';
    let noteOrder = (await noteRepo.all()).length;
    for (const n of importedNotes) {
      if (!n || typeof n !== 'object') {
        summary.skipped.count++;
        summary.skipped.reasons.push('Note record is invalid');
        continue;
      }
      const content = typeof n.content === 'string' ? n.content : '';
      if (content.length > MAX_NOTE_CONTENT) {
        summary.skipped.count++;
        summary.skipped.reasons.push(`Note content exceeds ${MAX_NOTE_CONTENT} characters`);
        continue;
      }

      let bookId = typeof n.notebookId === 'string' && n.notebookId
        ? (bookIdMap.get(n.notebookId) ?? n.notebookId)
        : '';
      if (!bookId || !(await noteBookRepo.byId(bookId))) {
        if (!fallbackBookId) {
          const fallback = (await noteBookRepo.all()).find(book => book.name === '导入笔记');
          fallbackBookId = fallback?.id ?? await noteBookRepo.create('导入笔记');
        }
        bookId = fallbackBookId;
      }

      const oldId = typeof n.id === 'string' && n.id ? n.id : '';
      const id = oldId || generateId();
      const existing = oldId ? await noteRepo.byId(oldId) : undefined;
      const now = Date.now();
      await noteRepo.put({
        id,
        notebookId: bookId,
        title: typeof n.title === 'string' ? n.title : '',
        content,
        sortOrder: Number.isFinite(n.sortOrder) ? n.sortOrder : noteOrder++,
        createdAt: Number.isFinite(n.createdAt) ? n.createdAt : now,
        updatedAt: now,
      });
      await db.deletions.delete(deletionId('note', id));
      if (existing) summary.updated.notes++;
      else summary.created.notes++;
    }

    return summary;
  },

  async clearAll(): Promise<void> {
    await Promise.all([
      systemRepo.all().then(all => Promise.all(all.map(s => systemRepo.delete(s.id)))),
      serverRepo.all().then(all => Promise.all(all.map(s => serverRepo.delete(s.id)))),
      middlewareRepo.all().then(all => Promise.all(all.map(m => middlewareRepo.delete(m.id)))),
      tagRepo.all().then(all => Promise.all(all.map(t => tagRepo.delete(t.id)))),
      configProjectRepo.all().then(all => Promise.all(all.map(p => configProjectRepo.delete(p.id)))),
      groupRepo.clear(),
    ]);
    await noteRepo.clearAll();
    await noteBookRepo.clearAll();
  },

  /** 把一批 .md 文档导入为笔记；不指定笔记本时放进「导入笔记」 */
  async importNoteFiles(
    files: Array<{ name: string; text: string }>,
    targetNotebookId?: string,
  ): Promise<NoteFileImportResult> {
    let notebookId = targetNotebookId;
    if (notebookId && !(await noteBookRepo.byId(notebookId))) notebookId = undefined;
    if (!notebookId) {
      const all = await noteBookRepo.all();
      notebookId = all.find(book => book.name === '导入笔记')?.id ?? await noteBookRepo.create('导入笔记');
    }

    const skipped: Array<{ name: string; reason: string }> = [];
    let created = 0;
    for (const file of files) {
      const text = file.text;
      if (!text.trim()) {
        skipped.push({ name: file.name, reason: '文件内容为空' });
        continue;
      }
      if (text.length > MAX_NOTE_CONTENT) {
        skipped.push({ name: file.name, reason: `超过单篇 ${MAX_NOTE_CONTENT} 字符上限` });
        continue;
      }
      await noteRepo.create({
        notebookId,
        title: noteTitleFromFile(file.name, text) || '未命名笔记',
        content: text,
      });
      created += 1;
    }

    return { notebookId, created, skipped };
  },

  /** 导出全部笔记为 zip：按笔记本分目录，一篇一个 .md */
  async exportNotesZip(): Promise<{ blob: Blob; count: number }> {
    const [books, notes] = await Promise.all([noteBookRepo.all(), noteRepo.all()]);
    const bookName = new Map(books.map(book => [book.id, book.name]));
    const files = packNoteFiles(notes, note => sanitizeFilename(bookName.get(note.notebookId) ?? '未分类') || '未分类');
    return {
      blob: new Blob([zipSync(files, { level: 6 })], { type: 'application/zip' }),
      count: notes.length,
    };
  },

  /** 导出某个笔记本下的笔记为 zip：文件直接放 zip 根目录 */
  async exportNotebookZip(notebookId: string): Promise<{ blob: Blob; count: number; name: string }> {
    const [book, notes] = await Promise.all([
      noteBookRepo.byId(notebookId),
      noteRepo.all().then(all => all.filter(note => note.notebookId === notebookId)),
    ]);
    const files = packNoteFiles(notes, () => '');
    return {
      blob: new Blob([zipSync(files, { level: 6 })], { type: 'application/zip' }),
      count: notes.length,
      name: book?.name ?? '笔记本',
    };
  },
};
