import { setupContextMenus } from './contextMenus';
import { setupTabMonitor } from './tabMonitor';
import { setupCommands } from './commands';
import { setupMessaging } from './messaging';
import { setupCloudHealth } from './cloudHealth';

setupContextMenus();
setupTabMonitor();
setupCommands();
setupMessaging();
setupCloudHealth();

console.log('[Dock] background service worker started');
