import type { System, Server, Middleware, Tag } from '../types/entities';
import type { ParsedBackup } from './markdownParser';

export interface SerializeOptions {
  includePasswords: boolean;
}

interface BackupData {
  meta: { encrypted: boolean };
  systems: Array<System & { tags?: string[]; plainAccounts?: Array<{ role: string; username: string; password: string; isDefault?: boolean }> }>;
  servers: Array<Server & { tags?: string[]; plainPassword?: string }>;
  middlewares: Array<Middleware & { tags?: string[]; plainPassword?: string }>;
  tags: Tag[];
}

export function serializeMarkdown(data: ParsedBackup | BackupData, options: SerializeOptions): string {
  const lines: string[] = [];

  lines.push('---');
  lines.push('navPortalVersion: 1');
  lines.push(`exportedAt: ${new Date().toISOString()}`);
  lines.push(`encrypted: ${data.meta.encrypted}`);
  lines.push(`passwordsIncluded: ${options.includePasswords}`);
  lines.push('---');
  lines.push('');
  lines.push('# Nav Portal Backup');
  lines.push('');

  if (data.systems.length > 0) {
    lines.push('## 系统');
    lines.push('');
    for (const s of data.systems) {
      lines.push(`### ${s.name}`);
      lines.push('');
      if (s.url) lines.push(`- **URL**: ${s.url}`);
      if (s.environment) lines.push(`- **环境**: ${s.environment}`);
      if (s.icon) lines.push(`- **图标**: ${s.icon}`);
      if (s.color) lines.push(`- **颜色**: ${s.color}`);
      if (s.tags && s.tags.length > 0) lines.push(`- **标签**: ${s.tags.join(', ')}`);
      if (s.remark) lines.push(`- **备注**: ${s.remark}`);
      lines.push('');
    }
  }

  if (data.servers.length > 0) {
    lines.push('## 服务器');
    lines.push('');
    for (const s of data.servers) {
      lines.push(`### ${s.name}`);
      lines.push('');
      if (s.ip) lines.push(`- **IP**: ${s.ip}`);
      if (s.sshPort) lines.push(`- **SSH 端口**: ${s.sshPort}`);
      if (s.username) lines.push(`- **账号**: ${s.username}`);
      const pwd = (s as any).plainPassword;
      lines.push(`- **密码**: ${options.includePasswords && pwd ? pwd : '********'}`);
      if (s.environment) lines.push(`- **环境**: ${s.environment}`);
      if (s.purpose) lines.push(`- **用途**: ${s.purpose}`);
      if (s.remark) lines.push(`- **备注**: ${s.remark}`);
      lines.push('');
    }
  }

  if (data.middlewares.length > 0) {
    lines.push('## 中间件');
    lines.push('');
    for (const m of data.middlewares) {
      lines.push(`### ${m.name}`);
      lines.push('');
      if (m.type) lines.push(`- **类型**: ${m.type}`);
      if (m.version) lines.push(`- **版本**: ${m.version}`);
      if (m.host) lines.push(`- **Host**: ${m.host}`);
      if (m.port) lines.push(`- **端口**: ${m.port}`);
      if (m.database) lines.push(`- **数据库**: ${m.database}`);
      if (m.username) lines.push(`- **账号**: ${m.username}`);
      const pwd = (m as any).plainPassword;
      if (pwd || m.password) lines.push(`- **密码**: ${options.includePasswords && pwd ? pwd : '********'}`);
      if (m.remark) lines.push(`- **备注**: ${m.remark}`);
      lines.push('');
    }
  }

  if (data.tags.length > 0) {
    lines.push('## 标签');
    lines.push('');
    for (const t of data.tags) {
      const colorPart = t.color ? ` (${t.color})` : '';
      lines.push(`- ${t.name}${colorPart}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
