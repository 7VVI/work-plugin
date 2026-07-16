import { setupContextMenus } from './contextMenus';
import { setupTabMonitor } from './tabMonitor';
import { setupCommands } from './commands';
import { setupMessaging } from './messaging';

setupContextMenus();
setupTabMonitor();
setupCommands();
setupMessaging();

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html#/onboarding') });
  }
});

console.log('[Nav Portal] background service worker started');
