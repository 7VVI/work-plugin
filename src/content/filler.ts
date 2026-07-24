import type { LoginForm } from './detector';

export async function fillForm(form: LoginForm, account: { username: string; plainPassword: string }) {
  setNativeValue(form.usernameField, account.username);
  setNativeValue(form.passwordField, account.plainPassword);
  form.usernameField.dispatchEvent(new Event('input', { bubbles: true }));
  form.passwordField.dispatchEvent(new Event('input', { bubbles: true }));
  form.usernameField.dispatchEvent(new Event('change', { bubbles: true }));
  form.passwordField.dispatchEvent(new Event('change', { bubbles: true }));
}

function setNativeValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(el, value);
}

export function flashFilledIndicator() {
  const banner = document.createElement('div');
  banner.textContent = '✓ Dock 已填充';
  banner.style.cssText = `
    position: fixed; top: 16px; right: 16px; z-index: 2147483647;
    background: #10b981; color: white; padding: 8px 14px;
    border-radius: 6px; font-size: 13px; font-family: sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: opacity 0.3s;
  `;
  document.body.appendChild(banner);
  setTimeout(() => {
    banner.style.opacity = '0';
    setTimeout(() => banner.remove(), 300);
  }, 1500);
}
