import type { System, Server, Middleware, Tag, ConfigProject, Group } from '../types/entities';
import type { ParsedBackup } from './markdownParser';

export interface SerializeOptions {
  includePasswords: boolean;
}

interface BackupData {
  meta: { encrypted: boolean };
  systems: Array<System & { tags?: string[]; plainAccounts?: Array<{ role: string; username: string; password: string; isDefault?: boolean }> }>;
  servers: Array<Server & { tags?: string[]; plainPassword?: string }>;
  middlewares: Array<Middleware & { tags?: string[]; plainPassword?: string }>;
  projects: ConfigProject[];
  groups?: Group[];
  tags: Tag[];
}

function buildTable(headers: string[], rows: string[][]): string[] {
  const lines: string[] = [];
  lines.push(`| ${headers.join(' | ')} |`);
  lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
  for (const row of rows) {
    lines.push(`| ${row.map(c => (c ?? '').replace(/\|/g, '\\|')).join(' | ')} |`);
  }
  return lines;
}

export function serializeMarkdown(data: ParsedBackup | BackupData, options: SerializeOptions): string {
  const lines: string[] = [];

  // groupId → 分组名（用于在资产里以名称引用分组）
  const groupNameById = new Map<string, string>(
    ((data.groups as Array<{ id?: string; name?: string }>) ?? []).map(g => [g.id ?? '', g.name ?? '']),
  );
  const groupName = (id?: string) => (id ? (groupNameById.get(id) ?? '') : '');

  lines.push('---');
  lines.push('navPortalVersion: 1');
  lines.push(`exportedAt: ${new Date().toISOString()}`);
  lines.push(`encrypted: ${data.meta.encrypted}`);
  lines.push(`passwordsIncluded: ${options.includePasswords}`);
  lines.push('---');
  lines.push('');
  lines.push('# Dock Backup');
  lines.push('');

  if (data.systems.length > 0) {
    lines.push('## 系统');
    lines.push('');
    for (const s of data.systems) {
      lines.push(`### ${s.name}`);
      lines.push('');
      const rows: string[][] = [];
      if (s.url) rows.push(['URL', s.url]);
      if (s.environment) rows.push(['环境', s.environment]);
      if (s.icon) rows.push(['图标', s.icon]);
      if (s.color) rows.push(['颜色', s.color]);
      if (groupName(s.groupId)) rows.push(['分组', groupName(s.groupId)]);
      if (s.tags && s.tags.length > 0) rows.push(['标签', s.tags.join(', ')]);
      if (s.remark) rows.push(['备注', s.remark]);
      if (rows.length > 0) {
        lines.push(...buildTable(['字段', '值'], rows));
        lines.push('');
      }
      const plainAccounts = (s as any).plainAccounts as Array<{ role: string; username: string; password: string; isDefault?: boolean }> | undefined;
      if (plainAccounts && plainAccounts.length > 0) {
        lines.push('#### 账号');
        lines.push('');
        const accRows = plainAccounts.map(a => [
          a.role,
          a.username,
          options.includePasswords && a.password ? a.password : '********',
          a.isDefault ? '是' : '否',
        ]);
        lines.push(...buildTable(['角色', '用户名', '密码', '默认'], accRows));
        lines.push('');
      }
    }
  }

  if (data.servers.length > 0) {
    lines.push('## 服务器');
    lines.push('');
    for (const s of data.servers) {
      lines.push(`### ${s.name}`);
      lines.push('');
      const pwd = (s as any).plainPassword;
      const rows: string[][] = [];
      if (s.ip) rows.push(['IP', s.ip]);
      if (s.sshPort) rows.push(['SSH 端口', String(s.sshPort)]);
      if (s.username) rows.push(['账号', s.username]);
      rows.push(['密码', options.includePasswords && pwd ? pwd : '********']);
      if (s.environment) rows.push(['环境', s.environment]);
      if (groupName(s.groupId)) rows.push(['分组', groupName(s.groupId)]);
      if (s.purpose) rows.push(['用途', s.purpose]);
      if (s.remark) rows.push(['备注', s.remark]);
      if (rows.length > 0) {
        lines.push(...buildTable(['字段', '值'], rows));
        lines.push('');
      }
    }
  }

  if (data.middlewares.length > 0) {
    lines.push('## 中间件');
    lines.push('');
    for (const m of data.middlewares) {
      lines.push(`### ${m.name}`);
      lines.push('');
      const pwd = (m as any).plainPassword;
      const rows: string[][] = [];
      if (m.type) rows.push(['类型', m.type]);
      if (groupName(m.groupId)) rows.push(['分组', groupName(m.groupId)]);
      if (m.version) rows.push(['版本', m.version]);
      if (m.host) rows.push(['Host', m.host]);
      if (m.port) rows.push(['端口', String(m.port)]);
      if (m.database) rows.push(['数据库', m.database]);
      if (m.username) rows.push(['账号', m.username]);
      if (pwd || m.password) rows.push(['密码', options.includePasswords && pwd ? pwd : '********']);
      if (m.remark) rows.push(['备注', m.remark]);
      if (m.extra && Object.keys(m.extra).length > 0) {
        for (const [k, v] of Object.entries(m.extra)) {
          rows.push([`额外：${k}`, String(v)]);
        }
      }
      if (rows.length > 0) {
        lines.push(...buildTable(['字段', '值'], rows));
        lines.push('');
      }
    }
  }

  if (data.projects && data.projects.length > 0) {
    lines.push('## 配置');
    lines.push('');
    for (const p of data.projects) {
      lines.push(`### ${p.name}`);
      lines.push('');
      for (const c of p.configs) {
        lines.push(`#### ${c.name}`);
        lines.push('');
        const fieldRows = c.fields.map(f => [f.key ?? '', f.label ?? '', f.value ?? '']);
        if (fieldRows.length > 0) {
          lines.push(...buildTable(['字段标识', '字段名称', '默认值'], fieldRows));
          lines.push('');
        } else {
          lines.push(...buildTable(['字段标识', '字段名称', '默认值'], []));
          lines.push('');
        }
      }
    }
  }

  if (data.groups && data.groups.length > 0) {
    lines.push('## 分组');
    lines.push('');
    const rows = data.groups.map(g => [g.entityType ?? '', g.name ?? '', g.color ?? '']);
    lines.push(...buildTable(['类型', '名称', '颜色'], rows));
    lines.push('');
  }

  if (data.tags.length > 0) {
    lines.push('## 标签');
    lines.push('');
    const rows = data.tags.map(t => [t.name ?? '', t.color ?? '']);
    lines.push(...buildTable(['名称', '颜色'], rows));
    lines.push('');
  }

  return lines.join('\n');
}
