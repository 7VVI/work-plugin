import { detectLoginForm } from './detector';
import { fillForm, flashFilledIndicator } from './filler';
import { showAccountPicker } from './accountPicker';
import { listenForMessages } from './bridge';

window.addEventListener('DOMContentLoaded', () => {
  const forms = detectLoginForm();
  if (forms.length > 0) {
    chrome.runtime.sendMessage({ type: 'PAGE_HAS_LOGIN_FORM', count: forms.length });
  }
});

listenForMessages(async (msg) => {
  if (msg.type !== 'AUTO_FILL' || !msg.payload) return;
  const forms = detectLoginForm();
  if (forms.length === 0) return;

  const payload = msg.payload;
  if ('picker' in payload) {
    showAccountPicker(payload.picker, forms);
  } else {
    await fillForm(forms[0], payload.account);
    flashFilledIndicator();
  }
});
