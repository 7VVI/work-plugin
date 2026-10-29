export interface LoginForm {
  form: HTMLFormElement | null;
  usernameField: HTMLInputElement;
  passwordField: HTMLInputElement;
  submitButton?: HTMLElement;
}

export function detectLoginForm(): LoginForm[] {
  const passwordFields = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="password"]')
  );
  const results: LoginForm[] = [];

  for (const pwd of passwordFields) {
    if (!isFillable(pwd)) continue;
    const form = pwd.closest('form');
    const usernameField = findUsernameField(pwd, form);
    if (usernameField) {
      results.push({
        form,
        usernameField,
        passwordField: pwd,
        submitButton: findSubmitButton(form),
      });
    }
  }
  return results;
}

/** 隐藏/禁用的输入框不能算登录字段（SPA 常放 0×0 的占位 input） */
function isFillable(el: HTMLInputElement): boolean {
  if (el.hidden || el.disabled || el.type === 'hidden') return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function findUsernameField(pwd: HTMLInputElement, form: HTMLFormElement | null): HTMLInputElement | null {
  const searchRoot = form || document;
  const candidates = Array.from(
    searchRoot.querySelectorAll<HTMLInputElement>(
      'input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input:not([type])',
    ),
  );
  return candidates
    .filter(isFillable)
    .filter(c => compareDocumentPosition(c, pwd) <= 0)
    .sort((a, b) => getDistance(a, pwd) - getDistance(b, pwd))[0] ?? null;
}

function findSubmitButton(form: HTMLFormElement | null): HTMLElement | undefined {
  if (form) {
    const btn = form.querySelector<HTMLButtonElement>('button[type="submit"], button:not([type])');
    if (btn) return btn;
  }
  return document.querySelector<HTMLButtonElement>('button[type="submit"]') ?? undefined;
}

function compareDocumentPosition(a: Node, b: Node): number {
  if (a === b) return 0;
  const position = a.compareDocumentPosition(b);
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
}

function getDistance(a: Element, b: Element): number {
  const rectA = a.getBoundingClientRect();
  const rectB = b.getBoundingClientRect();
  return Math.abs(rectA.top - rectB.top) + Math.abs(rectA.left - rectB.left);
}
