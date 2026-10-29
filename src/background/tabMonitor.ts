import { autoFillService } from '../shared/services/autoFillService';
import { updateBadgeForTab } from './iconBadge';
import type { AutoFillPayload } from '../shared/types/messages';

// 记录每个标签页最近一次“填充成功”对应的 URL。
// 以 URL 而不是 tabId 去重：同一标签页导航到新地址后允许再次填充。
const lastFilledUrlByTab = new Map<number, string>();

// 正在处理中的填充任务，防止 tabMonitor 与 PAGE_HAS_LOGIN_FORM 两条路径并发重复触发。
const inFlightAutoFills = new Set<string>();

export function setupTabMonitor() {
  chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete' || !tab.url) return;
    await checkTab(tab, true);
  });

  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      if (tab.url) await checkTab(tab, false);
    } catch {
      // 标签页已在读取前关闭（No tab with id），忽略
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    lastFilledUrlByTab.delete(tabId);
    for (const key of inFlightAutoFills) {
      if (key.startsWith(`${tabId}:`)) inFlightAutoFills.delete(key);
    }
  });
}

async function checkTab(tab: chrome.tabs.Tab, tryAutoFill: boolean) {
  try {
    const system = await autoFillService.findSystemByUrl(tab.url!);
    await updateBadgeForTab(tab, !!system, system ? `已收藏: ${system.name}` : undefined);
    if (system && tryAutoFill && tab.id !== undefined) {
      await tryAutoFillTab(tab.id, tab.url!);
    }
  } catch {
    await updateBadgeForTab(tab, false);
  }
}

/**
 * 统一的自动填充入口：tabMonitor 的页面加载事件和 content script 的
 * PAGE_HAS_LOGIN_FORM 消息都汇聚到这里。
 * - 按 (tabId, url) 去重，同一 URL 只填充一次，避免两条路径重复触发；
 * - 发送前/重试前校验标签页当前 URL，防止页面已导航后把旧账号填到新页面；
 * - 只有内容脚本确认真正填充成功后才记录去重标记，SPA 表单晚渲染时仍可再次触发。
 */
export async function tryAutoFillTab(tabId: number, url: string): Promise<void> {
  if (lastFilledUrlByTab.get(tabId) === url) return;

  const key = `${tabId}:${url}`;
  if (inFlightAutoFills.has(key)) return;
  inFlightAutoFills.add(key);

  try {
    const match = await autoFillService.findDefaultAccountForUrl(url);
    if (!match) {
      console.info('[Dock] 自动填充跳过：没有可用的默认账号', url);
      return;
    }

    const payload: AutoFillPayload = {
      systemId: match.systemId,
      systemName: match.systemName,
      account: match.account,
    };
    const filled = await sendAutoFillWithRetry(tabId, url, payload, 3, 600);
    if (filled) {
      lastFilledUrlByTab.set(tabId, url);
    }
  } finally {
    inFlightAutoFills.delete(key);
  }
}

/**
 * 发送 AUTO_FILL 消息并等待内容脚本确认。
 * 内容脚本未就绪（未注入）或页面表单尚未渲染时重试；
 * 发送前校验标签页仍停留在原 URL，避免把旧账号填进已导航的新页面。
 */
async function sendAutoFillWithRetry(
  tabId: number,
  url: string,
  payload: AutoFillPayload,
  maxRetries: number,
  intervalMs: number,
): Promise<boolean> {
  let attempts = 0;

  async function trySend(): Promise<boolean> {
    // 发送前确认标签页还停留在计算账号时的 URL，避免误填
    if (!(await tabStillOnUrl(tabId, url))) return false;

    attempts++;
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'AUTO_FILL', payload });
      if (response?.filled === true) return true;
      if (attempts < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
        return trySend();
      }
      return false;
    } catch {
      if (attempts < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
        return trySend();
      }
      return false;
    }
  }

  // 初始延迟，等待内容脚本注入完成
  await new Promise(resolve => setTimeout(resolve, 300));
  return trySend();
}

async function tabStillOnUrl(tabId: number, url: string): Promise<boolean> {
  try {
    const tab = await chrome.tabs.get(tabId);
    return tab.url === url;
  } catch {
    return false; // 标签页已关闭
  }
}
