import { detectLoginForm } from './detector';
import { fillForm, flashFilledIndicator } from './filler';
import { showAccountPicker } from './accountPicker';
import { listenForMessages } from './bridge';

let hasNotifiedBackground = false;
let fillAttempted = false;

/**
 * Notify background that a login form exists on this page.
 * Background will then send AUTO_FILL if applicable.
 */
function notifyBackgroundOfLoginForm() {
  if (hasNotifiedBackground) return;
  const forms = detectLoginForm();
  if (forms.length > 0) {
    hasNotifiedBackground = true;
    chrome.runtime.sendMessage({ type: 'PAGE_HAS_LOGIN_FORM', count: forms.length });
  }
}

// On script load (document_idle), check immediately since DOMContentLoaded already fired
notifyBackgroundOfLoginForm();

// Also listen for DOMContentLoaded in case script loads early
window.addEventListener('DOMContentLoaded', () => {
  notifyBackgroundOfLoginForm();
});

// MutationObserver: watch for dynamically rendered login forms (SPA)
const observer = new MutationObserver(() => {
  notifyBackgroundOfLoginForm();
});
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
});
// Stop observing after 10 seconds to avoid performance impact
setTimeout(() => observer.disconnect(), 10000);

listenForMessages(async (msg) => {
  if (msg.type !== 'AUTO_FILL' || !msg.payload) return;
  if (fillAttempted) return; // Prevent double-fill

  // Try to detect forms, with a short retry for SPA rendering
  let forms = detectLoginForm();
  if (forms.length === 0) {
    // Wait a bit and retry - form might still be rendering
    await new Promise(resolve => setTimeout(resolve, 300));
    forms = detectLoginForm();
  }
  if (forms.length === 0) return;

  fillAttempted = true;
  const payload = msg.payload;
  if ('picker' in payload) {
    showAccountPicker(payload.picker, forms);
  } else {
    await fillForm(forms[0], payload.account);
    flashFilledIndicator();
  }
});
