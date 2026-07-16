console.log('[Nav Portal] background service worker started');

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Nav Portal] first install');
  }
});
