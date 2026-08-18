import type { Message, AutoFillPayload } from '../shared/types/messages';

export function listenForMessages(
  handler: (msg: Message & { payload?: AutoFillPayload }, respond: (response?: unknown) => void) => void,
) {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    handler(msg, sendResponse);
    // 保持消息通道打开，允许异步响应填充结果
    return true;
  });
}
