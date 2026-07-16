export function isValidUrl(url: string): boolean {
  try { new URL(url); return true; } catch { return false; }
}

export function urlMatchesSystem(tabUrl: string, systemUrl: string): boolean {
  try {
    const target = new URL(tabUrl);
    const saved = new URL(systemUrl);
    if (saved.hostname === target.hostname) return true;
    return target.href.startsWith(systemUrl);
  } catch { return false; }
}

export function getHostname(url: string): string | null {
  try { return new URL(url).hostname; } catch { return null; }
}
