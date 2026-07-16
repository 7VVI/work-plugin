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
    if (pwd.hidden || pwd.disabled) continue;
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

function findUsernameField(pwd: HTMLInputElement, form: HTMLFormElement | null): HTMLInputElement | null {
  const searchRoot = form || document;
  const candidates = Array.from(
    searchRoot.querySelectorAll<HTMLInputElement>('input[type="text"], input[type="email"], input:not([type])')
  );
  return candidates
    .filter(c => !c.hidden && !c.disabled)
    .filter(c => compareDocumentPosition(c, pwd) <= 0)
    .sort((a, b) => getDistance(b, pwd) - getDistance(a, pwd))[0] ?? null;
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
