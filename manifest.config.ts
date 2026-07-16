import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'Nav Portal',
  version: pkg.version,
  description: pkg.description,
  default_locale: 'zh_CN',
  action: {
    default_popup: 'popup.html',
    default_title: 'Nav Portal',
    default_icon: {
      '16': 'icons/icon-16.png',
      '32': 'icons/icon-32.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png',
    },
  },
  icons: {
    '16': 'icons/icon-16.png',
    '48': 'icons/icon-48.png',
    '128': 'icons/icon-128.png',
  },
  options_ui: {
    page: 'dashboard.html',
    open_in_tab: true,
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
  commands: {
    'auto-fill-current': {
      suggested_key: {
        default: 'Ctrl+Shift+L',
        mac: 'Command+Shift+L',
      },
      description: 'Auto-fill credentials on current page',
    },
    _execute_action: {
      suggested_key: {
        default: 'Ctrl+Shift+K',
        mac: 'Command+Shift+K',
      },
    },
  },
  permissions: [
    'storage',
    'contextMenus',
    'tabs',
    'clipboardWrite',
    'notifications',
    'commands',
    'alarms',
  ],
  host_permissions: ['<all_urls>'],
});
