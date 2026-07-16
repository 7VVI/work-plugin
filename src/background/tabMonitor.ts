import { autoFillService } from '../shared/services/autoFillService';
import { updateBadgeForTab } from './iconBadge';

export function setupTabMonitor() {
  chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete' || !tab.url) return;
    await checkTab(tab);
  });

  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) await checkTab(tab);
  });
}

async function checkTab(tab: chrome.tabs.Tab) {
  try {
    const system = await autoFillService.findSystemByUrl(tab.url!);
    await updateBadgeForTab(tab, !!system, system ? `已收藏: ${system.name}` : undefined);
  } catch {
    await updateBadgeForTab(tab, false);
  }
}
