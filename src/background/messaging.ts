import { autoFillService } from '../shared/services/autoFillService';
import { recentRepo } from '../shared/db/repositories/recentRepo';
import { cryptoService } from '../shared/services/cryptoService';
import { cryptoSession } from '../shared/crypto/session';
import type { Message, MessageResponse } from '../shared/types/messages';

export function setupMessaging() {
  chrome.runtime.onMessage.addListener((msg: Message, sender, sendResponse) => {
    handleMessage(msg, sender)
      .then((data) => sendResponse({ data } satisfies MessageResponse))
      .catch((err: Error) => sendResponse({ error: err.message } satisfies MessageResponse));
    return true;
  });
}

async function handleMessage(msg: Message, _sender: chrome.runtime.MessageSender): Promise<unknown> {
  switch (msg.type) {
    case 'GET_MATCHING_ACCOUNTS':
      return { accounts: await autoFillService.findAccountsForUrl(msg.url) };
    case 'GET_SYSTEM_FOR_URL':
      return { system: await autoFillService.findSystemByUrl(msg.url) };
    case 'RECORD_ACCESS':
      await recentRepo.touch(msg.entityType, msg.entityId, msg.role);
      return { ok: true };
    case 'PAGE_HAS_LOGIN_FORM':
      return { ok: true };
    case 'CRYPTO_KEY_SYNC':
      await cryptoService.setKeyFromBackground(msg.keyBytes);
      chrome.alarms.create('crypto-lock', { delayInMinutes: 5 });
      return { ok: true };
    case 'CRYPTO_ACTIVITY':
      chrome.alarms.clear('crypto-lock', () => {
        chrome.alarms.create('crypto-lock', { delayInMinutes: 5 });
      });
      return { ok: true };
    case 'LOCK_CRYPTO':
      cryptoSession.lock();
      await chrome.storage.session.remove('cryptoKey');
      chrome.alarms.clear('crypto-lock');
      return { ok: true };
    default:
      return { error: 'Unknown message type' };
  }
}

export async function triggerAutoFillFromCommand(tab: chrome.tabs.Tab) {
  const accounts = await autoFillService.findAccountsForUrl(tab.url!);
  if (accounts.length === 0) return;
  const payload = accounts.length === 1
    ? { systemId: accounts[0].systemId, systemName: accounts[0].systemName, account: accounts[0].account }
    : { picker: accounts };
  await chrome.tabs.sendMessage(tab.id!, { type: 'AUTO_FILL', payload });
}

// Alarm handler for auto-lock
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'crypto-lock') {
    cryptoSession.lock();
    await chrome.storage.session.remove('cryptoKey');
  }
});
