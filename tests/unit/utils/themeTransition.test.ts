import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  applyTheme,
  resolveTheme,
  switchTheme,
  resolvedTheme,
} from '../../../src/shared/utils/themeTransition';

function stubMatchMedia(dark: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('dark') && dark,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function originButton(x: number, y: number): HTMLElement {
  const el = document.createElement('button');
  el.getBoundingClientRect = () =>
    ({ left: x, top: y, width: 36, height: 36, right: x + 36, bottom: y + 36, x, y, toJSON: () => ({}) }) as DOMRect;
  return el;
}

describe('themeTransition', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('style');
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.className = '';
    delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves system theme by prefers-color-scheme', () => {
    stubMatchMedia(true);
    expect(resolveTheme('system')).toBe('dark');
    stubMatchMedia(false);
    expect(resolveTheme('system')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
    expect(resolveTheme('light')).toBe('light');
  });

  it('applies theme to document element and resolved ref', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(resolvedTheme.value).toBe('dark');
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(resolvedTheme.value).toBe('light');
  });

  it('falls back to surface fade when View Transitions are unavailable', async () => {
    vi.useFakeTimers();
    const apply = vi.fn(() => applyTheme('dark'));
    await switchTheme(apply, originButton(1200, 20));

    expect(apply).toHaveBeenCalledTimes(1);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.classList.contains('theme-fading')).toBe(true);
    expect(document.documentElement.style.getPropertyValue('--theme-x')).toBe('1218px');
    expect(document.documentElement.style.getPropertyValue('--theme-y')).toBe('38px');

    vi.advanceTimersByTime(400);
    expect(document.documentElement.classList.contains('theme-fading')).toBe(true);

    vi.advanceTimersByTime(400);
    expect(document.documentElement.classList.contains('theme-fading')).toBe(false);
  });

  it('runs the theme change inside a view transition and freezes surfaces meanwhile', async () => {
    let resolveFinished: () => void = () => {};
    const finished = new Promise<void>((r) => { resolveFinished = r; });
    const startViewTransition = vi.fn((update: () => void) => {
      update();
      return { finished, skipTransition: vi.fn() };
    });
    (document as unknown as { startViewTransition: unknown }).startViewTransition = startViewTransition;

    const apply = vi.fn(() => applyTheme('dark'));
    const pending = switchTheme(apply, originButton(1200, 20));

    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.classList.contains('theme-switching')).toBe(true);
    expect(document.documentElement.classList.contains('theme-fading')).toBe(false);

    resolveFinished();
    await pending;
    expect(document.documentElement.classList.contains('theme-switching')).toBe(false);
  });

  it('skips a running transition when switching again', async () => {
    const skipTransition = vi.fn();
    let resolveFinished: () => void = () => {};
    const finished = new Promise<void>((r) => { resolveFinished = r; });
    (document as unknown as { startViewTransition: unknown }).startViewTransition = vi.fn(() => ({
      finished,
      skipTransition,
    }));

    const first = switchTheme(() => applyTheme('dark'), originButton(1200, 20));
    const second = switchTheme(() => applyTheme('light'), originButton(1200, 20));
    expect(skipTransition).toHaveBeenCalledTimes(1);

    resolveFinished();
    await Promise.all([first, second]);
  });
});
