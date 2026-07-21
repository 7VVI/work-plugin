import { systemRepo } from '../db/repositories/systemRepo';
import { serverRepo } from '../db/repositories/serverRepo';
import { middlewareRepo } from '../db/repositories/middlewareRepo';
import { tagRepo } from '../db/repositories/tagRepo';
import { accountRepo } from '../db/repositories/accountRepo';
import { cryptoService } from './cryptoService';
import { parseMarkdown, type ParsedBackup } from './markdownParser';
import { serializeMarkdown } from './markdownSerializer';
import { systemTagRepo } from '../db/repositories/systemTagRepo';

export interface ImportSummary {
  created: { systems: number; servers: number; middlewares: number; tags: number };
  updated: { systems: number; servers: number; middlewares: number };
  skipped: { count: number; reasons: string[] };
  errors: string[];
}

export const importExportService = {
  async exportMarkdown(options: { includePasswords: boolean }): Promise<string> {
    const [systems, servers, middlewares, tags] = await Promise.all([
      systemRepo.all(),
      serverRepo.all(),
      middlewareRepo.all(),
      tagRepo.all(),
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

    return serializeMarkdown({
      meta: { encrypted },
      systems: resolvedSystems as any,
      servers: serversWithPlain as any,
      middlewares: middlewaresWithPlain as any,
      tags,
    }, options);
  },

  async exportJSON(): Promise<string> {
    const [systems, servers, middlewares, tags] = await Promise.all([
      systemRepo.all(),
      serverRepo.all(),
      middlewareRepo.all(),
      tagRepo.all(),
    ]);
    return JSON.stringify({ meta: { version: 1, exportedAt: new Date().toISOString() }, systems, servers, middlewares, tags }, null, 2);
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
      created: { systems: 0, servers: 0, middlewares: 0, tags: 0 },
      updated: { systems: 0, servers: 0, middlewares: 0 },
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
        await systemRepo.update(existing.id, { environment: s.environment, remark: s.remark, icon: s.icon, color: s.color });
        systemId = existing.id;
        summary.updated.systems++;
      } else {
        systemId = await systemRepo.create({
          name: s.name,
          url: s.url,
          environment: s.environment || 'development',
          favorite: false,
          sort: 0,
          remark: s.remark,
          icon: s.icon,
          color: s.color,
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
      }
    }

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
        await serverRepo.update(existing.id, { sshPort: s.sshPort, username: s.username, password: encryptedPassword, environment: s.environment });
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
        });
        summary.created.servers++;
      }
    }

    return summary;
  },

  async upsertJson(data: any): Promise<ImportSummary> {
    const summary: ImportSummary = {
      created: { systems: 0, servers: 0, middlewares: 0, tags: 0 },
      updated: { systems: 0, servers: 0, middlewares: 0 },
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

    const systems: Array<any> = data.systems ?? [];
    for (const s of systems) {
      if (!s.name || !s.url) {
        summary.skipped.count++;
        summary.skipped.reasons.push('System missing name or url');
        continue;
      }
      const all = await systemRepo.all();
      const existing = all.find(x => x.name === s.name && x.url === s.url);
      if (existing) {
        await systemRepo.update(existing.id, { environment: s.environment, remark: s.remark, icon: s.icon, color: s.color });
        summary.updated.systems++;
      } else {
        await systemRepo.create({
          name: s.name,
          url: s.url,
          environment: s.environment || 'development',
          favorite: s.favorite ?? false,
          sort: s.sort ?? 0,
          remark: s.remark,
          icon: s.icon,
          color: s.color,
        });
        summary.created.systems++;
      }
    }

    const servers: Array<any> = data.servers ?? [];
    for (const s of servers) {
      if (!s.name || !s.ip) {
        summary.skipped.count++;
        summary.skipped.reasons.push('Server missing name or ip');
        continue;
      }
      const all = await serverRepo.all();
      const existing = all.find(x => x.name === s.name && x.ip === s.ip);
      const password = s.password ?? { __encrypted: false, value: '' };
      if (existing) {
        await serverRepo.update(existing.id, { sshPort: s.sshPort, username: s.username, password, environment: s.environment });
        summary.updated.servers++;
      } else {
        await serverRepo.create({
          name: s.name,
          ip: s.ip,
          sshPort: s.sshPort ?? 22,
          username: s.username ?? '',
          password,
          environment: s.environment || 'development',
          favorite: s.favorite ?? false,
        });
        summary.created.servers++;
      }
    }

    const middlewares: Array<any> = data.middlewares ?? [];
    for (const m of middlewares) {
      if (!m.name || !m.host) {
        summary.skipped.count++;
        summary.skipped.reasons.push('Middleware missing name or host');
        continue;
      }
      const all = await middlewareRepo.all();
      const existing = all.find(x => x.name === m.name && x.host === m.host);
      if (existing) {
        await middlewareRepo.update(existing.id, { port: m.port, username: m.username, password: m.password, database: m.database });
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
          password: m.password,
          extra: m.extra,
          remark: m.remark,
          favorite: m.favorite ?? false,
        });
        summary.created.middlewares++;
      }
    }

    return summary;
  },

  async clearAll(): Promise<void> {
    await Promise.all([
      systemRepo.all().then(all => Promise.all(all.map(s => systemRepo.delete(s.id)))),
      serverRepo.all().then(all => Promise.all(all.map(s => serverRepo.delete(s.id)))),
      middlewareRepo.all().then(all => Promise.all(all.map(m => middlewareRepo.delete(m.id)))),
      tagRepo.all().then(all => Promise.all(all.map(t => tagRepo.delete(t.id)))),
    ]);
  },
};
