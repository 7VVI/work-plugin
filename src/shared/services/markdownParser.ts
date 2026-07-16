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
    const fields = parseBulletFields(section.body);
    const tagLine = fields['标签'] || fields['Tags'];
    systems.push({
      name,
      url: fields['URL'],
      environment: (fields['环境'] as System['environment']) || 'development',
      icon: fields['图标'],
      color: fields['颜色'],
      remark: fields['备注'],
      tags: tagLine ? tagLine.split(',').map(s => s.trim()) : [],
    });
  }
  return systems;
}

function parseServers(body: string): ParsedBackup['servers'] {
  const servers: ParsedBackup['servers'] = [];
  const sections = splitByHeading(body, 3);

  for (const section of sections) {
    const name = section.heading.trim();
    const fields = parseBulletFields(section.body);
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
    const fields = parseBulletFields(section.body);
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
