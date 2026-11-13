import { ref } from 'vue';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const SWITCHING_CLASS = 'theme-switching';
const FADING_CLASS = 'theme-fading';
const FADE_MS = 640;

interface ViewTransition {
  finished: Promise<void>;
  skipTransition(): void;
}

type DocumentWithViewTransition = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => ViewTransition;
};

/** 实际生效的主题（system 会解析为 light/dark），图标等 UI 直接响应它。 */
export const resolvedTheme = ref<ResolvedTheme>('light');

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode === 'dark' ? 'dark' : 'light';
}

export function applyTheme(mode: ThemeMode): void {
  const next = resolveTheme(mode);
  resolvedTheme.value = next;
  document.documentElement.dataset.theme = next;
}

function setRevealOrigin(origin?: HTMLElement | null): void {
  const rect = origin?.getBoundingClientRect();
  const x = rect ? rect.left + rect.width / 2 : window.innerWidth - 44;
  const y = rect ? rect.top + rect.height / 2 : 28;
  const root = document.documentElement;
  root.style.setProperty('--theme-x', `${Math.round(x)}px`);
  root.style.setProperty('--theme-y', `${Math.round(y)}px`);
}

let active: ViewTransition | null = null;
let fadeTimer = 0;

function fadeSurfaces(apply: () => void): void {
  const root = document.documentElement;
  root.classList.add(FADING_CLASS);
  void root.offsetWidth;
  apply();
  window.clearTimeout(fadeTimer);
  fadeTimer = window.setTimeout(() => root.classList.remove(FADING_CLASS), FADE_MS);
}

/**
 * 切换主题：光圈从触发元素中心扩散露出新主题，不支持 View Transitions 时退化为表面颜色渐变。
 * apply 需同步改写主题，动画才能拿到切换前后的两份快照。
 */
export async function switchTheme(apply: () => void, origin?: HTMLElement | null): Promise<void> {
  setRevealOrigin(origin);
  const root = document.documentElement;
  const doc = document as DocumentWithViewTransition;

  if (typeof doc.startViewTransition !== 'function' || document.hidden) {
    fadeSurfaces(apply);
    return;
  }

  active?.skipTransition();
  root.classList.add(SWITCHING_CLASS);
  let transition: ViewTransition;
  try {
    transition = doc.startViewTransition(() => {
      apply();
    });
  } catch {
    // 文档在切换瞬间不可见等情况下浏览器会拒绝开启过渡，直接退回渐变
    root.classList.remove(SWITCHING_CLASS);
    fadeSurfaces(apply);
    return;
  }
  active = transition;
  try {
    await transition.finished;
  } catch {
    /* 被下一次切换打断 */
  } finally {
    if (active === transition) {
      active = null;
      root.classList.remove(SWITCHING_CLASS);
    }
  }
}
