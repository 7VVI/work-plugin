import fm from 'front-matter';
import type { System, Server, Middleware, Tag } from '../types/entities';
import type { MiddlewareType } from '../types/enums';

export interface FrontMatter {
  navPortalVersion: number;
  exportedAt: string;
  encrypted: boolean;
  passwordsIncluded: boolean;
}

export interface ParsedBackup {
  meta: FrontMatter;
  systems: Array<Partial<System> & { tags?: string[]; accounts?: Array<{ role: string; username: string; password: string; isDefault?: boolean }> }>;
  servers: Array<Partial<Server> & { tags?: string[]; plainPassword?: string }>;
  middlewares: Array<Partial<Middleware> & { tags?: string[]; plainPassword?: string }>;
  tags: Array<Partial<Tag>>;
}

export function parseMarkdown(content: string): ParsedBackup {
  const { attributes, body } = fm<FrontMatter>(content);
  const result: ParsedBackup = {
    meta: attributes,
    systems: [],
    servers: [],
    middlewares: [],
    tags: [],
  };

  const sections = splitByHeading(body, 2);

  for (const section of sections) {
    const heading = section.heading.trim();
    if (heading === '系统' || heading === 'Systems') {
      result.systems = parseSystems(section.body);
    } else if (heading === '服务器' || heading === 'Servers') {
      result.servers = parseServers(section.body);
    } else if (heading === '中间件' || heading === 'Middlewares') {
      result.middlewares = parseMiddlewares(section.body);
    } else if (heading === '标签' || heading === 'Tags') {
      result.tags = parseTags(section.body);
    }
  }

  return result;
}

interface Section { heading: string; body: string; }

function splitByHeading(body: string, level: number): Section[] {
  const lines = body.split('\n');
  const sections: Section[] = [];
  let current: Section | null = null;
  const prefix = '#'.repeat(level) + ' ';

  for (const line of lines) {
    if (line.startsWith(prefix)) {
      if (current) sections.push(current);
      current = { heading: line.slice(prefix.length), body: '' };
    } else if (current) {
      current.body += line + '\n';
    }
  }
  if (current) sections.push(current);
  return sections;
}

function parseSystems(body: string): ParsedBackup['systems'] {
  const systems: ParsedBackup['systems'] = [];
  const sections = splitByHeading(body, 3);

  for (const section of sections) {
    const name = section.heading.trim();
    // Split section body into main fields and account sub-section
    const subSections = splitByHeading(section.body, 4);
    let mainBody = '';
    let accountBody = '';
    // Content before any #### heading
    const firstSubIdx = section.body.indexOf('#### ');
    if (firstSubIdx === -1) {
      mainBody = section.body;
    } else {
      mainBody = section.body.slice(0, firstSubIdx);
    }
    for (const sub of subSections) {
      if (sub.heading.trim() === '账号' || sub.heading.trim() === 'Accounts') {
        accountBody = sub.body;
      }
    }

    const fields = parseFields(mainBody);
    const tagLine = fields['标签'] || fields['Tags'];
    const accounts = accountBody ? parseAccounts(accountBody) : [];
    systems.push({
      name,
      url: fields['URL'],
      environment: (fields['环境'] as System['environment']) || 'development',
      icon: fields['图标'],
      color: fields['颜色'],
      remark: fields['备注'],
      tags: tagLine ? tagLine.split(',').map(s => s.trim()) : [],
      accounts,
    });
  }
  return systems;
}

