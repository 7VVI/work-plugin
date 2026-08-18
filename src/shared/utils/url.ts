export function isValidUrl(url: string): boolean {
  try { new URL(url); return true; } catch { return false; }
}

const HTTP_LIKE_PROTOCOLS = new Set(['http:', 'https:']);

function isHttpLike(url: URL): boolean {
  return HTTP_LIKE_PROTOCOLS.has(url.protocol);
}

/**
 * 返回系统 URL 与标签页 URL 的匹配得分，0 表示不匹配。
 * 分数越高代表匹配越精确：
 *   - 3: 完整 URL 完全一致
 *   - 2: 协议、host(hostname+port) 一致，且标签页路径以系统路径开头
 *   - 1: 协议、host 一致，系统未指定路径（根路径）
 * http/https 视为同站（保留原有行为），其余协议要求完全一致。
 * 注意：端口参与匹配，避免 localhost:3000 与 localhost:8080 互相误匹配。
 */
export function urlMatchScore(tabUrl: string, systemUrl: string): number {
  try {
    const target = new URL(tabUrl);
    const saved = new URL(systemUrl);

    // host 同时包含 hostname 和端口，必须完全一致
    if (target.host !== saved.host) return 0;

    if (!isHttpLike(target) || !isHttpLike(saved)) {
      if (target.protocol !== saved.protocol) return 0;
    }

    if (target.href === saved.href) return 3;

    const savedPath = saved.pathname === '/' ? '' : saved.pathname;
    if (savedPath) {
      return target.pathname.startsWith(savedPath) ? 2 : 0;
    }
    return 1;
  } catch {
    return 0;
  }
}

export function urlMatchesSystem(tabUrl: string, systemUrl: string): boolean {
  return urlMatchScore(tabUrl, systemUrl) > 0;
}

export function getHostname(url: string): string | null {
  try { return new URL(url).hostname; } catch { return null; }
}
