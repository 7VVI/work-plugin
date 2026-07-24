import { setupContextMenus } from './contextMenus';
import { setupTabMonitor } from './tabMonitor';
import { setupCommands } from './commands';
import { setupMessaging } from './messaging';

setupContextMenus();
setupTabMonitor();
setupCommands();
setupMessaging();

console.log('[Dock] background service worker started');
