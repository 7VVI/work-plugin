import type { Message, AutoFillPayload } from '../shared/types/messages';

export function listenForMessages(handler: (msg: Message & { payload?: AutoFillPayload }) => void) {
  chrome.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
    handler(msg);
  });
}
