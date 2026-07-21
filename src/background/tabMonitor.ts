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
        // Retry mechanism: try sending multiple times to handle content script injection delay
        sendAutoFillWithRetry(tab.id, {
          type: 'AUTO_FILL',
          payload: {
            systemId: match.systemId,
            systemName: match.systemName,
            account: match.account,
          },
        }, 3, 600);
      }
    }
  } catch {
    await updateBadgeForTab(tab, false);
  }
}

/**
 * Send AUTO_FILL message with retry logic.
 * Retries if content script is not ready or form not yet rendered.
 */
function sendAutoFillWithRetry(
  tabId: number,
  message: { type: string; payload: unknown },
  maxRetries: number,
  intervalMs: number,
) {
  let attempts = 0;

  function trySend() {
    attempts++;
    chrome.tabs.sendMessage(tabId, message).catch(() => {
      if (attempts < maxRetries) {
        setTimeout(trySend, intervalMs);
      }
    });
  }

  // Initial delay to allow content script injection
  setTimeout(trySend, 500);
}

chrome.tabs.onRemoved.addListener((tabId) => {
  autoFilledTabs.delete(tabId);
});