function parseAccounts(body: string): Array<{ role: string; username: string; password: string; isDefault?: boolean }> {
  const accounts: Array<{ role: string; username: string; password: string; isDefault?: boolean }> = [];
  const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
  let inTable = false;
  let headers: string[] = [];
  for (const line of lines) {
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.slice(1, -1).split('|').map(c => c.trim());
      if (cells.every(c => /^-+$/.test(c))) {
        inTable = true;
        continue;
      }
      if (!inTable) {
        headers = cells;
        continue;
      }
      // Map columns by header names
      const roleIdx = headers.findIndex(h => h === '角色' || h === 'Role');
      const userIdx = headers.findIndex(h => h === '用户名' || h === 'Username');
      const pwdIdx = headers.findIndex(h => h === '密码' || h === 'Password');
      const defIdx = headers.findIndex(h => h === '默认' || h === 'Default');
      if (userIdx >= 0 && cells[userIdx]) {
        accounts.push({
          role: roleIdx >= 0 ? (cells[roleIdx] || 'admin') : 'admin',
          username: cells[userIdx],
          password: pwdIdx >= 0 ? (cells[pwdIdx] || '') : '',
          isDefault: defIdx >= 0 ? (cells[defIdx] === '是' || cells[defIdx] === 'true') : accounts.length === 0,
        });
      }
    } else {
      inTable = false;
    }
  }
  return accounts;
}

function parseServers(body: string): ParsedBackup['servers'] {
  const servers: ParsedBackup['servers'] = [];
  const sections = splitByHeading(body, 3);

  for (const section of sections) {
    const name = section.heading.trim();
    const fields = parseFields(section.body);
    servers.push({
      name,
      ip: fields['IP'],
      sshPort: fields['SSH 端口'] ? Number(fields['SSH 端口']) : 22,
      username: fields['账号'],
      plainPassword: fields['密码'] || '',
      environment: (fields['环境'] as Server['environment']) || 'development',
      purpose: fields['用途'],
      remark: fields['备注'],
    });
  }
  return servers;
}

function parseMiddlewares(body: string): ParsedBackup['middlewares'] {
  const middlewares: ParsedBackup['middlewares'] = [];
  const sections = splitByHeading(body, 3);

  for (const section of sections) {
    const name = section.heading.trim();
    const fields = parseFields(section.body);
    middlewares.push({
      type: (fields['类型'] as MiddlewareType) || 'redis',
      name,
      version: fields['版本'],
      host: fields['Host'] || '',
      port: fields['端口'] ? Number(fields['端口']) : 0,
      database: fields['数据库'],
      username: fields['账号'],
      plainPassword: fields['密码'],
      remark: fields['备注'],
    });
  }
  return middlewares;
}

function parseTags(body: string): ParsedBackup['tags'] {
  const tags: ParsedBackup['tags'] = [];
  const lines = body.split('\n');

  // 先尝试解析表格格式
  const tableFields = parseTableFields(body);
  if (Object.keys(tableFields).length > 0) {
    for (const [name, color] of Object.entries(tableFields)) {
      if (name) tags.push({ name: name.trim(), color: color?.trim() || undefined });
    }
    if (tags.length > 0) return tags;
  }

  // 兼容旧的列表格式
  for (const line of lines) {
    const match = line.match(/^\s*-\s+(.+?)(?:\s+\(#([0-9a-fA-F]{6})\))?$/);
    if (match) {
      tags.push({ name: match[1].trim(), color: match[2] ? `#${match[2]}` : undefined });
    }
  }
  return tags;
}

function parseBulletFields(body: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const lines = body.split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*-\s+\*\*(.+?)\*\*\s*:\s*(.+)$/);
    if (match) {
      fields[match[1].trim()] = match[2].trim();
    }
  }
  return fields;
}

function parseTableFields(body: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
  let inTable = false;
  let headers: string[] = [];
  for (const line of lines) {
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.slice(1, -1).split('|').map(c => c.trim());
      if (cells.every(c => /^-+$/.test(c))) {
        inTable = true;
        continue;
      }
      if (!inTable) {
        headers = cells;
        continue;
      }
      if (headers.length >= 2) {
        const key = cells[0];
        const value = cells[1];
        if (key) fields[key.trim()] = value?.trim() ?? '';
      }
    } else {
      inTable = false;
    }
  }
  return fields;
}

function parseFields(body: string): Record<string, string> {
  const tableFields = parseTableFields(body);
  const bulletFields = parseBulletFields(body);
  return { ...bulletFields, ...tableFields };
}
