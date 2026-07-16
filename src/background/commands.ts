import { triggerAutoFillFromCommand } from './messaging';

export function setupCommands() {
  chrome.commands.onCommand.addListener(async (command) => {
    if (command !== 'auto-fill-current') return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;
    await triggerAutoFillFromCommand(tab);
  });
}
