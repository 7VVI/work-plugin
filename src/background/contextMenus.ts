import { autoFillService } from '../shared/services/autoFillService';
import { copyToClipboard } from '../shared/utils/clipboard';

export function setupContextMenus() {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({ id: 'save-current-site', title: '保存当前网站为内部系统', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'copy-system-info', title: '复制当前系统信息', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'fill-credentials', title: '自动填充账号密码', contexts: ['editable'] });
  });

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab?.url) return;
    switch (info.menuItemId) {
      case 'save-current-site':
        await openDashboardWithPrefill(tab);
        break;
      case 'copy-system-info':
        await copyMatchedSystemInfo(tab);
        break;
      case 'fill-credentials':
        await triggerAutoFill(tab);
        break;
    }
  });
}

async function openDashboardWithPrefill(tab: chrome.tabs.Tab) {
  const url = new URL(chrome.runtime.getURL('dashboard.html'));
  url.hash = `/systems/new?url=${encodeURIComponent(tab.url!)}&name=${encodeURIComponent(tab.title ?? '')}`;
  await chrome.tabs.create({ url: url.toString() });
}

async function copyMatchedSystemInfo(tab: chrome.tabs.Tab) {
  const system = await autoFillService.findSystemByUrl(tab.url!);
  if (!system) {
    chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon-48.png', title: 'Dock', message: '未找到匹配的系统' });
    return;
  }
  const info = `# ${system.name}\nURL: ${system.url}\n环境: ${system.environment}\n备注: ${system.remark ?? ''}`;
  await copyToClipboard(info);
}

async function triggerAutoFill(tab: chrome.tabs.Tab) {
  const accounts = await autoFillService.findAccountsForUrl(tab.url!);
  if (accounts.length === 0) return;
  const payload = accounts.length === 1
    ? { systemId: accounts[0].systemId, systemName: accounts[0].systemName, account: accounts[0].account }
    : { picker: accounts };
  await chrome.tabs.sendMessage(tab.id!, { type: 'AUTO_FILL', payload });
}
