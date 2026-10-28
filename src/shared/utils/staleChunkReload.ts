const RELOAD_GUARD_KEY = 'dock.staleChunkReloadAt';
const RELOAD_GUARD_MS = 10_000;

const STALE_CHUNK_PATTERN =
  /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|outdated optimize dep/i;

/** 判断错误是否是"页面里的旧 chunk 已经不存在" */
export function isStaleChunkError(reason: unknown): boolean {
  const message = reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason ?? '');
  return STALE_CHUNK_PATTERN.test(message);
}

/**
 * 扩展/面板重新构建后，旧页面里残留的 chunk 文件名已不存在，
 * 动态 import 会以 "Failed to fetch dynamically imported module" 失败。
 * 这里在捕获到这类错误时自动刷新一次（10 秒内不重复刷新，避免死循环）。
 */
export function reloadOnStaleChunk(reason: unknown): void {
  if (!isStaleChunkError(reason)) return;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0);
    if (Number.isFinite(last) && Date.now() - last < RELOAD_GUARD_MS) return;
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    // 无法访问 sessionStorage 时直接刷新
  }
  window.location.reload();
}

export function installStaleChunkReload(): void {
  window.addEventListener('vite:preloadError', event => {
    event.preventDefault();
    reloadOnStaleChunk((event as unknown as { payload?: unknown }).payload);
  });
  window.addEventListener('unhandledrejection', event => {
    reloadOnStaleChunk(event.reason);
  });
}
