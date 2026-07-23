export interface DockStats {
  systems: number;
  servers: number;
  middlewares: number;
  projects: number;
  configs: number;
  fields: number;
}

const PATH_MAP: Record<string, string> = {
  '/systems': 'dock://systems',
  '/servers': 'dock://servers',
  '/middlewares': 'dock://middleware',
  '/configs': 'dock://configs',
  '/import-export': 'dock://io',
  '/settings': 'dock://settings',
};

export function dockPathFor(routePath: string): string {
  return PATH_MAP[routePath] ?? 'dock://app';
}

export function subtitleFor(routePath: string, s: DockStats): string {
  switch (routePath) {
    case '/systems': return `共 ${s.systems} 个系统`;
    case '/servers': return `共 ${s.servers} 台服务器`;
    case '/middlewares': return `共 ${s.middlewares} 个实例`;
    case '/configs': return `${s.projects} 个项目 · ${s.configs} 个配置 · ${s.fields} 个字段`;
    case '/import-export': return 'JSON / Markdown 备份 · 本地存储';
    case '/settings': return '外观 · 安全 · 快捷键 · 关于';
    default: return '';
  }
}
