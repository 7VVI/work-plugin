export function isValidUrl(url: string): boolean {
  try { new URL(url); return true; } catch { return false; }
}

const HTTP_LIKE_PROTOCOLS = new Set(['http:', 'https:']);

function isHttpLike(url: URL): boolean {
  return HTTP_LIKE_PROTOCOLS.has(url.protocol);
}

export interface UrlMatchDetail {
  /** 匹配精确度，越大越精确 */
  score: number;
  /** 协议是否一致；http/https 跨协议仍算匹配，仅在得分并列时参与区分 */
  protocolMatch: boolean;
  /** 保存 URL 中的查询参数是否都出现在标签页 URL 中，仅在得分并列时参与区分 */
  queryMatch: boolean;
}

function normalizePathname(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

function segmentCount(pathname: string): number {
  return pathname.split('/').filter(Boolean).length;
}

interface PathMatch {
  exact: boolean;
  depth: number;
}

/**
 * 路径按“段”比较：/app 只匹配 /app 与 /app/xxx，不会匹配 /app2。
 */
function matchPath(targetPath: string, savedPath: string): PathMatch | null {
  if (savedPath === '/') return { exact: false, depth: 0 };
  if (targetPath === savedPath) return { exact: true, depth: segmentCount(savedPath) };
  if (targetPath.startsWith(`${savedPath}/`)) return { exact: false, depth: segmentCount(savedPath) };
  return null;
}

/**
 * SPA 的 hash 路由（#/app、#!/app）参与匹配；普通锚点（#section）忽略。
 */
function getHashRoute(url: URL): string | null {
  const raw = url.hash.startsWith('#!')
    ? url.hash.slice(2)
    : url.hash.startsWith('#/')
      ? url.hash.slice(1)
      : '';
  if (!raw) return null;
  const route = raw.split('?')[0] ?? '';
  return normalizePathname(route || '/');
}

function savedQueryMatches(target: URL, saved: URL): boolean {
  for (const [key, value] of saved.searchParams) {
    if (!target.searchParams.getAll(key).includes(value)) return false;
  }
  return true;
}

/**
 * 返回系统 URL 与标签页 URL 的匹配详情，null 表示不匹配。
 *
 * 匹配规则：
 *   - host（hostname + 端口）必须完全一致，避免同 IP 不同端口互相误匹配；
 *   - 路径按段边界匹配，保存的路径越深得分越高；
 *   - 保存了 hash 路由（#/app）时要求标签页 hash 路由同样匹配；
 *   - http/https 视为同站但仍标记协议，查询参数/scheme 仅在得分并列时区分。
 */
export function matchUrl(tabUrl: string, systemUrl: string): UrlMatchDetail | null {
  try {
    const target = new URL(tabUrl);
    const saved = new URL(systemUrl);

    if (target.host !== saved.host) return null;

    const httpLike = isHttpLike(target) && isHttpLike(saved);
    if (!httpLike && target.protocol !== saved.protocol) return null;

    const pathMatch = matchPath(normalizePathname(target.pathname), normalizePathname(saved.pathname));
    if (!pathMatch) return null;

    const savedRoute = getHashRoute(saved);
    let routeMatch: PathMatch | null = null;
    if (savedRoute && savedRoute !== '/') {
      const targetRoute = getHashRoute(target);
      if (!targetRoute) return null;
      routeMatch = matchPath(targetRoute, savedRoute);
      if (!routeMatch) return null;
    }

    let score = 1;
    if (pathMatch.depth > 0) score += 100 + pathMatch.depth * 10 + (pathMatch.exact ? 1 : 0);
    if (routeMatch && routeMatch.depth > 0) score += 50 + routeMatch.depth * 10 + (routeMatch.exact ? 1 : 0);
    if (target.href === saved.href) score += 1000;

    const savedParams = [...saved.searchParams];
    const queryMatch = savedQueryMatches(target, saved);
    if (queryMatch && savedParams.length > 0) score += savedParams.length;

    return {
      score,
      protocolMatch: target.protocol === saved.protocol,
      queryMatch,
    };
  } catch {
    return null;
  }
}

export function urlMatchScore(tabUrl: string, systemUrl: string): number {
  return matchUrl(tabUrl, systemUrl)?.score ?? 0;
}

export function urlMatchesSystem(tabUrl: string, systemUrl: string): boolean {
  return matchUrl(tabUrl, systemUrl) !== null;
}

/**
 * 只比较 host（含端口）与协议大类，忽略路径和 hash。
 * 用于登录页/SPA 路由与系统保存地址不同时的兜底匹配：
 * 例如系统保存 /system/user，登录页实际是 /user/login。
 */
export function hostMatchesSystem(tabUrl: string, systemUrl: string): boolean {
  try {
    const target = new URL(tabUrl);
    const saved = new URL(systemUrl);
    if (target.host !== saved.host) return false;
    const httpLike = isHttpLike(target) && isHttpLike(saved);
    return httpLike || target.protocol === saved.protocol;
  } catch {
    return false;
  }
}

export function getHostname(url: string): string | null {
  try { return new URL(url).hostname; } catch { return null; }
}
