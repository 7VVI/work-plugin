import type { AccountMatch } from '../shared/types/messages';
import type { LoginForm } from './detector';
import { fillForm, flashFilledIndicator } from './filler';

export function showAccountPicker(accounts: AccountMatch[], forms: LoginForm[]) {
  const host = document.createElement('div');
  host.id = 'nav-portal-picker-host';
  host.style.cssText = 'position: fixed; top: 16px; right: 16px; z-index: 2147483647;';
  const shadow = host.attachShadow({ mode: 'closed' });

  shadow.innerHTML = `
    <style>
      .panel { background: white; border: 1px solid #e5e7eb; border-radius: 8px;
               box-shadow: 0 8px 24px rgba(0,0,0,0.15); padding: 8px; min-width: 240px;
               font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
      .title { font-size: 12px; color: #6b7280; padding: 4px 8px; }
      .item { display: flex; align-items: center; gap: 8px; padding: 8px;
              border-radius: 6px; cursor: pointer; font-size: 13px; color: #111827; }
      .item:hover { background: #f3f4f6; }
      .role { font-size: 11px; padding: 1px 6px; border-radius: 3px; background: #eff6ff; color: #1d4ed8; }
    </style>
    <div class="panel">
      <div class="title">选择要填充的账号</div>
      ${accounts.map((a, i) => `
        <div class="item" data-idx="${i}">
          <span class="role">${a.account.role}</span>
          <span>${a.account.username}</span>
        </div>
      `).join('')}
    </div>
  `;

  document.body.appendChild(host);

  shadow.querySelectorAll<HTMLElement>('.item').forEach(item => {
    item.addEventListener('click', async () => {
      const idx = Number(item.dataset.idx);
      const chosen = accounts[idx];
      await fillForm(forms[0], chosen.account);
      flashFilledIndicator();
      host.remove();
    });
  });

  setTimeout(() => {
    document.addEventListener('click', function handler(e: MouseEvent) {
      if (!host.contains(e.target as Node)) {
        host.remove();
        document.removeEventListener('click', handler);
      }
    });
  }, 100);

  document.addEventListener('keydown', function handler(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      host.remove();
      document.removeEventListener('keydown', handler);
    }
  });
}
