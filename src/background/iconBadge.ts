export async function updateBadgeForTab(tab: chrome.tabs.Tab, matched: boolean, label?: string) {
  try {
    if (matched) {
      await chrome.action.setBadgeText({ text: '★', tabId: tab.id });
      await chrome.action.setBadgeBackgroundColor({ color: '#2563eb', tabId: tab.id });
      await chrome.action.setTitle({ title: label || '已收藏', tabId: tab.id });
    } else {
      await chrome.action.setBadgeText({ text: '', tabId: tab.id });
    }
  } catch {
    // 标签页可能已关闭，忽略 No tab with id 类错误
  }
}
