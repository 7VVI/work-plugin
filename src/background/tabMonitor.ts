import { autoFillService } from '../shared/services/autoFillService';
import { updateBadgeForTab } from './iconBadge';

const autoFilledTabs = new Set<number>();

export function setupTabMonitor() {
  chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete' || !tab.url) return;
    await checkTab(tab, true);
  });

  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) await checkTab(tab, false);
  });
}

async function checkTab(tab: chrome.tabs.Tab, tryAutoFill: boolean) {
  try {
    const system = await autoFillService.findSystemByUrl(tab.url!);
    await updateBadgeForTab(tab, !!system, system ? `已收藏: ${system.name}` : undefined);
    if (system && tryAutoFill && tab.id !== undefined && !autoFilledTabs.has(tab.id)) {
      autoFilledTabs.add(tab.id);
      const match = await autoFillService.findDefaultAccountForUrl(tab.url!);
      if (match) {
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tab.id!, {
              type: 'AUTO_FILL',
              payload: {
                systemId: match.systemId,
                systemName: match.systemName,
                account: match.account,
              },
            });
          } catch {
            // content script not ready / no login form
          }
        }, 800);
      }
    }
  } catch {
    await updateBadgeForTab(tab, false);
  }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  autoFilledTabs.delete(tabId);
});
