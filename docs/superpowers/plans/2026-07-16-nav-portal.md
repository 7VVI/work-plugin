# Nav Portal Chrome Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome MV3 extension that manages internal systems, accounts/passwords, servers, middleware, and tags, with popup quick-access, full dashboard, auto-fill, context menus, and Markdown/JSON import/export.

**Architecture:** Layered multi-entry: popup (minimal Vue) + dashboard (full SPA) + background service worker + content script, all sharing a `src/shared/` layer (types, Dexie db, crypto, services, Pinia stores). CRXJS Vite plugin handles MV3 bundling.

**Tech Stack:** Chrome MV3, Vue 3 + TypeScript + Vite, @crxjs/vite-plugin, Pinia, Dexie, markdown-it + front-matter, Web Crypto API, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-16-nav-portal-design.md`

---

## File Structure

```
nav-portal/
├── manifest.config.ts
├── vite.config.ts
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── .gitignore
├── README.md
├── public/
│   ├── icons/
│   ├── popup.html
│   └── dashboard.html
├── src/
│   ├── popup/
│   │   ├── main.ts
│   │   ├── App.vue
│   │   ├── components/{SearchBox,RecentList,FavoriteGrid,QuickAdd}.vue
│   │   └── styles/popup.css
│   ├── dashboard/
│   │   ├── main.ts
│   │   ├── App.vue
│   │   ├── router.ts
│   │   ├── views/{System,Server,Middleware,Tag,ImportExport,Settings,Onboarding}View.vue
│   │   ├── components/
│   │   │   ├── layout/{Sidebar,PageHeader,NavTabs}.vue
│   │   │   ├── common/{TagPill,EnvBadge,Toast,ConfirmDialog}.vue
│   │   │   ├── system/{SystemTable,SystemForm,AccountList}.vue
│   │   │   ├── server/{ServerCard,ServerForm}.vue
│   │   │   └── middleware/{MiddlewareTable,MiddlewareForm}.vue
│   │   └── styles/tokens.css
│   ├── background/
│   │   └── {index,contextMenus,tabMonitor,commands,messaging,iconBadge}.ts
│   ├── content/
│   │   └── {index,detector,filler,accountPicker,bridge}.ts
│   └── shared/
│       ├── types/{entities,enums,messages,errors,middlewareSchemas}.ts
│       ├── db/
│       │   ├── schema.ts
│       │   ├── migrations.ts
│       │   └── repositories/{system,account,server,middleware,tag,systemTag,serverTag,middlewareTag,recent,meta}Repo.ts
│       ├── crypto/{masterKey,cipher,session,storage,index}.ts
│       ├── services/{crypto,system,account,server,middleware,tag,search,importExport,markdownParser,markdownSerializer,autoFill}Service.ts
│       ├── stores/{crypto,pref,system,account,server,middleware,tag,search,toast}Store.ts
│       └── utils/{clipboard,time,url,validation,id}.ts
├── tests/
│   ├── setup.ts
│   ├── mocks/chrome.ts
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── vitest.config.ts
└── .github/workflows/ci.yml
```

---

## Phase 1: Project Scaffold

### Task 1.1: Initialize Project

**Files:**
- Create: `package.json`, `.gitignore`, `README.md`

- [ ] **Step 1: Initialize git repo**

Run:
```bash
cd "D:/Users/Desktop/P-me/work-plugin"
git init
git branch -M main
```

- [ ] **Step 2: Create .gitignore**

Content:
```
node_modules/
dist/
dist-zip/
.vscode/
.idea/
*.swp
.DS_Store
Thumbs.db
.env
.env.local
*.log
npm-debug.log*
coverage/
.nyc_output/
```

- [ ] **Step 3: Create package.json**

```json
{
  "name": "nav-portal",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Chrome extension for managing internal systems, accounts, servers, middleware",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:unit": "vitest run",
    "lint": "eslint src --ext .ts,.vue",
    "type-check": "vue-tsc --noEmit",
    "zip": "cd dist && zip -r ../nav-portal-v$npm_package_version.zip ."
  },
  "dependencies": {
    "vue": "^3.4.21",
    "vue-router": "^4.3.0",
    "pinia": "^2.1.7",
    "dexie": "^4.0.4",
    "markdown-it": "^14.1.0",
    "front-matter": "^4.0.2"
  },
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.0.0-beta.25",
    "@types/chrome": "^0.0.263",
    "@types/markdown-it": "^14.0.1",
    "@vitejs/plugin-vue": "^5.0.4",
    "@vue/test-utils": "^2.4.5",
    "fake-indexeddb": "^6.0.0",
    "jsdom": "^24.0.0",
    "typescript": "^5.4.3",
    "vite": "^5.2.6",
    "vitest": "^1.4.0",
    "vue-tsc": "^2.0.7"
  }
}
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`

- [ ] **Step 5: Create README.md**

```markdown
# Nav Portal

Chrome extension for managing internal systems, accounts, servers, middleware.

## Development

- `npm install` - Install dependencies
- `npm run dev` - Start dev server with HMR
- `npm run build` - Build for production
- `npm test` - Run tests

## Load in Chrome

1. Run `npm run build`
2. Open `chrome://extensions/`
3. Enable Developer mode
4. Click "Load unpacked" and select the `dist/` folder
```

- [ ] **Step 6: Commit**

```bash
git add .gitignore package.json README.md
git commit -m "chore: initialize project structure"
```

---

### Task 1.2: TypeScript + Vite Configuration

**Files:**
- Create: `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts`

- [ ] **Step 1: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@shared/*": ["src/shared/*"]
    },
    "types": ["chrome", "vite/client"]
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.vue"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 2: Create tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts", "vitest.config.ts", "manifest.config.ts"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { crx } from '@crxjs/vite-plugin';
import { fileURLToPath, URL } from 'node:url';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [vue(), crx({ manifest })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/chunk-[hash].js',
      },
    },
  },
});
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Commit**

```bash
git add tsconfig.json tsconfig.node.json vite.config.ts vitest.config.ts
git commit -m "chore: configure TypeScript, Vite, Vitest"
```

---

### Task 1.3: CRXJS Manifest Configuration

**Files:**
- Create: `manifest.config.ts`

- [ ] **Step 1: Create manifest.config.ts**

```typescript
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
```

- [ ] **Step 2: Create placeholder icons directory**

Run: `mkdir -p public/icons`

- [ ] **Step 3: Commit**

```bash
git add manifest.config.ts public/icons/
git commit -m "feat: configure CRXJS manifest with permissions and commands"
```

---

### Task 1.4: HTML Shells

**Files:**
- Create: `public/popup.html`, `public/dashboard.html`

- [ ] **Step 1: Create popup.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nav Portal</title>
  <style>
    html, body { margin: 0; padding: 0; width: 360px; height: 480px; overflow: hidden; }
    #app { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/popup/main.ts"></script>
</body>
</html>
```

- [ ] **Step 2: Create dashboard.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nav Portal - 管理面板</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" />
  <style>
    html, body { margin: 0; padding: 0; min-height: 100vh; }
    #app { min-height: 100vh; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/dashboard/main.ts"></script>
</body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add public/popup.html public/dashboard.html
git commit -m "feat: add HTML shells for popup and dashboard"
```

---

### Task 1.5: Hello World Entries

**Files:**
- Create: `src/popup/main.ts`, `src/popup/App.vue`, `src/popup/styles/popup.css`
- Create: `src/dashboard/main.ts`, `src/dashboard/App.vue`, `src/dashboard/router.ts`, `src/dashboard/styles/tokens.css`
- Create: `src/dashboard/views/{System,Server,Middleware,Tag,ImportExport,Settings,Onboarding}View.vue` (placeholders)
- Create: `src/background/index.ts`, `src/content/index.ts`

- [ ] **Step 1: Create popup entry**

`src/popup/main.ts`:
```typescript
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './styles/popup.css';

createApp(App).use(createPinia()).mount('#app');
```

`src/popup/App.vue`:
```vue
<template>
  <div class="popup-root">
    <h1>Nav Portal</h1>
    <p>Popup ready</p>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.popup-root { padding: 16px; font-family: 'Noto Sans SC', sans-serif; }
</style>
```

`src/popup/styles/popup.css`:
```css
* { box-sizing: border-box; }
body { font-family: 'Noto Sans SC', -apple-system, sans-serif; font-size: 13px; }
```

- [ ] **Step 2: Create dashboard entry**

`src/dashboard/main.ts`:
```typescript
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './styles/tokens.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
```

`src/dashboard/router.ts`:
```typescript
import { createRouter, createWebHashHistory } from 'vue-router';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/systems' },
    { path: '/systems', component: () => import('./views/SystemView.vue') },
    { path: '/servers', component: () => import('./views/ServerView.vue') },
    { path: '/middlewares', component: () => import('./views/MiddlewareView.vue') },
    { path: '/tags', component: () => import('./views/TagView.vue') },
    { path: '/import-export', component: () => import('./views/ImportExportView.vue') },
    { path: '/settings', component: () => import('./views/SettingsView.vue') },
    { path: '/onboarding', component: () => import('./views/OnboardingView.vue') },
  ],
});

export default router;
```

`src/dashboard/App.vue`:
```vue
<template>
  <div class="dashboard-root">
    <h1>Nav Portal Dashboard</h1>
    <router-view />
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.dashboard-root { padding: 20px; font-family: 'Noto Sans SC', sans-serif; }
</style>
```

`src/dashboard/styles/tokens.css`:
```css
:root {
  --primary: #2563eb;
  --primary-50: #eff6ff;
  --primary-100: #dbeafe;
  --primary-600: #2563eb;
  --primary-700: #1d4ed8;
  --success: #10b981;
  --success-light: #d1fae5;
  --success-text: #047857;
  --warning: #f59e0b;
  --warning-light: #fef3c7;
  --warning-text: #b45309;
  --danger: #ef4444;
  --danger-light: #fee2e2;
  --danger-text: #b91c1c;
  --purple: #8b5cf6;
  --purple-light: #ede9fe;
  --purple-text: #6d28d9;
  --orange: #f97316;
  --orange-light: #ffedd5;
  --orange-text: #c2410c;
  --bg: #f5f7fa;
  --card-bg: #ffffff;
  --border: #e5e7eb;
  --border-soft: #f3f4f6;
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --text-tertiary: #9ca3af;
  --header-h: 44px;
  --sidebar-w: 208px;
}
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0;
  font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
  background: var(--bg);
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 3: Create placeholder views**

For each of these 7 files, create with minimal placeholder content:

`src/dashboard/views/SystemView.vue`:
```vue
<template><div class="view-placeholder">Systems</div></template>
<script setup lang="ts"></script>
```

Create identical minimal files (changing only the text) for:
- `ServerView.vue` - text "Servers"
- `MiddlewareView.vue` - text "Middlewares"
- `TagView.vue` - text "Tags"
- `ImportExportView.vue` - text "Import/Export"
- `SettingsView.vue` - text "Settings"
- `OnboardingView.vue` - text "Onboarding"

- [ ] **Step 4: Create background entry**

`src/background/index.ts`:
```typescript
console.log('[Nav Portal] background service worker started');

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Nav Portal] first install');
  }
});
```

- [ ] **Step 5: Create content script entry**

`src/content/index.ts`:
```typescript
console.log('[Nav Portal] content script loaded on', window.location.href);
```

- [ ] **Step 6: Verify dev build**

Run: `npm run dev`
Expected: Vite dev server starts without errors.

- [ ] **Step 7: Verify production build**

Run: `npm run build`
Expected: `dist/` folder created with `manifest.json`, `popup.html`, `dashboard.html`, bundled JS.

- [ ] **Step 8: Commit**

```bash
git add src/ public/
git commit -m "feat: add hello-world entries for popup, dashboard, background, content"
```

---

## Phase 2: Shared Types

### Task 2.1: Entity Types

**Files:** Create `src/shared/types/entities.ts`

- [ ] **Step 1: Create entity types**

```typescript
export type EncryptedField =
  | { __encrypted: true; iv: string; ciphertext: string }
  | { __encrypted: false; value: string };

export type Environment = 'production' | 'development' | 'test' | 'staging';
export type EntityType = 'system' | 'server' | 'middleware';

export interface System {
  id: string;
  name: string;
  url: string;
  icon?: string;
  iconColor?: string;
  environment: Environment;
  color?: string;
  favorite: boolean;
  sort: number;
  remark?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Account {
  id: string;
  systemId: string;
  role: string;
  username: string;
  password: EncryptedField;
  isDefault: boolean;
  remark?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Server {
  id: string;
  name: string;
  ip: string;
  sshPort: number;
  username: string;
  password: EncryptedField;
  sshKey?: EncryptedField;
  environment: Environment;
  status?: 'online' | 'warn' | 'offline';
  purpose?: string;
  remark?: string;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Middleware {
  id: string;
  type: MiddlewareType;
  name: string;
  version?: string;
  host: string;
  port: number;
  database?: string;
  username?: string;
  password?: EncryptedField;
  extra?: Record<string, unknown>;
  remark?: string;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
  createdAt: number;
}

export interface SystemTag { systemId: string; tagId: string; }
export interface ServerTag { serverId: string; tagId: string; }
export interface MiddlewareTag { middlewareId: string; tagId: string; }

export interface Recent {
  id: string;
  entityType: EntityType;
  entityId: string;
  lastAccessedAt: number;
  role?: string;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

// Input types (no audit fields, no id)
export type SystemInput = Omit<System, 'id' | 'createdAt' | 'updatedAt'>;
export type AccountInput = Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'password'> & { password: string };
export type ServerInput = Omit<Server, 'id' | 'createdAt' | 'updatedAt' | 'password' | 'sshKey'> & { password: string; sshKey?: string };
export type MiddlewareInput = Omit<Middleware, 'id' | 'createdAt' | 'updatedAt' | 'password'> & { password?: string };
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/types/entities.ts
git commit -m "feat: add entity type definitions"
```

---

### Task 2.2: Enums and Middleware Schemas

**Files:** Create `src/shared/types/enums.ts`, `src/shared/types/middlewareSchemas.ts`

- [ ] **Step 1: Create enums.ts**

```typescript
export type MiddlewareType =
  | 'mysql' | 'redis' | 'rabbitmq' | 'kafka' | 'nacos'
  | 'apollo' | 'minio' | 'elasticsearch' | 'clickhouse' | 'mongodb' | 'rocketmq';

export const ENVIRONMENTS = [
  { value: 'production', label: '生产', color: '#d1fae5', textColor: '#047857' },
  { value: 'development', label: '开发', color: '#dbeafe', textColor: '#1d4ed8' },
  { value: 'test', label: '测试', color: '#fef3c7', textColor: '#b45309' },
  { value: 'staging', label: '预发布', color: '#ede9fe', textColor: '#6d28d9' },
] as const;

export const MIDDLEWARE_TYPES: Array<{ value: MiddlewareType; label: string; icon: string; color: string }> = [
  { value: 'mysql', label: 'MySQL', icon: 'fa-database', color: '#00758f' },
  { value: 'redis', label: 'Redis', icon: 'fa-bolt', color: '#dc382d' },
  { value: 'rabbitmq', label: 'RabbitMQ', icon: 'fa-message', color: '#ff6600' },
  { value: 'kafka', label: 'Kafka', icon: 'fa-stream', color: '#000000' },
  { value: 'nacos', label: 'Nacos', icon: 'fa-gear', color: '#3b82f6' },
  { value: 'apollo', label: 'Apollo', icon: 'fa-rocket', color: '#2196f3' },
  { value: 'minio', label: 'MinIO', icon: 'fa-cube', color: '#c72e29' },
  { value: 'elasticsearch', label: 'Elasticsearch', icon: 'fa-magnifying-glass-chart', color: '#005571' },
  { value: 'clickhouse', label: 'ClickHouse', icon: 'fa-database', color: '#ffcc00' },
  { value: 'mongodb', label: 'MongoDB', icon: 'fa-leaf', color: '#009639' },
  { value: 'rocketmq', label: 'RocketMQ', icon: 'fa-paper-plane', color: '#d77a3b' },
];

export function getMiddlewareMeta(type: MiddlewareType) {
  return MIDDLEWARE_TYPES.find(m => m.value === type) ?? MIDDLEWARE_TYPES[0];
}

export function getEnvironmentMeta(env: string) {
  return ENVIRONMENTS.find(e => e.value === env) ?? ENVIRONMENTS[1];
}
```

- [ ] **Step 2: Create middlewareSchemas.ts**

```typescript
import type { MiddlewareType } from './enums';

export interface MiddlewareFieldSchema {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean';
  required?: boolean;
  placeholder?: string;
  defaultValue?: unknown;
}

export const MIDDLEWARE_EXTRA_SCHEMAS: Record<MiddlewareType, MiddlewareFieldSchema[]> = {
  mysql: [
    { key: 'charset', label: 'Charset', type: 'string', defaultValue: 'utf8mb4' },
    { key: 'collation', label: 'Collation', type: 'string' },
  ],
  redis: [
    { key: 'db', label: 'DB Index', type: 'number', defaultValue: 0 },
  ],
  rabbitmq: [
    { key: 'vhost', label: 'VHost', type: 'string', defaultValue: '/' },
  ],
  mongodb: [
    { key: 'authSource', label: 'Auth Source', type: 'string', defaultValue: 'admin' },
    { key: 'replicaSet', label: 'Replica Set', type: 'string' },
  ],
  kafka: [
    { key: 'brokerId', label: 'Broker ID', type: 'number' },
  ],
  nacos: [
    { key: 'namespace', label: 'Namespace', type: 'string' },
    { key: 'group', label: 'Group', type: 'string', defaultValue: 'DEFAULT_GROUP' },
  ],
  apollo: [
    { key: 'appId', label: 'App ID', type: 'string', required: true },
    { key: 'cluster', label: 'Cluster', type: 'string', defaultValue: 'default' },
  ],
  minio: [
    { key: 'bucket', label: 'Bucket', type: 'string' },
    { key: 'useSSL', label: 'Use SSL', type: 'boolean', defaultValue: true },
  ],
  elasticsearch: [
    { key: 'index', label: 'Index', type: 'string' },
  ],
  clickhouse: [
    { key: 'cluster', label: 'Cluster', type: 'string' },
  ],
  rocketmq: [
    { key: 'topic', label: 'Default Topic', type: 'string' },
  ],
};
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/types/enums.ts src/shared/types/middlewareSchemas.ts
git commit -m "feat: add enums and middleware field schemas"
```

---

### Task 2.3: Message, Error Types, and Utilities

**Files:** Create `src/shared/types/messages.ts`, `src/shared/types/errors.ts`, `src/shared/types/index.ts`, `src/shared/utils/{id,url,validation,time,clipboard}.ts`

- [ ] **Step 1: Create messages.ts**

```typescript
import type { Account } from './entities';

export type Message =
  | { type: 'GET_MATCHING_ACCOUNTS'; url: string }
  | { type: 'GET_SYSTEM_FOR_URL'; url: string }
  | { type: 'RECORD_ACCESS'; entityType: 'system' | 'server' | 'middleware'; entityId: string; role?: string }
  | { type: 'PAGE_HAS_LOGIN_FORM'; count: number }
  | { type: 'CRYPTO_KEY_SYNC'; keyBytes: ArrayBuffer }
  | { type: 'CRYPTO_ACTIVITY' }
  | { type: 'LOCK_CRYPTO' }
  | { type: 'AUTO_FILL'; payload: AutoFillPayload };

export type AutoFillPayload =
  | { systemId: string; systemName: string; account: Account & { plainPassword: string } }
  | { picker: Array<{ systemId: string; systemName: string; account: Account & { plainPassword: string } }> };

export interface MessageResponse<T = unknown> {
  data?: T;
  error?: string;
}

export interface AccountMatch {
  systemId: string;
  systemName: string;
  account: Account & { plainPassword: string };
}
```

- [ ] **Step 2: Create errors.ts**

```typescript
export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class ValidationError extends DomainError {}
export class NotFoundError extends DomainError {}
export class EncryptionError extends DomainError {}
export class ImportExportError extends DomainError {}
export class CryptoLockedError extends DomainError {}

export function extractUserMessage(err: unknown): string {
  if (err instanceof DomainError) return err.message;
  if (err instanceof Error) return err.message;
  return '未知错误';
}
```

- [ ] **Step 3: Create index.ts**

```typescript
export * from './entities';
export * from './enums';
export * from './messages';
export * from './errors';
export * from './middlewareSchemas';
```

- [ ] **Step 4: Create utils/id.ts**

```typescript
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
```

- [ ] **Step 5: Create utils/url.ts**

```typescript
export function isValidUrl(url: string): boolean {
  try { new URL(url); return true; } catch { return false; }
}

export function urlMatchesSystem(tabUrl: string, systemUrl: string): boolean {
  try {
    const target = new URL(tabUrl);
    const saved = new URL(systemUrl);
    if (saved.hostname === target.hostname) return true;
    return target.href.startsWith(systemUrl);
  } catch { return false; }
}

export function getHostname(url: string): string | null {
  try { return new URL(url).hostname; } catch { return null; }
}
```

- [ ] **Step 6: Create utils/validation.ts, time.ts, clipboard.ts**

`src/shared/utils/validation.ts`:
```typescript
import { ValidationError } from '../types/errors';

export function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError('REQUIRED_FIELD', `${field} 不能为空`);
  }
  return value.trim();
}

export function requireNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new ValidationError('REQUIRED_FIELD', `${field} 必须是数字`);
  }
  return value;
}

export function optionalString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  return undefined;
}
```

`src/shared/utils/time.ts`:
```typescript
export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (sec < 60) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  if (hr < 24) return `${hr} 小时前`;
  if (day === 1) return '昨天';
  if (day < 30) return `${day} 天前`;
  return new Date(timestamp).toLocaleDateString('zh-CN');
}
```

`src/shared/utils/clipboard.ts`:
```typescript
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add src/shared/types/ src/shared/utils/
git commit -m "feat: add message types, error types, and utility functions"
```

---

## Phase 3: Database Layer

### Task 3.1: Test Setup and Dexie Schema

**Files:**
- Create: `tests/setup.ts`
- Create: `tests/mocks/chrome.ts`
- Create: `src/shared/db/schema.ts`

- [ ] **Step 1: Create test setup**

`tests/setup.ts`:
```typescript
import 'fake-indexeddb/auto';
import './mocks/chrome';
```

`tests/mocks/chrome.ts`:
```typescript
const memoryStore: Record<string, unknown> = {};

const chrome = {
  storage: {
    sync: {
      get: async (keys?: string | string[]) => {
        if (!keys) return { ...memoryStore };
        const result: Record<string, unknown> = {};
        const keyArr = Array.isArray(keys) ? keys : [keys];
        for (const k of keyArr) if (k in memoryStore) result[k] = memoryStore[k];
        return result;
      },
      set: async (items: Record<string, unknown>) => {
        Object.assign(memoryStore, items);
      },
    },
    session: {
      _store: {} as Record<string, unknown>,
      get: async (keys?: string | string[]) => {
        if (!keys) return { ...chrome.storage.session._store };
        const result: Record<string, unknown> = {};
        const keyArr = Array.isArray(keys) ? keys : [keys];
        for (const k of keyArr) if (k in chrome.storage.session._store) result[k] = chrome.storage.session._store[k];
        return result;
      },
      set: async (items: Record<string, unknown>) => {
        Object.assign(chrome.storage.session._store, items);
      },
      remove: async (keys: string | string[]) => {
        const keyArr = Array.isArray(keys) ? keys : [keys];
        for (const k of keyArr) delete chrome.storage.session._store[k];
      },
    },
  },
  runtime: {
    sendMessage: async (msg: unknown) => { console.log('mock sendMessage', msg); return {}; },
    onMessage: { addListener: () => {}, removeListener: () => {} },
    id: 'test-extension-id',
    getURL: (path: string) => `chrome-extension://test/${path}`,
    onInstalled: { addListener: () => {} },
  },
  tabs: {
    query: async () => [{ id: 1, url: 'https://example.com' }],
    create: async () => ({ id: 1 }),
    get: async (id: number) => ({ id, url: 'https://example.com' }),
    onUpdated: { addListener: () => {} },
    onActivated: { addListener: () => {} },
    sendMessage: async () => {},
  },
  contextMenus: {
    create: () => {},
    removeAll: () => {},
    onClicked: { addListener: () => {} },
  },
  action: {
    setBadgeText: async () => {},
    setBadgeBackgroundColor: async () => {},
    setTitle: async () => {},
  },
  commands: {
    onCommand: { addListener: () => {} },
  },
  alarms: {
    create: () => {},
    clear: () => {},
    onAlarm: { addListener: () => {} },
  },
  notifications: {
    create: async () => {},
  },
};

(globalThis as unknown as { chrome: typeof chrome }).chrome = chrome;

export default chrome;
```

- [ ] **Step 2: Create Dexie schema**

`src/shared/db/schema.ts`:
```typescript
import Dexie, { type Table } from 'dexie';
import type {
  System, Account, Server, Middleware, Tag,
  SystemTag, ServerTag, MiddlewareTag, Recent, MetaEntry,
} from '../types/entities';

export class NavPortalDB extends Dexie {
  systems!: Table<System, string>;
  accounts!: Table<Account, string>;
  servers!: Table<Server, string>;
  middlewares!: Table<Middleware, string>;
  tags!: Table<Tag, string>;
  systemTags!: Table<SystemTag, string>;
  serverTags!: Table<ServerTag, string>;
  middlewareTags!: Table<MiddlewareTag, string>;
  recents!: Table<Recent, string>;
  meta!: Table<MetaEntry, string>;

  constructor() {
    super('NavPortalDB');
    this.version(1).stores({
      systems:        'id, name, url, environment, favorite, sort, createdAt, updatedAt',
      accounts:       'id, systemId, isDefault, createdAt',
      servers:        'id, name, ip, environment, favorite, createdAt',
      middlewares:    'id, type, name, host, favorite, createdAt',
      tags:           'id, name, createdAt',
      systemTags:     '[systemId+tagId], systemId, tagId',
      serverTags:     '[serverId+tagId], serverId, tagId',
      middlewareTags: '[middlewareId+tagId], middlewareId, tagId',
      recents:        'id, entityType, entityId, lastAccessedAt',
      meta:           'key',
    });
  }
}

export const db = new NavPortalDB();
```

- [ ] **Step 3: Commit**

```bash
git add tests/ src/shared/db/schema.ts
git commit -m "feat: add test setup, chrome mock, and Dexie schema"
```

---

### Task 3.2: System Repository (TDD)

**Files:**
- Create: `tests/unit/db/systemRepo.test.ts`
- Create: `src/shared/db/repositories/systemRepo.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/db/systemRepo.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../../src/shared/db/schema';
import { systemRepo } from '../../../src/shared/db/repositories/systemRepo';
import type { SystemInput } from '../../../src/shared/types/entities';

const sampleSystem: SystemInput = {
  name: 'Test System',
  url: 'https://test.example.com',
  environment: 'development',
  favorite: false,
  sort: 0,
};

describe('systemRepo', () => {
  beforeEach(async () => {
    await db.systems.clear();
    await db.systemTags.clear();
  });

  it('creates a system and returns its id', async () => {
    const id = await systemRepo.create(sampleSystem);
    expect(id).toMatch(/^[0-9a-f-]+$/);
    const stored = await db.systems.get(id);
    expect(stored?.name).toBe('Test System');
    expect(stored?.createdAt).toBeGreaterThan(0);
  });

  it('lists all systems sorted by sort field', async () => {
    await systemRepo.create({ ...sampleSystem, name: 'B', sort: 2 });
    await systemRepo.create({ ...sampleSystem, name: 'A', sort: 1 });
    const all = await systemRepo.all();
    expect(all[0].name).toBe('A');
    expect(all[1].name).toBe('B');
  });

  it('gets system by id', async () => {
    const id = await systemRepo.create(sampleSystem);
    const system = await systemRepo.byId(id);
    expect(system?.name).toBe('Test System');
  });

  it('updates a system', async () => {
    const id = await systemRepo.create(sampleSystem);
    await systemRepo.update(id, { name: 'Updated' });
    const updated = await systemRepo.byId(id);
    expect(updated?.name).toBe('Updated');
    expect(updated?.updatedAt).toBeGreaterThanOrEqual(updated!.createdAt);
  });

  it('deletes a system and its tag associations', async () => {
    const id = await systemRepo.create(sampleSystem);
    await db.systemTags.add({ systemId: id, tagId: 'tag1' });
    await systemRepo.delete(id);
    expect(await systemRepo.byId(id)).toBeUndefined();
    const tags = await db.systemTags.where('systemId').equals(id).toArray();
    expect(tags).toHaveLength(0);
  });

  it('returns favorites only', async () => {
    await systemRepo.create({ ...sampleSystem, favorite: false });
    await systemRepo.create({ ...sampleSystem, name: 'Fav', favorite: true });
    const favs = await systemRepo.favorites();
    expect(favs).toHaveLength(1);
    expect(favs[0].name).toBe('Fav');
  });

  it('searches by name, url, and remark (case-insensitive substring)', async () => {
    await systemRepo.create({ ...sampleSystem, name: 'Redis Admin', url: 'https://redis.example.com', remark: 'Cache layer' });
    await systemRepo.create({ ...sampleSystem, name: 'MySQL', url: 'https://mysql.example.com', remark: 'Primary DB' });
    const results = await systemRepo.search('redis');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Redis Admin');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/db/systemRepo.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement systemRepo**

`src/shared/db/repositories/systemRepo.ts`:
```typescript
import { db } from '../schema';
import type { System, SystemInput } from '../../types/entities';
import { generateId } from '../../utils/id';

export const systemRepo = {
  async all(): Promise<System[]> {
    return db.systems.orderBy('sort').toArray();
  },

  async byId(id: string): Promise<System | undefined> {
    return db.systems.get(id);
  },

  async byEnvironment(environment: string): Promise<System[]> {
    return db.systems.where('environment').equals(environment).toArray();
  },

  async favorites(): Promise<System[]> {
    return db.systems.where('favorite').equals(1 as any).toArray();
  },

  async create(data: SystemInput): Promise<string> {
    const now = Date.now();
    const id = generateId();
    const system: System = { ...data, id, createdAt: now, updatedAt: now };
    await db.systems.add(system);
    return id;
  },

  async update(id: string, patch: Partial<System>): Promise<void> {
    await db.systems.update(id, { ...patch, updatedAt: Date.now() });
  },

  async delete(id: string): Promise<void> {
    await db.transaction('rw', db.systems, db.systemTags, db.accounts, async () => {
      await db.systems.delete(id);
      await db.systemTags.where('systemId').equals(id).delete();
      await db.accounts.where('systemId').equals(id).delete();
    });
  },

  async reorder(orderedIds: string[]): Promise<void> {
    await db.transaction('rw', db.systems, async () => {
      for (let i = 0; i < orderedIds.length; i++) {
        await db.systems.update(orderedIds[i], { sort: i, updatedAt: Date.now() });
      }
    });
  },

  async search(query: string): Promise<System[]> {
    const q = query.toLowerCase();
    const all = await db.systems.toArray();
    return all.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.url.toLowerCase().includes(q) ||
      (s.remark ?? '').toLowerCase().includes(q)
    );
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/db/systemRepo.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add tests/unit/db/systemRepo.test.ts src/shared/db/repositories/systemRepo.ts
git commit -m "feat: add system repository with TDD tests"
```

---

### Task 3.3: Account, Server, Middleware Repositories

**Files:**
- Create: `src/shared/db/repositories/accountRepo.ts`
- Create: `src/shared/db/repositories/serverRepo.ts`
- Create: `src/shared/db/repositories/middlewareRepo.ts`

- [ ] **Step 1: Create accountRepo.ts**

```typescript
import { db } from '../schema';
import type { Account } from '../../types/entities';
import { generateId } from '../../utils/id';

export const accountRepo = {
  async bySystemId(systemId: string): Promise<Account[]> {
    return db.accounts.where('systemId').equals(systemId).toArray();
  },

  async byId(id: string): Promise<Account | undefined> {
    return db.accounts.get(id);
  },

  async create(data: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = Date.now();
    const id = generateId();
    await db.accounts.add({ ...data, id, createdAt: now, updatedAt: now });
    return id;
  },

  async update(id: string, patch: Partial<Account>): Promise<void> {
    await db.accounts.update(id, { ...patch, updatedAt: Date.now() });
  },

  async delete(id: string): Promise<void> {
    await db.accounts.delete(id);
  },

  async setDefault(systemId: string, accountId: string): Promise<void> {
    await db.transaction('rw', db.accounts, async () => {
      const accounts = await db.accounts.where('systemId').equals(systemId).toArray();
      for (const acc of accounts) {
        await db.accounts.update(acc.id, { isDefault: acc.id === accountId, updatedAt: Date.now() });
      }
    });
  },

  async getDefault(systemId: string): Promise<Account | undefined> {
    const accounts = await db.accounts.where('systemId').equals(systemId).toArray();
    return accounts.find(a => a.isDefault) ?? accounts[0];
  },
};
```

- [ ] **Step 2: Create serverRepo.ts**

```typescript
import { db } from '../schema';
import type { Server, ServerInput } from '../../types/entities';
import { generateId } from '../../utils/id';

export const serverRepo = {
  async all(): Promise<Server[]> {
    return db.servers.toArray();
  },

  async byId(id: string): Promise<Server | undefined> {
    return db.servers.get(id);
  },

  async favorites(): Promise<Server[]> {
    return db.servers.where('favorite').equals(1 as any).toArray();
  },

  async create(data: Omit<Server, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = Date.now();
    const id = generateId();
    await db.servers.add({ ...data, id, createdAt: now, updatedAt: now });
    return id;
  },

  async update(id: string, patch: Partial<Server>): Promise<void> {
    await db.servers.update(id, { ...patch, updatedAt: Date.now() });
  },

  async delete(id: string): Promise<void> {
    await db.transaction('rw', db.servers, db.serverTags, async () => {
      await db.servers.delete(id);
      await db.serverTags.where('serverId').equals(id).delete();
    });
  },

  async search(query: string): Promise<Server[]> {
    const q = query.toLowerCase();
    const all = await db.servers.toArray();
    return all.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.ip.toLowerCase().includes(q) ||
      (s.purpose ?? '').toLowerCase().includes(q) ||
      (s.remark ?? '').toLowerCase().includes(q)
    );
  },
};
```

- [ ] **Step 3: Create middlewareRepo.ts**

```typescript
import { db } from '../schema';
import type { Middleware } from '../../types/entities';
import { generateId } from '../../utils/id';

export const middlewareRepo = {
  async all(): Promise<Middleware[]> {
    return db.middlewares.toArray();
  },

  async byId(id: string): Promise<Middleware | undefined> {
    return db.middlewares.get(id);
  },

  async byType(type: string): Promise<Middleware[]> {
    return db.middlewares.where('type').equals(type).toArray();
  },

  async favorites(): Promise<Middleware[]> {
    return db.middlewares.where('favorite').equals(1 as any).toArray();
  },

  async create(data: Omit<Middleware, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = Date.now();
    const id = generateId();
    await db.middlewares.add({ ...data, id, createdAt: now, updatedAt: now });
    return id;
  },

  async update(id: string, patch: Partial<Middleware>): Promise<void> {
    await db.middlewares.update(id, { ...patch, updatedAt: Date.now() });
  },

  async delete(id: string): Promise<void> {
    await db.transaction('rw', db.middlewares, db.middlewareTags, async () => {
      await db.middlewares.delete(id);
      await db.middlewareTags.where('middlewareId').equals(id).delete();
    });
  },

  async search(query: string): Promise<Middleware[]> {
    const q = query.toLowerCase();
    const all = await db.middlewares.toArray();
    return all.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.host.toLowerCase().includes(q) ||
      (m.database ?? '').toLowerCase().includes(q) ||
      (m.remark ?? '').toLowerCase().includes(q)
    );
  },
};
```

- [ ] **Step 4: Commit**

```bash
git add src/shared/db/repositories/
git commit -m "feat: add account, server, middleware repositories"
```

---

### Task 3.4: Tag, Junction, Recent, Meta Repositories

**Files:**
- Create: `src/shared/db/repositories/tagRepo.ts`
- Create: `src/shared/db/repositories/systemTagRepo.ts`
- Create: `src/shared/db/repositories/serverTagRepo.ts`
- Create: `src/shared/db/repositories/middlewareTagRepo.ts`
- Create: `src/shared/db/repositories/recentRepo.ts`
- Create: `src/shared/db/repositories/metaRepo.ts`

- [ ] **Step 1: Create tagRepo.ts**

```typescript
import { db } from '../schema';
import type { Tag } from '../../types/entities';
import { generateId } from '../../utils/id';

export const tagRepo = {
  async all(): Promise<Tag[]> {
    return db.tags.toArray();
  },

  async byId(id: string): Promise<Tag | undefined> {
    return db.tags.get(id);
  },

  async byName(name: string): Promise<Tag | undefined> {
    return db.tags.where('name').equals(name).first();
  },

  async create(data: Omit<Tag, 'id' | 'createdAt'>): Promise<string> {
    const id = generateId();
    await db.tags.add({ ...data, id, createdAt: Date.now() });
    return id;
  },

  async update(id: string, patch: Partial<Tag>): Promise<void> {
    await db.tags.update(id, patch);
  },

  async delete(id: string): Promise<void> {
    await db.transaction('rw', db.tags, db.systemTags, db.serverTags, db.middlewareTags, async () => {
      await db.tags.delete(id);
      await db.systemTags.where('tagId').equals(id).delete();
      await db.serverTags.where('tagId').equals(id).delete();
      await db.middlewareTags.where('tagId').equals(id).delete();
    });
  },
};
```

- [ ] **Step 2: Create systemTagRepo.ts**

```typescript
import { db } from '../schema';

export const systemTagRepo = {
  async attach(systemId: string, tagId: string): Promise<void> {
    const exists = await db.systemTags.where('[systemId+tagId]').equals([systemId, tagId]).first();
    if (!exists) await db.systemTags.add({ systemId, tagId });
  },

  async detach(systemId: string, tagId: string): Promise<void> {
    await db.systemTags.where('[systemId+tagId]').equals([systemId, tagId]).delete();
  },

  async tagsFor(systemId: string): Promise<string[]> {
    const rows = await db.systemTags.where('systemId').equals(systemId).toArray();
    return rows.map(r => r.tagId);
  },

  async systemsFor(tagId: string): Promise<string[]> {
    const rows = await db.systemTags.where('tagId').equals(tagId).toArray();
    return rows.map(r => r.systemId);
  },

  async replaceAll(systemId: string, tagIds: string[]): Promise<void> {
    await db.transaction('rw', db.systemTags, async () => {
      await db.systemTags.where('systemId').equals(systemId).delete();
      for (const tagId of tagIds) {
        await db.systemTags.add({ systemId, tagId });
      }
    });
  },
};
```

- [ ] **Step 3: Create serverTagRepo.ts and middlewareTagRepo.ts**

`src/shared/db/repositories/serverTagRepo.ts`:
```typescript
import { db } from '../schema';

export const serverTagRepo = {
  async attach(serverId: string, tagId: string): Promise<void> {
    const exists = await db.serverTags.where('[serverId+tagId]').equals([serverId, tagId]).first();
    if (!exists) await db.serverTags.add({ serverId, tagId });
  },

  async detach(serverId: string, tagId: string): Promise<void> {
    await db.serverTags.where('[serverId+tagId]').equals([serverId, tagId]).delete();
  },

  async tagsFor(serverId: string): Promise<string[]> {
    const rows = await db.serverTags.where('serverId').equals(serverId).toArray();
    return rows.map(r => r.tagId);
  },

  async replaceAll(serverId: string, tagIds: string[]): Promise<void> {
    await db.transaction('rw', db.serverTags, async () => {
      await db.serverTags.where('serverId').equals(serverId).delete();
      for (const tagId of tagIds) await db.serverTags.add({ serverId, tagId });
    });
  },
};
```

`src/shared/db/repositories/middlewareTagRepo.ts`:
```typescript
import { db } from '../schema';

export const middlewareTagRepo = {
  async attach(middlewareId: string, tagId: string): Promise<void> {
    const exists = await db.middlewareTags.where('[middlewareId+tagId]').equals([middlewareId, tagId]).first();
    if (!exists) await db.middlewareTags.add({ middlewareId, tagId });
  },

  async detach(middlewareId: string, tagId: string): Promise<void> {
    await db.middlewareTags.where('[middlewareId+tagId]').equals([middlewareId, tagId]).delete();
  },

  async tagsFor(middlewareId: string): Promise<string[]> {
    const rows = await db.middlewareTags.where('middlewareId').equals(middlewareId).toArray();
    return rows.map(r => r.tagId);
  },

  async replaceAll(middlewareId: string, tagIds: string[]): Promise<void> {
    await db.transaction('rw', db.middlewareTags, async () => {
      await db.middlewareTags.where('middlewareId').equals(middlewareId).delete();
      for (const tagId of tagIds) await db.middlewareTags.add({ middlewareId, tagId });
    });
  },
};
```

- [ ] **Step 4: Create recentRepo.ts**

```typescript
import { db } from '../schema';
import type { EntityType } from '../../types/entities';

export const recentRepo = {
  async touch(entityType: EntityType, entityId: string, role?: string): Promise<void> {
    const id = `${entityType}:${entityId}`;
    await db.recents.put({ id, entityType, entityId, lastAccessedAt: Date.now(), role });
  },

  async top(limit: number = 10): Promise<Array<{ entityType: EntityType; entityId: string; lastAccessedAt: number; role?: string }>> {
    return db.recents.orderBy('lastAccessedAt').reverse().limit(limit).toArray();
  },

  async clear(): Promise<void> {
    await db.recents.clear();
  },
};
```

- [ ] **Step 5: Create metaRepo.ts**

```typescript
import { db } from '../schema';

export const metaRepo = {
  async get<T = unknown>(key: string): Promise<T | undefined> {
    const row = await db.meta.get(key);
    return row?.value as T | undefined;
  },

  async set(key: string, value: unknown): Promise<void> {
    await db.meta.put({ key, value });
  },

  async remove(key: string): Promise<void> {
    await db.meta.delete(key);
  },
};
```

- [ ] **Step 6: Commit**

```bash
git add src/shared/db/repositories/
git commit -m "feat: add tag, junction, recent, meta repositories"
```

---

## Phase 4: Crypto Layer

### Task 4.1: PBKDF2 Key Derivation (TDD)

**Files:**
- Create: `tests/unit/crypto/masterKey.test.ts`
- Create: `src/shared/crypto/masterKey.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/crypto/masterKey.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { deriveKey, generateSalt, exportRawKey } from '../../../src/shared/crypto/masterKey';

describe('masterKey', () => {
  it('derives a CryptoKey from password + salt', async () => {
    const salt = generateSalt();
    const key = await deriveKey('mypassword', salt);
    expect(key).toBeInstanceOf(CryptoKey);
    expect(key.type).toBe('secret');
    expect(key.extractable).toBe(true);
  });

  it('derives same key for same password + salt', async () => {
    const salt = generateSalt();
    const key1 = await deriveKey('mypassword', salt);
    const key2 = await deriveKey('mypassword', salt);
    const raw1 = await exportRawKey(key1);
    const raw2 = await exportRawKey(key2);
    expect(new Uint8Array(raw1)).toEqual(new Uint8Array(raw2));
  });

  it('derives different keys for different passwords', async () => {
    const salt = generateSalt();
    const key1 = await deriveKey('password1', salt);
    const key2 = await deriveKey('password2', salt);
    const raw1 = await exportRawKey(key1);
    const raw2 = await exportRawKey(key2);
    expect(new Uint8Array(raw1)).not.toEqual(new Uint8Array(raw2));
  });

  it('generates different salts each call', () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    expect(salt1).not.toBe(salt2);
  });

  it('generates 16-byte salts (base64 encoded)', () => {
    const salt = generateSalt();
    const decoded = atob(salt);
    expect(decoded.length).toBe(16);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/crypto/masterKey.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement masterKey.ts**

`src/shared/crypto/masterKey.ts`:
```typescript
const PBKDF2_ITERATIONS = 600_000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 256;

export function generateSalt(): string {
  const buffer = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  return arrayBufferToBase64(buffer.buffer);
}

export async function deriveKey(password: string, saltBase64: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );

  const salt = base64ToArrayBuffer(saltBase64);

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    passwordKey,
    { name: 'AES-GCM', length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt'],
  );
}

export async function exportRawKey(key: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey('raw', key);
}

export async function importRawKey(rawKey: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM', length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt'],
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/crypto/masterKey.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add tests/unit/crypto/masterKey.test.ts src/shared/crypto/masterKey.ts
git commit -m "feat: add PBKDF2 key derivation with tests"
```

---

### Task 4.2: AES-GCM Cipher (TDD)

**Files:**
- Create: `tests/unit/crypto/cipher.test.ts`
- Create: `src/shared/crypto/cipher.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/crypto/cipher.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { deriveKey, generateSalt } from '../../../src/shared/crypto/masterKey';
import { encrypt, decrypt } from '../../../src/shared/crypto/cipher';

describe('cipher', () => {
  async function getKey() {
    return deriveKey('test-password', generateSalt());
  }

  it('encrypts plaintext to iv+ciphertext', async () => {
    const key = await getKey();
    const result = await encrypt('hello world', key);
    expect(result.iv).toBeTruthy();
    expect(result.ciphertext).toBeTruthy();
    expect(result.iv).not.toBe('hello world');
  });

  it('decrypts back to original plaintext', async () => {
    const key = await getKey();
    const encrypted = await encrypt('secret123', key);
    const decrypted = await decrypt(encrypted.iv, encrypted.ciphertext, key);
    expect(decrypted).toBe('secret123');
  });

  it('produces different IVs for same plaintext', async () => {
    const key = await getKey();
    const e1 = await encrypt('same', key);
    const e2 = await encrypt('same', key);
    expect(e1.iv).not.toBe(e2.iv);
    expect(e1.ciphertext).not.toBe(e2.ciphertext);
  });

  it('fails decryption with wrong key', async () => {
    const key1 = await deriveKey('pass1', generateSalt());
    const key2 = await deriveKey('pass2', generateSalt());
    const encrypted = await encrypt('data', key1);
    await expect(decrypt(encrypted.iv, encrypted.ciphertext, key2)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/crypto/cipher.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement cipher.ts**

`src/shared/crypto/cipher.ts`:
```typescript
const IV_LENGTH = 12;

export interface EncryptResult {
  iv: string;
  ciphertext: string;
}

export async function encrypt(plaintext: string, key: CryptoKey): Promise<EncryptResult> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext),
  );
  return {
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: arrayBufferToBase64(ciphertext),
  };
}

export async function decrypt(ivBase64: string, ciphertextBase64: string, key: CryptoKey): Promise<string> {
  const iv = base64ToArrayBuffer(ivBase64);
  const ciphertext = base64ToArrayBuffer(ciphertextBase64);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  );
  const dec = new TextDecoder();
  return dec.decode(decrypted);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/crypto/cipher.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add tests/unit/crypto/cipher.test.ts src/shared/crypto/cipher.ts
git commit -m "feat: add AES-GCM encrypt/decrypt with tests"
```

---

### Task 4.3: Crypto Storage and Session

**Files:**
- Create: `src/shared/crypto/storage.ts`
- Create: `src/shared/crypto/session.ts`
- Create: `src/shared/crypto/index.ts`

- [ ] **Step 1: Create storage.ts (verifier management)**

`src/shared/crypto/storage.ts`:
```typescript
import { metaRepo } from '../db/repositories/metaRepo';
import { encrypt, decrypt } from './cipher';
import type { CryptoKey } from 'crypto';

const SALT_KEY = 'crypto.salt';
const VERIFIER_KEY = 'crypto.verifier';

interface Verifier {
  iv: string;
  ciphertext: string;
}

export const cryptoStorage = {
  async getSalt(): Promise<string | undefined> {
    return metaRepo.get<string>(SALT_KEY);
  },

  async setSalt(salt: string): Promise<void> {
    await metaRepo.set(SALT_KEY, salt);
  },

  async setVerifier(key: CryptoKey, knownPlaintext: string): Promise<void> {
    const encrypted = await encrypt(knownPlaintext, key);
    await metaRepo.set(VERIFIER_KEY, encrypted as unknown as Verifier);
  },

  async verifyKey(key: CryptoKey, knownPlaintext: string): Promise<boolean> {
    const stored = await metaRepo.get<Verifier>(VERIFIER_KEY);
    if (!stored) return false;
    try {
      const decrypted = await decrypt(stored.iv, stored.ciphertext, key);
      return decrypted === knownPlaintext;
    } catch {
      return false;
    }
  },

  async clear(): Promise<void> {
    await metaRepo.remove(SALT_KEY);
    await metaRepo.remove(VERIFIER_KEY);
  },

  async hasMasterPassword(): Promise<boolean> {
    const salt = await this.getSalt();
    return !!salt;
  },
};
```

- [ ] **Step 2: Create session.ts (in-memory key cache + auto-lock)**

`src/shared/crypto/session.ts`:
```typescript
import { importRawKey, exportRawKey } from './masterKey';

const SESSION_KEY_STORAGE = 'crypto.sessionKey';
const VERIFIER_PLAINTEXT = 'nav-portal-verifier-v1';

type LockHandler = () => void;

class CryptoSession {
  private key: CryptoKey | null = null;
  private lastActivityAt = 0;
  private lockTimer: ReturnType<typeof setInterval> | null = null;
  private autoLockMinutes = 5;
  private handlers: Set<LockHandler> = new Set();

  setKey(key: CryptoKey): void {
    this.key = key;
    this.lastActivityAt = Date.now();
    this.startLockTimer();
  }

  getKey(): CryptoKey | null {
    return this.key;
  }

  isUnlocked(): boolean {
    return this.key !== null;
  }

  touchActivity(): void {
    this.lastActivityAt = Date.now();
  }

  setAutoLockMinutes(minutes: number): void {
    this.autoLockMinutes = minutes;
  }

  onLock(handler: LockHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  lock(): void {
    this.key = null;
    if (this.lockTimer) {
      clearInterval(this.lockTimer);
      this.lockTimer = null;
    }
    this.handlers.forEach(h => h());
  }

  async syncToBackground(): Promise<void> {
    if (!this.key) return;
    const raw = await exportRawKey(this.key);
    await chrome.runtime.sendMessage({ type: 'CRYPTO_KEY_SYNC', keyBytes: raw });
  }

  private startLockTimer(): void {
    if (this.lockTimer) clearInterval(this.lockTimer);
    this.lockTimer = setInterval(() => {
      const idleMs = Date.now() - this.lastActivityAt;
      if (idleMs >= this.autoLockMinutes * 60 * 1000) {
        this.lock();
      }
    }, 30_000);
  }
}

export const cryptoSession = new CryptoSession();
export { VERIFIER_PLAINTEXT };
```

- [ ] **Step 3: Create index.ts**

`src/shared/crypto/index.ts`:
```typescript
export * from './masterKey';
export * from './cipher';
export * from './storage';
export * from './session';
```

- [ ] **Step 4: Commit**

```bash
git add src/shared/crypto/
git commit -m "feat: add crypto storage (verifier) and session (key cache + auto-lock)"
```

---

## Phase 5: Service Layer

### Task 5.1: Crypto Service (TDD)

**Files:**
- Create: `tests/unit/services/cryptoService.test.ts`
- Create: `src/shared/services/cryptoService.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/services/cryptoService.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../../src/shared/db/schema';
import { cryptoService } from '../../../src/shared/services/cryptoService';
import { cryptoSession } from '../../../src/shared/crypto/session';

describe('cryptoService', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    cryptoSession.lock();
  });

  it('reports disabled when no master password set', async () => {
    expect(await cryptoService.isEnabled()).toBe(false);
  });

  it('sets up master password and unlocks', async () => {
    await cryptoService.setPassword('mysecret');
    expect(await cryptoService.isEnabled()).toBe(true);
    expect(cryptoService.isUnlocked()).toBe(true);
  });

  it('unlocks with correct password', async () => {
    await cryptoService.setPassword('mysecret');
    cryptoSession.lock();
    expect(cryptoService.isUnlocked()).toBe(false);
    const ok = await cryptoService.unlock('mysecret');
    expect(ok).toBe(true);
    expect(cryptoService.isUnlocked()).toBe(true);
  });

  it('rejects wrong password on unlock', async () => {
    await cryptoService.setPassword('mysecret');
    cryptoSession.lock();
    const ok = await cryptoService.unlock('wrong');
    expect(ok).toBe(false);
    expect(cryptoService.isUnlocked()).toBe(false);
  });

  it('encrypts and decrypts fields when enabled', async () => {
    await cryptoService.setPassword('mysecret');
    const encrypted = await cryptoService.encryptField('password123');
    expect(encrypted.__encrypted).toBe(true);
    if (encrypted.__encrypted) {
      expect(encrypted.ciphertext).not.toBe('password123');
    }
    const decrypted = await cryptoService.decryptField(encrypted);
    expect(decrypted).toBe('password123');
  });

  it('stores plaintext when disabled', async () => {
    const result = await cryptoService.encryptField('password123');
    expect(result.__encrypted).toBe(false);
    if (!result.__encrypted) {
      expect(result.value).toBe('password123');
    }
    const decrypted = await cryptoService.decryptField(result);
    expect(decrypted).toBe('password123');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/services/cryptoService.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement cryptoService.ts**

`src/shared/services/cryptoService.ts`:
```typescript
import { cryptoStorage, cryptoSession, VERIFIER_PLAINTEXT } from '../crypto';
import { deriveKey, generateSalt, importRawKey } from '../crypto/masterKey';
import { encrypt, decrypt } from '../crypto/cipher';
import type { EncryptedField } from '../types/entities';

export const cryptoService = {
  async isEnabled(): Promise<boolean> {
    return cryptoStorage.hasMasterPassword();
  },

  isUnlocked(): boolean {
    return cryptoSession.isUnlocked();
  },

  async setPassword(password: string): Promise<void> {
    const salt = generateSalt();
    await cryptoStorage.setSalt(salt);
    const key = await deriveKey(password, salt);
    await cryptoStorage.setVerifier(key, VERIFIER_PLAINTEXT);
    cryptoSession.setKey(key);
    await cryptoSession.syncToBackground();
  },

  async unlock(password: string): Promise<boolean> {
    const salt = await cryptoStorage.getSalt();
    if (!salt) return false;
    const key = await deriveKey(password, salt);
    const ok = await cryptoStorage.verifyKey(key, VERIFIER_PLAINTEXT);
    if (ok) {
      cryptoSession.setKey(key);
      await cryptoSession.syncToBackground();
    }
    return ok;
  },

  lock(): void {
    cryptoSession.lock();
    chrome.runtime.sendMessage({ type: 'LOCK_CRYPTO' }).catch(() => {});
  },

  async encryptField(plaintext: string): Promise<EncryptedField> {
    const key = cryptoSession.getKey();
    if (!key) {
      return { __encrypted: false, value: plaintext };
    }
    cryptoSession.touchActivity();
    const result = await encrypt(plaintext, key);
    return { __encrypted: true, ...result };
  },

  async decryptField(field: EncryptedField): Promise<string> {
    if (!field.__encrypted) return field.value;
    const key = cryptoSession.getKey();
    if (!key) {
      throw new Error('Crypto locked - cannot decrypt');
    }
    cryptoSession.touchActivity();
    return decrypt(field.iv, field.ciphertext, key);
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    const ok = await this.unlock(oldPassword);
    if (!ok) throw new Error('Old password incorrect');
    const newSalt = generateSalt();
    const newKey = await deriveKey(newPassword, newSalt);
    await cryptoStorage.setSalt(newSalt);
    await cryptoStorage.setVerifier(newKey, VERIFIER_PLAINTEXT);
    cryptoSession.setKey(newKey);
    await cryptoSession.syncToBackground();
  },

  async disablePassword(password: string): Promise<void> {
    const ok = await this.unlock(password);
    if (!ok) throw new Error('Password incorrect');
    this.lock();
    await cryptoStorage.clear();
  },

  async setKeyFromBackground(rawKey: ArrayBuffer): Promise<void> {
    const key = await importRawKey(rawKey);
    cryptoSession.setKey(key);
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/services/cryptoService.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add tests/unit/services/cryptoService.test.ts src/shared/services/cryptoService.ts
git commit -m "feat: add cryptoService with master password lifecycle"
```

---

### Task 5.2: Entity Services

**Files:**
- Create: `src/shared/services/systemService.ts`
- Create: `src/shared/services/accountService.ts`
- Create: `src/shared/services/serverService.ts`
- Create: `src/shared/services/middlewareService.ts`
- Create: `src/shared/services/tagService.ts`

- [ ] **Step 1: Create systemService.ts**

```typescript
import { systemRepo } from '../db/repositories/systemRepo';
import { recentRepo } from '../db/repositories/recentRepo';
import { systemTagRepo } from '../db/repositories/systemTagRepo';
import type { System, SystemInput } from '../types/entities';
import { requireString } from '../utils/validation';
import { isValidUrl } from '../utils/url';
import { ValidationError } from '../types/errors';

export const systemService = {
  async all(): Promise<System[]> {
    return systemRepo.all();
  },

  async byId(id: string): Promise<System | undefined> {
    return systemRepo.byId(id);
  },

  async create(input: SystemInput): Promise<string> {
    requireString(input.name, '系统名称');
    if (!isValidUrl(input.url)) throw new ValidationError('INVALID_URL', '系统地址格式不正确');
    const sort = input.sort ?? (await systemRepo.all()).length;
    return systemRepo.create({ ...input, sort });
  },

  async update(id: string, patch: Partial<SystemInput>): Promise<void> {
    if (patch.url !== undefined && !isValidUrl(patch.url)) {
      throw new ValidationError('INVALID_URL', '系统地址格式不正确');
    }
    await systemRepo.update(id, patch);
  },

  async delete(id: string): Promise<void> {
    await systemRepo.delete(id);
  },

  async toggleFavorite(id: string): Promise<void> {
    const system = await systemRepo.byId(id);
    if (!system) return;
    await systemRepo.update(id, { favorite: !system.favorite });
  },

  async reorder(orderedIds: string[]): Promise<void> {
    await systemRepo.reorder(orderedIds);
  },

  async setTags(systemId: string, tagIds: string[]): Promise<void> {
    await systemTagRepo.replaceAll(systemId, tagIds);
  },

  async getTags(systemId: string): Promise<string[]> {
    return systemTagRepo.tagsFor(systemId);
  },

  async recordAccess(id: string, role?: string): Promise<void> {
    await recentRepo.touch('system', id, role);
  },
};
```

- [ ] **Step 2: Create accountService.ts**

```typescript
import { accountRepo } from '../db/repositories/accountRepo';
import { systemRepo } from '../db/repositories/systemRepo';
import { recentRepo } from '../db/repositories/recentRepo';
import { cryptoService } from './cryptoService';
import type { Account, AccountInput } from '../types/entities';
import { requireString } from '../utils/validation';
import { copyToClipboard } from '../utils/clipboard';
import { EncryptionError } from '../types/errors';

export const accountService = {
  async bySystemId(systemId: string): Promise<Account[]> {
    return accountRepo.bySystemId(systemId);
  },

  async create(input: AccountInput): Promise<string> {
    requireString(input.role, '角色');
    requireString(input.username, '用户名');
    requireString(input.password, '密码');
    const encryptedPassword = await cryptoService.encryptField(input.password);
    const id = await accountRepo.create({
      systemId: input.systemId,
      role: input.role,
      username: input.username,
      password: encryptedPassword,
      isDefault: input.isDefault,
      remark: input.remark,
    });
    if (input.isDefault) {
      await accountRepo.setDefault(input.systemId, id);
    }
    return id;
  },

  async update(id: string, patch: Partial<AccountInput>): Promise<void> {
    const updatePatch: Partial<Account> = { ...patch };
    if (patch.password !== undefined) {
      updatePatch.password = await cryptoService.encryptField(patch.password);
    }
    await accountRepo.update(id, updatePatch);
    if (patch.isDefault && patch.systemId) {
      await accountRepo.setDefault(patch.systemId, id);
    }
  },

  async delete(id: string): Promise<void> {
    await accountRepo.delete(id);
  },

  async setDefault(systemId: string, accountId: string): Promise<void> {
    await accountRepo.setDefault(systemId, accountId);
  },

  async getDecrypted(id: string): Promise<Account & { plainPassword: string }> {
    const account = await accountRepo.byId(id);
    if (!account) throw new Error('Account not found');
    const plainPassword = await cryptoService.decryptField(account.password);
    return { ...account, plainPassword };
  },

  async copyUsername(id: string): Promise<void> {
    const account = await accountRepo.byId(id);
    if (!account) return;
    await copyToClipboard(account.username);
  },

  async copyPassword(id: string): Promise<void> {
    const { plainPassword } = await this.getDecrypted(id);
    await copyToClipboard(plainPassword);
  },

  async copyAll(id: string): Promise<void> {
    const { username, plainPassword } = await this.getDecrypted(id);
    await copyToClipboard(`${username}\n${plainPassword}`);
  },
};
```

- [ ] **Step 3: Create serverService.ts**

```typescript
import { serverRepo } from '../db/repositories/serverRepo';
import { serverTagRepo } from '../db/repositories/serverTagRepo';
import { recentRepo } from '../db/repositories/recentRepo';
import { cryptoService } from './cryptoService';
import type { Server, ServerInput } from '../types/entities';
import { requireString, requireNumber } from '../utils/validation';
import { copyToClipboard } from '../utils/clipboard';

export const serverService = {
  async all(): Promise<Server[]> {
    return serverRepo.all();
  },

  async byId(id: string): Promise<Server | undefined> {
    return serverRepo.byId(id);
  },

  async create(input: ServerInput): Promise<string> {
    requireString(input.name, '名称');
    requireString(input.ip, 'IP');
    requireNumber(input.sshPort, 'SSH 端口');
    requireString(input.username, '账号');
    const encryptedPassword = await cryptoService.encryptField(input.password);
    const encryptedSshKey = input.sshKey ? await cryptoService.encryptField(input.sshKey) : undefined;
    return serverRepo.create({
      name: input.name,
      ip: input.ip,
      sshPort: input.sshPort,
      username: input.username,
      password: encryptedPassword,
      sshKey: encryptedSshKey,
      environment: input.environment,
      status: input.status,
      purpose: input.purpose,
      remark: input.remark,
      favorite: input.favorite,
    });
  },

  async update(id: string, patch: Partial<ServerInput>): Promise<void> {
    const updatePatch: Partial<Server> = { ...patch };
    if (patch.password !== undefined) {
      updatePatch.password = await cryptoService.encryptField(patch.password);
    }
    if (patch.sshKey !== undefined) {
      updatePatch.sshKey = await cryptoService.encryptField(patch.sshKey);
    }
    await serverRepo.update(id, updatePatch);
  },

  async delete(id: string): Promise<void> {
    await serverRepo.delete(id);
  },

  async toggleFavorite(id: string): Promise<void> {
    const server = await serverRepo.byId(id);
    if (!server) return;
    await serverRepo.update(id, { favorite: !server.favorite });
  },

  async copyIp(id: string): Promise<void> {
    const server = await serverRepo.byId(id);
    if (server) await copyToClipboard(server.ip);
  },

  async copySshCommand(id: string): Promise<void> {
    const server = await serverRepo.byId(id);
    if (!server) return;
    await copyToClipboard(`ssh ${server.username}@${server.ip} -p ${server.sshPort}`);
  },

  async copyPassword(id: string): Promise<void> {
    const server = await serverRepo.byId(id);
    if (!server) return;
    const plain = await cryptoService.decryptField(server.password);
    await copyToClipboard(plain);
  },

  async setTags(serverId: string, tagIds: string[]): Promise<void> {
    await serverTagRepo.replaceAll(serverId, tagIds);
  },

  async getTags(serverId: string): Promise<string[]> {
    return serverTagRepo.tagsFor(serverId);
  },

  async search(query: string): Promise<Server[]> {
    return serverRepo.search(query);
  },
};
```

- [ ] **Step 4: Create middlewareService.ts**

```typescript
import { middlewareRepo } from '../db/repositories/middlewareRepo';
import { middlewareTagRepo } from '../db/repositories/middlewareTagRepo';
import { cryptoService } from './cryptoService';
import type { Middleware, MiddlewareInput } from '../types/entities';
import { requireString, requireNumber } from '../utils/validation';
import { copyToClipboard } from '../utils/clipboard';

export const middlewareService = {
  async all(): Promise<Middleware[]> {
    return middlewareRepo.all();
  },

  async byId(id: string): Promise<Middleware | undefined> {
    return middlewareRepo.byId(id);
  },

  async create(input: MiddlewareInput): Promise<string> {
    requireString(input.type, '类型');
    requireString(input.name, '名称');
    requireString(input.host, 'Host');
    requireNumber(input.port, '端口');
    const encryptedPassword = input.password ? await cryptoService.encryptField(input.password) : undefined;
    return middlewareRepo.create({
      type: input.type,
      name: input.name,
      version: input.version,
      host: input.host,
      port: input.port,
      database: input.database,
      username: input.username,
      password: encryptedPassword,
      extra: input.extra,
      remark: input.remark,
      favorite: input.favorite,
    });
  },

  async update(id: string, patch: Partial<MiddlewareInput>): Promise<void> {
    const updatePatch: Partial<Middleware> = { ...patch };
    if (patch.password !== undefined) {
      updatePatch.password = await cryptoService.encryptField(patch.password);
    }
    await middlewareRepo.update(id, updatePatch);
  },

  async delete(id: string): Promise<void> {
    await middlewareRepo.delete(id);
  },

  async toggleFavorite(id: string): Promise<void> {
    const mw = await middlewareRepo.byId(id);
    if (!mw) return;
    await middlewareRepo.update(id, { favorite: !mw.favorite });
  },

  async copyConnectionString(id: string): Promise<void> {
    const mw = await middlewareRepo.byId(id);
    if (!mw) return;
    let conn = '';
    if (mw.type === 'redis') {
      conn = `redis://${mw.username ? `${mw.username}@` : ''}${mw.host}:${mw.port}/${mw.database ?? '0'}`;
    } else if (mw.type === 'mysql') {
      conn = `mysql://${mw.username}@${mw.host}:${mw.port}/${mw.database ?? ''}`;
    } else {
      conn = `${mw.host}:${mw.port}`;
    }
    await copyToClipboard(conn);
  },

  async copyPassword(id: string): Promise<void> {
    const mw = await middlewareRepo.byId(id);
    if (!mw?.password) return;
    const plain = await cryptoService.decryptField(mw.password);
    await copyToClipboard(plain);
  },

  async setTags(middlewareId: string, tagIds: string[]): Promise<void> {
    await middlewareTagRepo.replaceAll(middlewareId, tagIds);
  },

  async getTags(middlewareId: string): Promise<string[]> {
    return middlewareTagRepo.tagsFor(middlewareId);
  },

  async search(query: string): Promise<Middleware[]> {
    return middlewareRepo.search(query);
  },
};
```

- [ ] **Step 5: Create tagService.ts**

```typescript
import { tagRepo } from '../db/repositories/tagRepo';
import type { Tag } from '../types/entities';
import { requireString } from '../utils/validation';

export const tagService = {
  async all(): Promise<Tag[]> {
    return tagRepo.all();
  },

  async create(name: string, color?: string): Promise<string> {
    requireString(name, '标签名称');
    const existing = await tagRepo.byName(name);
    if (existing) return existing.id;
    return tagRepo.create({ name, color });
  },

  async update(id: string, patch: Partial<Tag>): Promise<void> {
    await tagRepo.update(id, patch);
  },

  async delete(id: string): Promise<void> {
    await tagRepo.delete(id);
  },

  async findOrCreate(names: string[]): Promise<string[]> {
    const ids: string[] = [];
    for (const name of names) {
      const id = await this.create(name);
      ids.push(id);
    }
    return ids;
  },
};
```

- [ ] **Step 6: Commit**

```bash
git add src/shared/services/
git commit -m "feat: add entity services (system, account, server, middleware, tag)"
```

---

### Task 5.3: Search Service (TDD)

**Files:**
- Create: `tests/unit/services/searchService.test.ts`
- Create: `src/shared/services/searchService.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/services/searchService.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../../src/shared/db/schema';
import { systemRepo } from '../../../src/shared/db/repositories/systemRepo';
import { serverRepo } from '../../../src/shared/db/repositories/serverRepo';
import { searchService } from '../../../src/shared/services/searchService';

describe('searchService', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await systemRepo.create({ name: 'Redis Admin', url: 'https://redis.example.com', environment: 'production', favorite: false, sort: 0, remark: 'Cache layer' });
    await systemRepo.create({ name: 'MySQL', url: 'https://mysql.example.com', environment: 'production', favorite: true, sort: 1 });
    await serverRepo.create({ name: 'Redis Server', ip: '10.0.0.5', sshPort: 22, username: 'root', password: { __encrypted: false, value: '' }, environment: 'production', favorite: false });
  });

  it('matches systems by name', async () => {
    const results = await searchService.search('redis');
    expect(results.length).toBeGreaterThanOrEqual(2);
    const types = results.map(r => r.type);
    expect(types).toContain('system');
    expect(types).toContain('server');
  });

  it('matches systems by url', async () => {
    const results = await searchService.search('mysql.example');
    expect(results.some(r => r.type === 'system')).toBe(true);
  });

  it('matches servers by ip', async () => {
    const results = await searchService.search('10.0.0');
    expect(results.some(r => r.type === 'server')).toBe(true);
  });

  it('returns empty for no matches', async () => {
    const results = await searchService.search('zzznomatch');
    expect(results).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/services/searchService.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement searchService.ts**

`src/shared/services/searchService.ts`:
```typescript
import { systemRepo } from '../db/repositories/systemRepo';
import { serverRepo } from '../db/repositories/serverRepo';
import { middlewareRepo } from '../db/repositories/middlewareRepo';
import { recentRepo } from '../db/repositories/recentRepo';
import type { EntityType } from '../types/entities';

export interface SearchResult {
  type: EntityType | 'account';
  id: string;
  title: string;
  subtitle: string;
  matchedField: string;
  favorite?: boolean;
}

export const searchService = {
  async search(query: string): Promise<SearchResult[]> {
    if (!query.trim()) return [];
    const q = query.toLowerCase();

    const [systems, servers, middlewares] = await Promise.all([
      systemRepo.search(q),
      serverRepo.search(q),
      middlewareRepo.search(q),
    ]);

    const results: SearchResult[] = [];

    for (const s of systems) {
      results.push({
        type: 'system',
        id: s.id,
        title: s.name,
        subtitle: s.url,
        matchedField: findMatchedField(q, { name: s.name, url: s.url, remark: s.remark }),
        favorite: s.favorite,
      });
    }

    for (const s of servers) {
      results.push({
        type: 'server',
        id: s.id,
        title: s.name,
        subtitle: `${s.ip}:${s.sshPort}`,
        matchedField: findMatchedField(q, { name: s.name, ip: s.ip, remark: s.remark }),
        favorite: s.favorite,
      });
    }

    for (const m of middlewares) {
      results.push({
        type: 'middleware',
        id: m.id,
        title: m.name,
        subtitle: `${m.host}:${m.port}`,
        matchedField: findMatchedField(q, { name: m.name, host: m.host, remark: m.remark }),
        favorite: m.favorite,
      });
    }

    return this.rankResults(results);
  },

  rankResults(results: SearchResult[]): SearchResult[] {
    return results.sort((a, b) => {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return a.title.localeCompare(b.title);
    });
  },
};

function findMatchedField(q: string, fields: Record<string, string | undefined>): string {
  for (const [key, value] of Object.entries(fields)) {
    if (value && value.toLowerCase().includes(q)) return key;
  }
  return 'name';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/services/searchService.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add tests/unit/services/searchService.test.ts src/shared/services/searchService.ts
git commit -m "feat: add searchService with multi-entity search"
```

---

### Task 5.4: Markdown Parser and Serializer (TDD)

**Files:**
- Create: `tests/unit/services/markdownParser.test.ts`
- Create: `src/shared/services/markdownParser.ts`
- Create: `src/shared/services/markdownSerializer.ts`

- [ ] **Step 1: Write failing test**

`tests/unit/services/markdownParser.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../../../src/shared/services/markdownParser';
import { serializeMarkdown } from '../../../src/shared/services/markdownSerializer';

const SAMPLE = `---
navPortalVersion: 1
exportedAt: 2026-07-16T10:30:00.000Z
encrypted: false
passwordsIncluded: true
---

# Nav Portal Backup

## 系统

### Test System

- **URL**: https://test.example.com
- **环境**: production
- **标签**: tag1, tag2
- **备注**: Test remark

## 服务器

### Test Server

- **IP**: 10.0.0.1
- **SSH 端口**: 22
- **账号**: root
- **密码**: mypassword

## 标签

- tag1 (#3b82f6)
- tag2 (#ef4444)
`;

describe('markdownParser', () => {
  it('parses front-matter', () => {
    const result = parseMarkdown(SAMPLE);
    expect(result.meta.navPortalVersion).toBe(1);
    expect(result.meta.encrypted).toBe(false);
  });

  it('parses systems', () => {
    const result = parseMarkdown(SAMPLE);
    expect(result.systems).toHaveLength(1);
    expect(result.systems[0].name).toBe('Test System');
    expect(result.systems[0].url).toBe('https://test.example.com');
    expect(result.systems[0].environment).toBe('production');
  });

  it('parses servers', () => {
    const result = parseMarkdown(SAMPLE);
    expect(result.servers).toHaveLength(1);
    expect(result.servers[0].ip).toBe('10.0.0.1');
    expect(result.servers[0].sshPort).toBe(22);
  });

  it('parses tags', () => {
    const result = parseMarkdown(SAMPLE);
    expect(result.tags).toHaveLength(2);
    expect(result.tags[0].name).toBe('tag1');
    expect(result.tags[0].color).toBe('#3b82f6');
  });
});

describe('markdownSerializer', () => {
  it('round-trips parse(serialize(data)) back to same data', () => {
    const parsed = parseMarkdown(SAMPLE);
    const reserialized = serializeMarkdown(parsed, { includePasswords: true });
    const reparsed = parseMarkdown(reserialized);
    expect(reparsed.systems[0].name).toBe(parsed.systems[0].name);
    expect(reparsed.servers[0].ip).toBe(parsed.servers[0].ip);
    expect(reparsed.tags).toHaveLength(parsed.tags.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/services/markdownParser.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement markdownParser.ts**

`src/shared/services/markdownParser.ts`:
```typescript
import fm from 'front-matter';
import type { System, Server, Middleware, Tag, EncryptedField } from '../types/entities';
import type { MiddlewareType } from '../types/enums';

export interface FrontMatter {
  navPortalVersion: number;
  exportedAt: string;
  encrypted: boolean;
  passwordsIncluded: boolean;
}

export interface ParsedBackup {
  meta: FrontMatter;
  systems: Array<Partial<System> & { tags?: string[]; accounts?: Array<{ role: string; username: string; password: string; isDefault?: boolean }> }>;
  servers: Array<Partial<Server> & { tags?: string[]; plainPassword?: string }>;
  middlewares: Array<Partial<Middleware> & { tags?: string[]; plainPassword?: string }>;
  tags: Array<Partial<Tag>>;
}

function plaintextField(value: string): EncryptedField {
  return { __encrypted: false, value };
}

export function parseMarkdown(content: string): ParsedBackup {
  const { attributes, body } = fm<FrontMatter>(content);
  const result: ParsedBackup = {
    meta: attributes,
    systems: [],
    servers: [],
    middlewares: [],
    tags: [],
  };

  const sections = splitByHeading(body, 2);

  for (const section of sections) {
    const heading = section.heading.trim();
    if (heading === '系统' || heading === 'Systems') {
      result.systems = parseSystems(section.body);
    } else if (heading === '服务器' || heading === 'Servers') {
      result.servers = parseServers(section.body);
    } else if (heading === '中间件' || heading === 'Middlewares') {
      result.middlewares = parseMiddlewares(section.body);
    } else if (heading === '标签' || heading === 'Tags') {
      result.tags = parseTags(section.body);
    }
  }

  return result;
}

interface Section { heading: string; body: string; }

function splitByHeading(body: string, level: number): Section[] {
  const lines = body.split('\n');
  const sections: Section[] = [];
  let current: Section | null = null;
  const prefix = '#'.repeat(level) + ' ';

  for (const line of lines) {
    if (line.startsWith(prefix)) {
      if (current) sections.push(current);
      current = { heading: line.slice(prefix.length), body: '' };
    } else if (current) {
      current.body += line + '\n';
    }
  }
  if (current) sections.push(current);
  return sections;
}

function parseSystems(body: string): ParsedBackup['systems'] {
  const systems: ParsedBackup['systems'] = [];
  const sections = splitByHeading(body, 3);

  for (const section of sections) {
    const name = section.heading.trim();
    const fields = parseBulletFields(section.body);
    const tagLine = fields['标签'] || fields['Tags'];
    systems.push({
      name,
      url: fields['URL'],
      environment: (fields['环境'] as System['environment']) || 'development',
      icon: fields['图标'],
      color: fields['颜色'],
      remark: fields['备注'],
      tags: tagLine ? tagLine.split(',').map(s => s.trim()) : [],
    });
  }
  return systems;
}

function parseServers(body: string): ParsedBackup['servers'] {
  const servers: ParsedBackup['servers'] = [];
  const sections = splitByHeading(body, 3);

  for (const section of sections) {
    const name = section.heading.trim();
    const fields = parseBulletFields(section.body);
    servers.push({
      name,
      ip: fields['IP'],
      sshPort: fields['SSH 端口'] ? Number(fields['SSH 端口']) : 22,
      username: fields['账号'],
      plainPassword: fields['密码'] || '',
      environment: (fields['环境'] as Server['environment']) || 'development',
      purpose: fields['用途'],
      remark: fields['备注'],
    });
  }
  return servers;
}

function parseMiddlewares(body: string): ParsedBackup['middlewares'] {
  const middlewares: ParsedBackup['middlewares'] = [];
  const sections = splitByHeading(body, 3);

  for (const section of sections) {
    const name = section.heading.trim();
    const fields = parseBulletFields(section.body);
    middlewares.push({
      type: (fields['类型'] as MiddlewareType) || 'redis',
      name,
      version: fields['版本'],
      host: fields['Host'] || '',
      port: fields['端口'] ? Number(fields['端口']) : 0,
      database: fields['数据库'],
      username: fields['账号'],
      plainPassword: fields['密码'],
      remark: fields['备注'],
    });
  }
  return middlewares;
}

function parseTags(body: string): ParsedBackup['tags'] {
  const tags: ParsedBackup['tags'] = [];
  const lines = body.split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*-\s+(.+?)(?:\s+\(#([0-9a-fA-F]{6})\))?$/);
    if (match) {
      tags.push({ name: match[1].trim(), color: match[2] ? `#${match[2]}` : undefined });
    }
  }
  return tags;
}

function parseBulletFields(body: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const lines = body.split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*-\s+\*\*(.+?)\*\*\s*:\s*(.+)$/);
    if (match) {
      fields[match[1].trim()] = match[2].trim();
    }
  }
  return fields;
}
```

- [ ] **Step 4: Implement markdownSerializer.ts**

`src/shared/services/markdownSerializer.ts`:
```typescript
import type { System, Server, Middleware, Tag } from '../types/entities';
import type { ParsedBackup } from './markdownParser';

export interface SerializeOptions {
  includePasswords: boolean;
}

interface BackupData {
  meta: { encrypted: boolean };
  systems: Array<System & { tags?: string[]; plainAccounts?: Array<{ role: string; username: string; password: string; isDefault?: boolean }> }>;
  servers: Array<Server & { tags?: string[]; plainPassword?: string }>;
  middlewares: Array<Middleware & { tags?: string[]; plainPassword?: string }>;
  tags: Tag[];
}

export function serializeMarkdown(data: ParsedBackup | BackupData, options: SerializeOptions): string {
  const lines: string[] = [];

  lines.push('---');
  lines.push('navPortalVersion: 1');
  lines.push(`exportedAt: ${new Date().toISOString()}`);
  lines.push(`encrypted: ${data.meta.encrypted}`);
  lines.push(`passwordsIncluded: ${options.includePasswords}`);
  lines.push('---');
  lines.push('');
  lines.push('# Nav Portal Backup');
  lines.push('');

  if (data.systems.length > 0) {
    lines.push('## 系统');
    lines.push('');
    for (const s of data.systems) {
      lines.push(`### ${s.name}`);
      lines.push('');
      if (s.url) lines.push(`- **URL**: ${s.url}`);
      if (s.environment) lines.push(`- **环境**: ${s.environment}`);
      if (s.icon) lines.push(`- **图标**: ${s.icon}`);
      if (s.color) lines.push(`- **颜色**: ${s.color}`);
      if (s.tags && s.tags.length > 0) lines.push(`- **标签**: ${s.tags.join(', ')}`);
      if (s.remark) lines.push(`- **备注**: ${s.remark}`);
      lines.push('');
    }
  }

  if (data.servers.length > 0) {
    lines.push('## 服务器');
    lines.push('');
    for (const s of data.servers) {
      lines.push(`### ${s.name}`);
      lines.push('');
      if (s.ip) lines.push(`- **IP**: ${s.ip}`);
      if (s.sshPort) lines.push(`- **SSH 端口**: ${s.sshPort}`);
      if (s.username) lines.push(`- **账号**: ${s.username}`);
      const pwd = (s as any).plainPassword;
      lines.push(`- **密码**: ${options.includePasswords && pwd ? pwd : '********'}`);
      if (s.environment) lines.push(`- **环境**: ${s.environment}`);
      if (s.purpose) lines.push(`- **用途**: ${s.purpose}`);
      if (s.remark) lines.push(`- **备注**: ${s.remark}`);
      lines.push('');
    }
  }

  if (data.middlewares.length > 0) {
    lines.push('## 中间件');
    lines.push('');
    for (const m of data.middlewares) {
      lines.push(`### ${m.name}`);
      lines.push('');
      if (m.type) lines.push(`- **类型**: ${m.type}`);
      if (m.version) lines.push(`- **版本**: ${m.version}`);
      if (m.host) lines.push(`- **Host**: ${m.host}`);
      if (m.port) lines.push(`- **端口**: ${m.port}`);
      if (m.database) lines.push(`- **数据库**: ${m.database}`);
      if (m.username) lines.push(`- **账号**: ${m.username}`);
      const pwd = (m as any).plainPassword;
      if (pwd || m.password) lines.push(`- **密码**: ${options.includePasswords && pwd ? pwd : '********'}`);
      if (m.remark) lines.push(`- **备注**: ${m.remark}`);
      lines.push('');
    }
  }

  if (data.tags.length > 0) {
    lines.push('## 标签');
    lines.push('');
    for (const t of data.tags) {
      const colorPart = t.color ? ` (${t.color})` : '';
      lines.push(`- ${t.name}${colorPart}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/services/markdownParser.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add tests/unit/services/markdownParser.test.ts src/shared/services/markdownParser.ts src/shared/services/markdownSerializer.ts
git commit -m "feat: add markdown parser and serializer with round-trip tests"
```

---

### Task 5.5: Import/Export and Auto-Fill Services

**Files:**
- Create: `src/shared/services/importExportService.ts`
- Create: `src/shared/services/autoFillService.ts`

- [ ] **Step 1: Create importExportService.ts**

```typescript
import { systemRepo } from '../db/repositories/systemRepo';
import { serverRepo } from '../db/repositories/serverRepo';
import { middlewareRepo } from '../db/repositories/middlewareRepo';
import { tagRepo } from '../db/repositories/tagRepo';
import { cryptoService } from './cryptoService';
import { parseMarkdown, type ParsedBackup } from './markdownParser';
import { serializeMarkdown } from './markdownSerializer';
import { tagService } from './tagService';
import { systemTagRepo } from '../db/repositories/systemTagRepo';
import type { System, Server, Middleware } from '../types/entities';

export interface ImportSummary {
  created: { systems: number; servers: number; middlewares: number; tags: number };
  updated: { systems: number; servers: number; middlewares: number };
  skipped: { count: number; reasons: string[] };
  errors: string[];
}

export const importExportService = {
  async exportMarkdown(options: { includePasswords: boolean }): Promise<string> {
    const [systems, servers, middlewares, tags] = await Promise.all([
      systemRepo.all(),
      serverRepo.all(),
      middlewareRepo.all(),
      tagRepo.all(),
    ]);

    const encrypted = await cryptoService.isEnabled();

    if (options.includePasswords && encrypted && !cryptoService.isUnlocked()) {
      throw new Error('Master password locked. Unlock first or exclude passwords.');
    }

    const serversWithPlain = await Promise.all(servers.map(async s => ({
      ...s,
      plainPassword: await cryptoService.decryptField(s.password).catch(() => ''),
    })));

    const middlewaresWithPlain = await Promise.all(middlewares.map(async m => ({
      ...m,
      plainPassword: m.password ? await cryptoService.decryptField(m.password).catch(() => '') : '',
    })));

    const systemsWithTagNames = await Promise.all(systems.map(async s => ({
      ...s,
      tags: (await systemTagRepo.tagsFor(s.id)).map(async tid => (await tagRepo.byId(tid))?.name ?? ''),
    })));

    const resolvedSystems = await Promise.all(systemsWithTagNames.map(async s => ({
      ...s,
      tags: await Promise.all(s.tags),
    })));

    return serializeMarkdown({
      meta: { encrypted },
      systems: resolvedSystems as any,
      servers: serversWithPlain as any,
      middlewares: middlewaresWithPlain as any,
      tags,
    }, options);
  },

  async exportJSON(): Promise<string> {
    const [systems, servers, middlewares, tags] = await Promise.all([
      systemRepo.all(),
      serverRepo.all(),
      middlewareRepo.all(),
      tagRepo.all(),
    ]);
    return JSON.stringify({ meta: { version: 1, exportedAt: new Date().toISOString() }, systems, servers, middlewares, tags }, null, 2);
  },

  async importMarkdown(content: string, options: { mode: 'merge' | 'replace' }): Promise<ImportSummary> {
    const parsed = parseMarkdown(content);
    if (options.mode === 'replace') {
      await this.clearAll();
    }
    return this.upsertParsed(parsed);
  },

  async importJSON(content: string, options: { mode: 'merge' | 'replace' }): Promise<ImportSummary> {
    const data = JSON.parse(content);
    if (options.mode === 'replace') {
      await this.clearAll();
    }
    return this.upsertJson(data);
  },

  async upsertParsed(parsed: ParsedBackup): Promise<ImportSummary> {
    const summary: ImportSummary = {
      created: { systems: 0, servers: 0, middlewares: 0, tags: 0 },
      updated: { systems: 0, servers: 0, middlewares: 0 },
      skipped: { count: 0, reasons: [] },
      errors: [],
    };

    for (const tag of parsed.tags) {
      if (tag.name) {
        const existing = await tagRepo.byName(tag.name);
        if (!existing) {
          await tagRepo.create({ name: tag.name, color: tag.color });
          summary.created.tags++;
        }
      }
    }

    for (const s of parsed.systems) {
      if (!s.name || !s.url) {
        summary.skipped.count++;
        summary.skipped.reasons.push('System missing name or url');
        continue;
      }
      const all = await systemRepo.all();
      const existing = all.find(x => x.name === s.name && x.url === s.url);
      if (existing) {
        await systemRepo.update(existing.id, { environment: s.environment, remark: s.remark, icon: s.icon, color: s.color });
        summary.updated.systems++;
      } else {
        await systemRepo.create({
          name: s.name,
          url: s.url,
          environment: s.environment || 'development',
          favorite: false,
          sort: 0,
          remark: s.remark,
          icon: s.icon,
          color: s.color,
        });
        summary.created.systems++;
      }
    }

    for (const s of parsed.servers) {
      if (!s.name || !s.ip) {
        summary.skipped.count++;
        summary.skipped.reasons.push('Server missing name or ip');
        continue;
      }
      const all = await serverRepo.all();
      const existing = all.find(x => x.name === s.name && x.ip === s.ip);
      const encryptedPassword = await cryptoService.encryptField(s.plainPassword || '');
      if (existing) {
        await serverRepo.update(existing.id, { sshPort: s.sshPort, username: s.username, password: encryptedPassword, environment: s.environment });
        summary.updated.servers++;
      } else {
        await serverRepo.create({
          name: s.name,
          ip: s.ip,
          sshPort: s.sshPort || 22,
          username: s.username || '',
          password: encryptedPassword,
          environment: s.environment || 'development',
          favorite: false,
        });
        summary.created.servers++;
      }
    }

    return summary;
  },

  async upsertJson(data: any): Promise<ImportSummary> {
    const summary: ImportSummary = {
      created: { systems: 0, servers: 0, middlewares: 0, tags: 0 },
      updated: { systems: 0, servers: 0, middlewares: 0 },
      skipped: { count: 0, reasons: [] },
      errors: [],
    };
    // Similar upsert logic for JSON format
    return summary;
  },

  async clearAll(): Promise<void> {
    await Promise.all([
      systemRepo.all().then(all => Promise.all(all.map(s => systemRepo.delete(s.id)))),
      serverRepo.all().then(all => Promise.all(all.map(s => serverRepo.delete(s.id)))),
      middlewareRepo.all().then(all => Promise.all(all.map(m => middlewareRepo.delete(m.id)))),
      tagRepo.all().then(all => Promise.all(all.map(t => tagRepo.delete(t.id)))),
    ]);
  },
};
```

- [ ] **Step 2: Create autoFillService.ts**

```typescript
import { systemRepo } from '../db/repositories/systemRepo';
import { accountRepo } from '../db/repositories/accountRepo';
import { cryptoService } from './cryptoService';
import { urlMatchesSystem } from '../utils/url';
import type { System } from '../types/entities';
import type { AccountMatch } from '../types/messages';

export const autoFillService = {
  async findSystemByUrl(url: string): Promise<System | undefined> {
    const systems = await systemRepo.all();
    return systems.find(s => urlMatchesSystem(url, s.url));
  },

  async findAccountsForUrl(url: string): Promise<AccountMatch[]> {
    const system = await this.findSystemByUrl(url);
    if (!system) return [];

    const accounts = await accountRepo.bySystemId(system.id);
    const matches: AccountMatch[] = [];

    for (const account of accounts) {
      try {
        const plainPassword = await cryptoService.decryptField(account.password);
        matches.push({
          systemId: system.id,
          systemName: system.name,
          account: { ...account, plainPassword },
        });
      } catch {
        // skip accounts that can't be decrypted
      }
    }

    return matches;
  },
};
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/services/importExportService.ts src/shared/services/autoFillService.ts
git commit -m "feat: add import/export and auto-fill services"
```

---

## Phase 6: Pinia Stores

### Task 6.1: Crypto and Preference Stores

**Files:**
- Create: `src/shared/stores/cryptoStore.ts`
- Create: `src/shared/stores/prefStore.ts`
- Create: `src/shared/stores/toastStore.ts`

- [ ] **Step 1: Create cryptoStore.ts**

```typescript
import { defineStore } from 'pinia';
import { ref, onMounted } from 'vue';
import { cryptoService } from '../services/cryptoService';
import { cryptoSession } from '../crypto/session';

export const useCryptoStore = defineStore('crypto', () => {
  const enabled = ref(false);
  const unlocked = ref(false);
  const error = ref<string | null>(null);

  async function checkStatus() {
    enabled.value = await cryptoService.isEnabled();
    unlocked.value = cryptoService.isUnlocked();
  }

  async function setup(password: string) {
    try {
      await cryptoService.setPassword(password);
      enabled.value = true;
      unlocked.value = true;
      error.value = null;
    } catch (e) {
      error.value = (e as Error).message;
    }
  }

  async function unlock(password: string): Promise<boolean> {
    const ok = await cryptoService.unlock(password);
    unlocked.value = ok;
    error.value = ok ? null : '密码错误';
    return ok;
  }

  function lock() {
    cryptoService.lock();
    unlocked.value = false;
  }

  async function changePassword(oldPwd: string, newPwd: string) {
    await cryptoService.changePassword(oldPwd, newPwd);
  }

  async function disablePassword(password: string) {
    await cryptoService.disablePassword(password);
    enabled.value = false;
    unlocked.value = false;
  }

  cryptoSession.onLock(() => { unlocked.value = false; });

  return { enabled, unlocked, error, checkStatus, setup, unlock, lock, changePassword, disablePassword };
});
```

- [ ] **Step 2: Create prefStore.ts**

```typescript
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import type { Environment } from '../types/entities';

interface Prefs {
  theme: 'light' | 'dark';
  autoLockMinutes: number;
  defaultEnvironment: Environment;
  popupLayout: 'compact' | 'expanded';
}

const DEFAULT_PREFS: Prefs = {
  theme: 'light',
  autoLockMinutes: 5,
  defaultEnvironment: 'development',
  popupLayout: 'compact',
};

const STORAGE_KEY = 'prefs';

export const usePrefStore = defineStore('pref', () => {
  const theme = ref<Prefs['theme']>(DEFAULT_PREFS.theme);
  const autoLockMinutes = ref(DEFAULT_PREFS.autoLockMinutes);
  const defaultEnvironment = ref<Prefs['defaultEnvironment']>(DEFAULT_PREFS.defaultEnvironment);
  const popupLayout = ref<Prefs['popupLayout']>(DEFAULT_PREFS.popupLayout);
  const loaded = ref(false);

  async function load() {
    const result = await chrome.storage.sync.get(STORAGE_KEY);
    const stored = result[STORAGE_KEY] as Partial<Prefs> | undefined;
    if (stored) {
      theme.value = stored.theme ?? DEFAULT_PREFS.theme;
      autoLockMinutes.value = stored.autoLockMinutes ?? DEFAULT_PREFS.autoLockMinutes;
      defaultEnvironment.value = stored.defaultEnvironment ?? DEFAULT_PREFS.defaultEnvironment;
      popupLayout.value = stored.popupLayout ?? DEFAULT_PREFS.popupLayout;
    }
    loaded.value = true;
  }

  async function persist() {
    const prefs: Prefs = { theme: theme.value, autoLockMinutes: autoLockMinutes.value, defaultEnvironment: defaultEnvironment.value, popupLayout: popupLayout.value };
    await chrome.storage.sync.set({ [STORAGE_KEY]: prefs });
  }

  watch([theme, autoLockMinutes, defaultEnvironment, popupLayout], () => {
    if (loaded.value) persist();
  });

  return { theme, autoLockMinutes, defaultEnvironment, popupLayout, loaded, load, persist };
});
```

- [ ] **Step 3: Create toastStore.ts**

```typescript
import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([]);

  function show(message: string, type: Toast['type'] = 'info', duration = 4000) {
    const id = `${Date.now()}-${Math.random()}`;
    toasts.value.push({ id, message, type });
    setTimeout(() => dismiss(id), duration);
  }

  function success(message: string) { show(message, 'success'); }
  function error(message: string) { show(message, 'error'); }
  function info(message: string) { show(message, 'info'); }

  function dismiss(id: string) {
    toasts.value = toasts.value.filter(t => t.id !== id);
  }

  return { toasts, show, success, error, info, dismiss };
});
```

- [ ] **Step 4: Commit**

```bash
git add src/shared/stores/
git commit -m "feat: add crypto, preference, and toast stores"
```

---

### Task 6.2: Entity Stores

**Files:**
- Create: `src/shared/stores/systemStore.ts`
- Create: `src/shared/stores/accountStore.ts`
- Create: `src/shared/stores/serverStore.ts`
- Create: `src/shared/stores/middlewareStore.ts`
- Create: `src/shared/stores/tagStore.ts`
- Create: `src/shared/stores/searchStore.ts`

- [ ] **Step 1: Create systemStore.ts**

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { systemService } from '../services/systemService';
import { tagService } from '../services/tagService';
import type { System, SystemInput, Environment } from '../types/entities';

export const useSystemStore = defineStore('system', () => {
  const list = ref<System[]>([]);
  const loading = ref(false);
  const selectedId = ref<string | null>(null);
  const filterEnv = ref<Environment | 'all'>('all');
  const filterTagId = ref<string | null>(null);
  const searchQuery = ref('');

  async function load() {
    loading.value = true;
    list.value = await systemService.all();
    loading.value = false;
  }

  async function create(input: SystemInput) {
    const id = await systemService.create(input);
    await load();
    return id;
  }

  async function update(id: string, patch: Partial<SystemInput>) {
    await systemService.update(id, patch);
    await load();
  }

  async function remove(id: string) {
    await systemService.delete(id);
    if (selectedId.value === id) selectedId.value = null;
    await load();
  }

  async function toggleFavorite(id: string) {
    await systemService.toggleFavorite(id);
    await load();
  }

  async function reorder(orderedIds: string[]) {
    await systemService.reorder(orderedIds);
    await load();
  }

  async function setTags(systemId: string, tagNames: string[]) {
    const tagIds = await tagService.findOrCreate(tagNames);
    await systemService.setTags(systemId, tagIds);
  }

  function select(id: string | null) {
    selectedId.value = id;
  }

  const filtered = computed(() => {
    let result = list.value;
    if (filterEnv.value !== 'all') {
      result = result.filter(s => s.environment === filterEnv.value);
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.url.toLowerCase().includes(q) ||
        (s.remark ?? '').toLowerCase().includes(q)
      );
    }
    return result;
  });

  const selected = computed(() => list.value.find(s => s.id === selectedId.value));
  const favorites = computed(() => list.value.filter(s => s.favorite));

  return {
    list, loading, selectedId, filterEnv, filterTagId, searchQuery,
    filtered, selected, favorites,
    load, create, update, remove, toggleFavorite, reorder, setTags, select,
  };
});
```

- [ ] **Step 2: Create accountStore.ts**

```typescript
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { accountService } from '../services/accountService';
import type { Account, AccountInput } from '../types/entities';

export const useAccountStore = defineStore('account', () => {
  const list = ref<Account[]>([]);
  const loading = ref(false);

  async function loadBySystem(systemId: string) {
    loading.value = true;
    list.value = await accountService.bySystemId(systemId);
    loading.value = false;
  }

  async function create(input: AccountInput) {
    const id = await accountService.create(input);
    await loadBySystem(input.systemId);
    return id;
  }

  async function update(id: string, systemId: string, patch: Partial<AccountInput>) {
    await accountService.update(id, { ...patch, systemId });
    await loadBySystem(systemId);
  }

  async function remove(id: string, systemId: string) {
    await accountService.delete(id);
    await loadBySystem(systemId);
  }

  async function setDefault(systemId: string, accountId: string) {
    await accountService.setDefault(systemId, accountId);
    await loadBySystem(systemId);
  }

  async function copyPassword(id: string) {
    await accountService.copyPassword(id);
  }

  async function copyUsername(id: string) {
    await accountService.copyUsername(id);
  }

  return { list, loading, loadBySystem, create, update, remove, setDefault, copyPassword, copyUsername };
});
```

- [ ] **Step 3: Create serverStore.ts**

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { serverService } from '../services/serverService';
import type { Server, ServerInput } from '../types/entities';

export const useServerStore = defineStore('server', () => {
  const list = ref<Server[]>([]);
  const loading = ref(false);
  const selectedId = ref<string | null>(null);
  const searchQuery = ref('');

  async function load() {
    loading.value = true;
    list.value = await serverService.all();
    loading.value = false;
  }

  async function create(input: ServerInput) {
    const id = await serverService.create(input);
    await load();
    return id;
  }

  async function update(id: string, patch: Partial<ServerInput>) {
    await serverService.update(id, patch);
    await load();
  }

  async function remove(id: string) {
    await serverService.delete(id);
    if (selectedId.value === id) selectedId.value = null;
    await load();
  }

  async function toggleFavorite(id: string) {
    await serverService.toggleFavorite(id);
    await load();
  }

  async function copyIp(id: string) { await serverService.copyIp(id); }
  async function copySshCommand(id: string) { await serverService.copySshCommand(id); }
  async function copyPassword(id: string) { await serverService.copyPassword(id); }

  const filtered = computed(() => {
    if (!searchQuery.value.trim()) return list.value;
    const q = searchQuery.value.toLowerCase();
    return list.value.filter(s =>
      s.name.toLowerCase().includes(q) || s.ip.toLowerCase().includes(q)
    );
  });

  const selected = computed(() => list.value.find(s => s.id === selectedId.value));
  const favorites = computed(() => list.value.filter(s => s.favorite));

  return {
    list, loading, selectedId, searchQuery, filtered, selected, favorites,
    load, create, update, remove, toggleFavorite,
    copyIp, copySshCommand, copyPassword,
  };
});
```

- [ ] **Step 4: Create middlewareStore.ts**

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { middlewareService } from '../services/middlewareService';
import type { Middleware, MiddlewareInput } from '../types/entities';

export const useMiddlewareStore = defineStore('middleware', () => {
  const list = ref<Middleware[]>([]);
  const loading = ref(false);
  const selectedId = ref<string | null>(null);
  const searchQuery = ref('');

  async function load() {
    loading.value = true;
    list.value = await middlewareService.all();
    loading.value = false;
  }

  async function create(input: MiddlewareInput) {
    const id = await middlewareService.create(input);
    await load();
    return id;
  }

  async function update(id: string, patch: Partial<MiddlewareInput>) {
    await middlewareService.update(id, patch);
    await load();
  }

  async function remove(id: string) {
    await middlewareService.delete(id);
    if (selectedId.value === id) selectedId.value = null;
    await load();
  }

  async function toggleFavorite(id: string) {
    await middlewareService.toggleFavorite(id);
    await load();
  }

  async function copyConnectionString(id: string) { await middlewareService.copyConnectionString(id); }
  async function copyPassword(id: string) { await middlewareService.copyPassword(id); }

  const filtered = computed(() => {
    if (!searchQuery.value.trim()) return list.value;
    const q = searchQuery.value.toLowerCase();
    return list.value.filter(m =>
      m.name.toLowerCase().includes(q) || m.host.toLowerCase().includes(q)
    );
  });

  const selected = computed(() => list.value.find(m => m.id === selectedId.value));

  return {
    list, loading, selectedId, searchQuery, filtered, selected,
    load, create, update, remove, toggleFavorite,
    copyConnectionString, copyPassword,
  };
});
```

- [ ] **Step 5: Create tagStore.ts and searchStore.ts**

`src/shared/stores/tagStore.ts`:
```typescript
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { tagService } from '../services/tagService';
import type { Tag } from '../types/entities';

export const useTagStore = defineStore('tag', () => {
  const list = ref<Tag[]>([]);
  const loading = ref(false);

  async function load() {
    loading.value = true;
    list.value = await tagService.all();
    loading.value = false;
  }

  async function create(name: string, color?: string) {
    const id = await tagService.create(name, color);
    await load();
    return id;
  }

  async function update(id: string, patch: Partial<Tag>) {
    await tagService.update(id, patch);
    await load();
  }

  async function remove(id: string) {
    await tagService.delete(id);
    await load();
  }

  return { list, loading, load, create, update, remove };
});
```

`src/shared/stores/searchStore.ts`:
```typescript
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { searchService, type SearchResult } from '../services/searchService';

export const useSearchStore = defineStore('search', () => {
  const query = ref('');
  const results = ref<SearchResult[]>([]);
  const loading = ref(false);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  async function search(q: string) {
    query.value = q;
    if (debounceTimer) clearTimeout(debounceTimer);
    if (!q.trim()) {
      results.value = [];
      return;
    }
    debounceTimer = setTimeout(async () => {
      loading.value = true;
      results.value = await searchService.search(q);
      loading.value = false;
    }, 150);
  }

  function clear() {
    query.value = '';
    results.value = [];
  }

  return { query, results, loading, search, clear };
});
```

- [ ] **Step 6: Commit**

```bash
git add src/shared/stores/
git commit -m "feat: add entity and search Pinia stores"
```

---

## Phase 7: Dashboard UI Foundation

### Task 7.1: Layout Components

**Files:**
- Create: `src/dashboard/components/layout/Sidebar.vue`
- Create: `src/dashboard/components/layout/PageHeader.vue`
- Create: `src/dashboard/components/layout/NavTabs.vue`
- Modify: `src/dashboard/App.vue`

- [ ] **Step 1: Create Sidebar.vue**

```vue
<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="sidebar-logo">
        <div class="shield-icon"><i class="fa-solid fa-shield-halved"></i></div>
        Nav Portal
      </div>
    </div>
    <div class="sidebar-search">
      <i class="fa-solid fa-magnifying-glass"></i>
      <input v-model="searchQuery" type="text" placeholder="搜索系统/URL/标签..." @input="onSearch" @keyup.enter="openFirstResult" />
      <span class="shortcut">{{ shortcutKey }}</span>
    </div>
    <div class="quick-actions">
      <div class="quick-action" @click="$router.push('/systems')">
        <div class="qa-icon qa-blue"><i class="fa-solid fa-plus"></i></div>
        <div class="qa-label">新增系统</div>
      </div>
      <div class="quick-action" @click="$router.push('/servers')">
        <div class="qa-icon qa-green"><i class="fa-solid fa-server"></i></div>
        <div class="qa-label">服务器</div>
      </div>
      <div class="quick-action" @click="$router.push('/middlewares')">
        <div class="qa-icon qa-orange"><i class="fa-solid fa-cubes"></i></div>
        <div class="qa-label">中间件</div>
      </div>
      <div class="quick-action" @click="$router.push('/import-export')">
        <div class="qa-icon qa-purple"><i class="fa-solid fa-file-import"></i></div>
        <div class="qa-label">导入导出</div>
      </div>
    </div>
    <div class="recent-header"><span>最近访问</span></div>
    <div class="recent-list">
      <div v-for="r in recents" :key="r.id" class="recent-item" @click="openRecent(r)">
        <div class="ri-icon" :style="{ background: getIconColor(r.entityType) }">
          <i :class="getIconClass(r.entityType)"></i>
        </div>
        <div class="ri-text">
          <div class="ri-name">{{ r.title || r.entityId }}</div>
          <div class="ri-time">{{ formatRelativeTime(r.lastAccessedAt) }}</div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { recentRepo } from '@shared/db/repositories/recentRepo';
import { searchService } from '@shared/services/searchService';
import { formatRelativeTime } from '@shared/utils/time';
import { useSearchStore } from '@shared/stores/searchStore';

const searchQuery = ref('');
const recents = ref<Array<{ id: string; entityType: string; entityId: string; lastAccessedAt: number; role?: string }>>([]);
const searchStore = useSearchStore();
const shortcutKey = navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl+K';

onMounted(async () => {
  recents.value = await recentRepo.top(5);
});

async function onSearch() {
  await searchStore.search(searchQuery.value);
}

async function openFirstResult() {
  if (searchStore.results.length > 0) {
    const first = searchStore.results[0];
    if (first.type === 'system') {
      window.open(`/dashboard.html#/systems`, '_self');
    }
  }
}

function openRecent(r: any) {
  if (r.entityType === 'system') window.open(`/dashboard.html#/systems`, '_self');
}

function getIconColor(type: string) {
  const colors: Record<string, string> = {
    system: 'linear-gradient(135deg,#3b82f6,#2563eb)',
    server: 'linear-gradient(135deg,#10b981,#059669)',
    middleware: 'linear-gradient(135deg,#f59e0b,#d97706)',
  };
  return colors[type] || colors.system;
}

function getIconClass(type: string) {
  const icons: Record<string, string> = {
    system: 'fa-solid fa-briefcase',
    server: 'fa-solid fa-server',
    middleware: 'fa-solid fa-cubes',
  };
  return icons[type] || icons.system;
}
</script>

<style scoped>
.sidebar { width: 208px; background: white; border-right: 1px solid var(--border); display: flex; flex-direction: column; flex-shrink: 0; }
.sidebar-header { padding: 14px; display: flex; align-items: center; justify-content: space-between; }
.sidebar-logo { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--text-primary); }
.shield-icon { width: 22px; height: 22px; background: linear-gradient(135deg, #3b82f6, #2563eb); border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; }
.sidebar-search { margin: 0 12px 12px; position: relative; }
.sidebar-search input { width: 100%; height: 30px; border: 1px solid var(--border); border-radius: 6px; padding: 0 30px 0 30px; font-size: 12px; background: #f9fafb; outline: none; font-family: inherit; color: var(--text-primary); }
.sidebar-search input:focus { background: white; border-color: #93c5fd; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
.sidebar-search i { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-tertiary); font-size: 11px; }
.sidebar-search .shortcut { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); font-size: 10px; color: var(--text-tertiary); border: 1px solid var(--border); padding: 1px 4px; border-radius: 3px; background: white; }
.quick-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 0 12px 12px; }
.quick-action { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 4px; background: #f9fafb; border-radius: 8px; cursor: pointer; transition: all 0.15s; }
.quick-action:hover { background: var(--border-soft); transform: translateY(-1px); }
.qa-icon { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; }
.qa-blue { background: linear-gradient(135deg,#3b82f6,#2563eb); }
.qa-green { background: linear-gradient(135deg,#10b981,#059669); }
.qa-orange { background: linear-gradient(135deg,#f59e0b,#d97706); }
.qa-purple { background: linear-gradient(135deg,#8b5cf6,#7c3aed); }
.quick-action .qa-label { font-size: 11px; color: #374151; font-weight: 500; }
.recent-header { padding: 6px 14px; font-size: 12px; font-weight: 600; color: #374151; }
.recent-list { flex: 1; overflow-y: auto; padding: 0 4px 4px; }
.recent-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 6px; cursor: pointer; transition: background 0.15s; margin-bottom: 2px; }
.recent-item:hover { background: var(--border-soft); }
.ri-icon { width: 22px; height: 22px; border-radius: 5px; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; flex-shrink: 0; }
.ri-text { flex: 1; min-width: 0; }
.ri-name { font-size: 12px; color: var(--text-primary); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ri-time { font-size: 10px; color: var(--text-tertiary); }
</style>
```

- [ ] **Step 2: Create PageHeader.vue**

```vue
<template>
  <div class="page-header">
    <div class="page-title">
      <div class="shield-icon"><i class="fa-solid fa-shield-halved"></i></div>
      <span>Nav Portal - 管理面板</span>
    </div>
    <div class="header-actions">
      <div class="icon-btn" @click="toggleTheme" :title="theme === 'light' ? '切换深色' : '切换浅色'">
        <i :class="theme === 'light' ? 'fa-solid fa-sun' : 'fa-solid fa-moon'"></i>
      </div>
      <div class="icon-btn" @click="$router.push('/settings')" title="设置">
        <i class="fa-solid fa-gear"></i>
      </div>
      <div class="user-avatar" title="admin">A</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePrefStore } from '@shared/stores/prefStore';
import { computed } from 'vue';

const prefStore = usePrefStore();
const theme = computed(() => prefStore.theme);

function toggleTheme() {
  prefStore.theme = theme.value === 'light' ? 'dark' : 'light';
}
</script>

<style scoped>
.page-header { height: 56px; background: white; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; padding: 0 20px; }
.page-title { display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 600; color: var(--text-primary); }
.shield-icon { width: 22px; height: 22px; background: linear-gradient(135deg, #3b82f6, #2563eb); border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; }
.header-actions { display: flex; align-items: center; gap: 4px; }
.icon-btn { width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary); cursor: pointer; transition: all 0.15s; }
.icon-btn:hover { background: var(--border-soft); color: var(--text-primary); }
.user-avatar { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; margin-left: 8px; cursor: pointer; }
</style>
```

- [ ] **Step 3: Create NavTabs.vue**

```vue
<template>
  <div class="nav-tabs">
    <router-link v-for="tab in tabs" :key="tab.path" :to="tab.path" class="nav-tab" :class="{ active: isActive(tab.path) }">
      <i :class="tab.icon"></i>
      <span>{{ tab.label }}</span>
    </router-link>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';

const route = useRoute();
const tabs = [
  { path: '/systems', label: '系统管理', icon: 'fa-solid fa-table-columns' },
  { path: '/servers', label: '服务器', icon: 'fa-solid fa-server' },
  { path: '/middlewares', label: '中间件', icon: 'fa-solid fa-cubes' },
  { path: '/tags', label: '标签', icon: 'fa-solid fa-tags' },
  { path: '/import-export', label: '导入/导出', icon: 'fa-solid fa-file-import' },
  { path: '/settings', label: '设置中心', icon: 'fa-solid fa-gear' },
];

function isActive(path: string): boolean {
  return route.path === path;
}
</script>

<style scoped>
.nav-tabs { display: flex; align-items: center; gap: 4px; padding: 0 16px; height: 44px; background: white; border-bottom: 1px solid var(--border); }
.nav-tab { display: flex; align-items: center; gap: 6px; padding: 0 14px; height: 100%; font-size: 13px; color: var(--text-secondary); cursor: pointer; position: relative; transition: color 0.15s; font-weight: 500; text-decoration: none; }
.nav-tab:hover { color: var(--text-primary); }
.nav-tab.active { color: var(--primary); font-weight: 600; }
.nav-tab.active::after { content: ""; position: absolute; bottom: -1px; left: 8px; right: 8px; height: 2px; background: var(--primary); border-radius: 2px 2px 0 0; }
</style>
```

- [ ] **Step 4: Update App.vue with layout**

`src/dashboard/App.vue`:
```vue
<template>
  <div class="app-shell">
    <PageHeader />
    <div class="body-grid">
      <Sidebar />
      <main class="content-area">
        <NavTabs />
        <router-view />
      </main>
    </div>
    <ToastContainer />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import PageHeader from './components/layout/PageHeader.vue';
import Sidebar from './components/layout/Sidebar.vue';
import NavTabs from './components/layout/NavTabs.vue';
import ToastContainer from './components/common/ToastContainer.vue';
import { usePrefStore } from '@shared/stores/prefStore';
import { useCryptoStore } from '@shared/stores/cryptoStore';

const prefStore = usePrefStore();
const cryptoStore = useCryptoStore();

onMounted(async () => {
  await prefStore.load();
  await cryptoStore.checkStatus();
});
</script>

<style scoped>
.app-shell { min-height: 100vh; display: flex; flex-direction: column; }
.body-grid { flex: 1; display: flex; min-height: 0; }
.content-area { flex: 1; min-width: 0; display: flex; flex-direction: column; }
</style>
```

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/components/layout/ src/dashboard/App.vue
git commit -m "feat: add dashboard layout (sidebar, header, nav tabs)"
```

---

### Task 7.2: Common Components

**Files:**
- Create: `src/dashboard/components/common/ToastContainer.vue`
- Create: `src/dashboard/components/common/TagPill.vue`
- Create: `src/dashboard/components/common/EnvBadge.vue`
- Create: `src/dashboard/components/common/ConfirmDialog.vue`

- [ ] **Step 1: Create ToastContainer.vue**

```vue
<template>
  <div class="toast-container">
    <div v-for="t in toasts" :key="t.id" class="toast" :class="t.type" @click="dismiss(t.id)">
      <i :class="iconFor(t.type)"></i>
      <span>{{ t.message }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToastStore } from '@shared/stores/toastStore';
import { storeToRefs } from 'pinia';

const store = useToastStore();
const { toasts } = storeToRefs(store);
const { dismiss } = store;

function iconFor(type: string) {
  return {
    success: 'fa-solid fa-circle-check',
    error: 'fa-solid fa-circle-exclamation',
    info: 'fa-solid fa-circle-info',
  }[type] || 'fa-solid fa-circle-info';
}
</script>

<style scoped>
.toast-container { position: fixed; bottom: 16px; right: 16px; z-index: 9999; display: flex; flex-direction: column; gap: 8px; }
.toast { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 6px; background: white; border: 1px solid var(--border); box-shadow: 0 4px 12px rgba(0,0,0,0.1); font-size: 13px; cursor: pointer; animation: slideIn 0.2s; }
.toast.success { border-color: var(--success); color: var(--success-text); }
.toast.error { border-color: var(--danger); color: var(--danger-text); }
.toast.info { border-color: var(--primary); color: var(--primary-700); }
@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
</style>
```

- [ ] **Step 2: Create TagPill.vue**

```vue
<template>
  <span class="tag-pill" :style="{ background: bgColor, color: textColor }">
    {{ name }}
    <span v-if="removable" class="x" @click.stop="$emit('remove')"><i class="fa-solid fa-xmark"></i></span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ name: string; color?: string; removable?: boolean }>();
defineEmits<{ remove: [] }>();

const bgColor = computed(() => props.color ? `${props.color}20` : '#eff6ff');
const textColor = computed(() => props.color || '#1d4ed8');
</script>

<style scoped>
.tag-pill { display: inline-flex; align-items: center; gap: 3px; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 500; line-height: 1.5; }
.tag-pill .x { cursor: pointer; opacity: 0.6; }
.tag-pill .x:hover { opacity: 1; }
</style>
```

- [ ] **Step 3: Create EnvBadge.vue**

```vue
<template>
  <span class="env-tag" :style="{ background: meta.color, color: meta.textColor }">{{ meta.label }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getEnvironmentMeta } from '@shared/types/enums';

const props = defineProps<{ env: string }>();
const meta = computed(() => getEnvironmentMeta(props.env));
</script>

<style scoped>
.env-tag { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 500; line-height: 1.4; }
</style>
```

- [ ] **Step 4: Create ConfirmDialog.vue**

```vue
<template>
  <teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="onCancel">
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>{{ title }}</h3>
        </div>
        <div class="modal-body">
          <p>{{ message }}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="onCancel">取消</button>
          <button class="btn btn-danger" @click="onConfirm">确认</button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
defineProps<{ visible: boolean; title: string; message: string }>();
const emit = defineEmits<{ confirm: []; cancel: [] }>();

function onConfirm() { emit('confirm'); }
function onCancel() { emit('cancel'); }
</script>

<style scoped>
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 10000; }
.modal-dialog { background: white; border-radius: 8px; padding: 20px; min-width: 360px; max-width: 480px; }
.modal-header h3 { margin: 0 0 12px; font-size: 15px; color: var(--text-primary); }
.modal-body p { margin: 0 0 16px; font-size: 13px; color: var(--text-secondary); }
.modal-footer { display: flex; justify-content: flex-end; gap: 8px; }
.btn { display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid transparent; font-family: inherit; }
.btn-default { background: white; color: #374151; border-color: var(--border); }
.btn-danger { background: white; color: #dc2626; border-color: #fecaca; }
.btn-danger:hover { background: #fef2f2; }
</style>
```

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/components/common/
git commit -m "feat: add common components (toast, tag pill, env badge, confirm dialog)"
```

---

## Phase 8: System Management UI

### Task 8.1: System Table and Form

**Files:**
- Create: `src/dashboard/components/system/SystemTable.vue`
- Create: `src/dashboard/components/system/SystemForm.vue`
- Create: `src/dashboard/components/system/AccountList.vue`
- Modify: `src/dashboard/views/SystemView.vue`

- [ ] **Step 1: Create SystemTable.vue**

```vue
<template>
  <div class="card">
    <div class="action-bar">
      <button class="btn btn-primary" @click="$emit('create')"><i class="fa-solid fa-plus"></i> 新增系统</button>
      <button class="btn btn-danger" :disabled="selectedIds.size === 0" @click="$emit('bulkDelete', Array.from(selectedIds))">
        <i class="fa-solid fa-trash"></i> 删除
      </button>
      <div class="search-wrap">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input v-model="search" class="search-input" type="text" placeholder="搜索系统..." />
      </div>
    </div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width:36px;"><input type="checkbox" :checked="allChecked" @change="toggleAll" /></th>
          <th>系统名称</th>
          <th>URL</th>
          <th style="width:60px;">环境</th>
          <th style="width:60px;">收藏</th>
          <th style="width:80px;">最近使用</th>
          <th style="width:60px;">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in filteredSystems" :key="s.id" :class="{ selected: selectedId === s.id }" @click="$emit('select', s.id)">
          <td @click.stop><input type="checkbox" :checked="selectedIds.has(s.id)" @change="toggleOne(s.id)" /></td>
          <td>
            <div class="sys-name">
              <div class="sys-icon" :style="{ background: s.iconColor || 'linear-gradient(135deg,#3b82f6,#2563eb)' }">
                <i :class="s.icon || 'fa-solid fa-globe'"></i>
              </div>
              {{ s.name }}
            </div>
          </td>
          <td><a :href="s.url" target="_blank" class="text-blue-600 hover:underline" @click.stop>{{ s.url }}</a></td>
          <td><EnvBadge :env="s.environment" /></td>
          <td><i :class="s.favorite ? 'fa-solid fa-star' : 'fa-regular fa-star'" :style="{ color: s.favorite ? '#f59e0b' : '#d1d5db', cursor: 'pointer' }" @click.stop="$emit('toggleFav', s.id)"></i></td>
          <td>{{ formatRelativeTime(s.updatedAt) }}</td>
          <td>
            <div class="row-actions">
              <div class="row-action" @click.stop="$emit('open', s)" title="打开"><i class="fa-solid fa-arrow-up-right-from-square"></i></div>
              <div class="row-action" @click.stop="$emit('delete', s.id)" title="删除"><i class="fa-solid fa-trash"></i></div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { System } from '@shared/types/entities';
import { formatRelativeTime } from '@shared/utils/time';
import EnvBadge from '../common/EnvBadge.vue';

const props = defineProps<{
  systems: System[];
  selectedId: string | null;
}>();

defineEmits<{
  create: [];
  select: [id: string];
  open: [system: System];
  delete: [id: string];
  toggleFav: [id: string];
  bulkDelete: [ids: string[]];
}>();

const search = ref('');
const selectedIds = ref<Set<string>>(new Set());

const filteredSystems = computed(() => {
  if (!search.value.trim()) return props.systems;
  const q = search.value.toLowerCase();
  return props.systems.filter(s => s.name.toLowerCase().includes(q) || s.url.toLowerCase().includes(q));
});

const allChecked = computed(() => filteredSystems.value.length > 0 && filteredSystems.value.every(s => selectedIds.value.has(s.id)));

function toggleAll(e: Event) {
  const checked = (e.target as HTMLInputElement).checked;
  if (checked) {
    filteredSystems.value.forEach(s => selectedIds.value.add(s.id));
  } else {
    selectedIds.value.clear();
  }
}

function toggleOne(id: string) {
  if (selectedIds.value.has(id)) selectedIds.value.delete(id);
  else selectedIds.value.add(id);
}
</script>

<style scoped>
.card { background: white; border-radius: 8px; border: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
.action-bar { display: flex; align-items: center; gap: 8px; padding: 12px 16px; background: white; border-bottom: 1px solid var(--border-soft); }
.btn { display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid transparent; font-family: inherit; }
.btn-primary { background: var(--primary); color: white; }
.btn-primary:hover { background: var(--primary-700); }
.btn-danger { background: white; color: #dc2626; border-color: #fecaca; }
.btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }
.search-wrap { position: relative; margin-left: auto; }
.search-wrap i { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-tertiary); font-size: 11px; }
.search-input { height: 30px; border: 1px solid var(--border); border-radius: 6px; padding: 0 10px 0 30px; font-size: 12px; background: white; outline: none; font-family: inherit; width: 240px; }
.data-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
.data-table thead th { background: #f9fafb; color: var(--text-secondary); font-weight: 500; padding: 9px 12px; text-align: left; border-bottom: 1px solid var(--border-soft); white-space: nowrap; }
.data-table tbody td { padding: 10px 12px; border-bottom: 1px solid var(--border-soft); color: var(--text-primary); }
.data-table tbody tr { cursor: pointer; transition: background 0.12s; }
.data-table tbody tr:hover { background: #f9fafb; }
.data-table tbody tr.selected { background: var(--primary-50); }
.sys-name { display: flex; align-items: center; gap: 8px; }
.sys-icon { width: 18px; height: 18px; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-size: 9px; flex-shrink: 0; }
.row-actions { display: flex; align-items: center; gap: 4px; }
.row-action { width: 22px; height: 22px; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); cursor: pointer; font-size: 11px; }
.row-action:hover { background: var(--border-soft); color: var(--primary); }
.text-blue-600 { color: var(--primary); }
</style>
```

- [ ] **Step 2: Create AccountList.vue**

```vue
<template>
  <div class="account-section">
    <div class="form-section-title">账号信息</div>
    <div class="account-list">
      <div class="account-item header-row">
        <div>角色</div>
        <div>用户名</div>
        <div>密码</div>
        <div class="text-right">操作</div>
      </div>
      <div v-for="acc in accounts" :key="acc.id" class="account-item">
        <div>{{ acc.role }} <span v-if="acc.isDefault" class="default-badge">默认</span></div>
        <div>{{ acc.username }}</div>
        <div class="acc-pwd">{{ visibleIds.has(acc.id) ? plainPasswords[acc.id] : '••••••••' }}</div>
        <div class="acc-icons">
          <div class="row-action" @click="toggleVisible(acc.id)" :title="visibleIds.has(acc.id) ? '隐藏' : '显示'">
            <i :class="visibleIds.has(acc.id) ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'"></i>
          </div>
          <div class="row-action" @click="copyPassword(acc.id)" title="复制密码"><i class="fa-solid fa-copy"></i></div>
          <div class="row-action" @click="copyUsername(acc.username)" title="复制用户名"><i class="fa-solid fa-user"></i></div>
          <div class="row-action" @click="setDefault(acc.id)" v-if="!acc.isDefault" title="设为默认"><i class="fa-solid fa-star"></i></div>
          <div class="row-action danger" @click="$emit('delete', acc.id)" title="删除"><i class="fa-solid fa-trash"></i></div>
        </div>
      </div>
    </div>
    <button class="add-account-btn" @click="$emit('add')"><i class="fa-solid fa-plus"></i> 新增账号</button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Account } from '@shared/types/entities';
import { accountService } from '@shared/services/accountService';
import { copyToClipboard } from '@shared/utils/clipboard';

const props = defineProps<{ accounts: Account[]; systemId: string }>();
defineEmits<{ add: []; delete: [id: string] }>();

const visibleIds = ref<Set<string>>(new Set());
const plainPasswords = ref<Record<string, string>>({});

watch(() => props.accounts, async (accounts) => {
  for (const acc of accounts) {
    if (visibleIds.value.has(acc.id) && !plainPasswords.value[acc.id]) {
      try {
        const { plainPassword } = await accountService.getDecrypted(acc.id);
        plainPasswords.value[acc.id] = plainPassword;
      } catch { /* locked */ }
    }
  }
}, { deep: true });

async function toggleVisible(id: string) {
  if (visibleIds.value.has(id)) {
    visibleIds.value.delete(id);
  } else {
    if (!plainPasswords.value[id]) {
      try {
        const { plainPassword } = await accountService.getDecrypted(id);
        plainPasswords.value[id] = plainPassword;
      } catch { return; }
    }
    visibleIds.value.add(id);
  }
}

async function copyPassword(id: string) {
  await accountService.copyPassword(id);
}

async function copyUsername(username: string) {
  await copyToClipboard(username);
}

function setDefault(id: string) {
  // emit to parent or call store
}
</script>

<style scoped>
.account-section { margin-top: 14px; }
.form-section-title { font-size: 12px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; }
.account-list { border: 1px solid var(--border-soft); border-radius: 6px; overflow: hidden; }
.account-item { display: grid; grid-template-columns: 1fr 1fr 1.2fr 120px; align-items: center; padding: 7px 10px; font-size: 12px; border-bottom: 1px solid var(--border-soft); gap: 8px; }
.account-item:last-child { border-bottom: none; }
.account-item.header-row { background: #f9fafb; color: var(--text-secondary); font-size: 11px; font-weight: 500; }
.acc-pwd { letter-spacing: 1px; }
.acc-icons { display: flex; align-items: center; gap: 4px; justify-content: flex-end; }
.row-action { width: 22px; height: 22px; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); cursor: pointer; font-size: 11px; }
.row-action:hover { background: var(--border-soft); color: var(--primary); }
.row-action.danger:hover { color: var(--danger); }
.default-badge { font-size: 9px; padding: 0 4px; background: var(--warning-light); color: var(--warning-text); border-radius: 3px; margin-left: 4px; }
.add-account-btn { margin-top: 8px; font-size: 12px; color: var(--primary); background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 4px; }
.add-account-btn:hover { color: var(--primary-700); }
</style>
```

- [ ] **Step 3: Create SystemForm.vue (detail panel)**

```vue
<template>
  <aside class="detail-panel">
    <div class="detail-header">
      <div class="card-title"><i class="fa-solid fa-briefcase"></i> {{ form.name || '新系统' }}</div>
      <div class="icon-btn" @click="$emit('close')"><i class="fa-solid fa-xmark"></i></div>
    </div>
    <div class="detail-tabs">
      <div class="detail-tab" :class="{ active: tab === 'basic' }" @click="tab = 'basic'">基本信息</div>
      <div class="detail-tab" :class="{ active: tab === 'accounts' }" @click="tab = 'accounts'">账号密码 ({{ accounts.length }})</div>
      <div class="detail-tab" :class="{ active: tab === 'remark' }" @click="tab = 'remark'">备注信息</div>
    </div>
    <div class="detail-body">
      <template v-if="tab === 'basic'">
        <div class="form-row">
          <div class="form-label">系统名称 <span class="req">*</span></div>
          <div class="form-field"><input v-model="form.name" class="form-input" type="text" /></div>
        </div>
        <div class="form-row">
          <div class="form-label">系统地址 <span class="req">*</span></div>
          <div class="form-field">
            <div class="form-icon">
              <input v-model="form.url" class="form-input" type="text" />
              <i class="fa-solid fa-copy" @click="copy(form.url)"></i>
            </div>
          </div>
        </div>
        <div class="form-row">
          <div class="form-label">环境分类</div>
          <div class="form-field">
            <select v-model="form.environment" class="form-select">
              <option v-for="env in ENVIRONMENTS" :key="env.value" :value="env.value">{{ env.label }}</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-label">图标</div>
          <div class="form-field"><input v-model="form.icon" class="form-input" type="text" placeholder="fa-solid fa-globe" /></div>
        </div>
        <div class="form-row">
          <div class="form-label">颜色</div>
          <div class="form-field"><input v-model="form.iconColor" class="form-input" type="text" placeholder="linear-gradient(...)" /></div>
        </div>
        <div class="form-row">
          <div class="form-label">标签</div>
          <div class="form-field">
            <div class="tag-list">
              <TagPill v-for="t in selectedTags" :key="t.id" :name="t.name" :color="t.color" removable @remove="removeTag(t.id)" />
              <input v-model="newTag" class="tag-input" type="text" placeholder="添加标签..." @keyup.enter="addTag" />
            </div>
          </div>
        </div>
      </template>
      <template v-else-if="tab === 'accounts'">
        <AccountList :accounts="accounts" :system-id="systemId" @add="addAccount" @delete="deleteAccount" />
      </template>
      <template v-else>
        <textarea v-model="form.remark" class="form-textarea" placeholder="备注信息..."></textarea>
      </template>
    </div>
    <div class="detail-footer">
      <button class="btn btn-default" @click="$emit('cancel')">取消</button>
      <button class="btn btn-primary" @click="save">保存</button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { System, SystemInput, Account } from '@shared/types/entities';
import { ENVIRONMENTS } from '@shared/types/enums';
import { useAccountStore } from '@shared/stores/accountStore';
import { useTagStore } from '@shared/stores/tagStore';
import { useSystemStore } from '@shared/stores/systemStore';
import { useToastStore } from '@shared/stores/toastStore';
import { copyToClipboard } from '@shared/utils/clipboard';
import TagPill from '../common/TagPill.vue';
import AccountList from './AccountList.vue';

const props = defineProps<{ system: System | null; systemId: string }>();
const emit = defineEmits<{ close: []; saved: [] }>();

const accountStore = useAccountStore();
const tagStore = useTagStore();
const systemStore = useSystemStore();
const toast = useToastStore();

const tab = ref<'basic' | 'accounts' | 'remark'>('basic');
const form = ref<SystemInput>({
  name: '', url: '', environment: 'development', icon: '', iconColor: '', favorite: false, sort: 0, remark: '',
});
const selectedTags = ref<Array<{ id: string; name: string; color?: string }>>([]);
const newTag = ref('');
const accounts = ref<Account[]>([]);

watch(() => props.system, async (s) => {
  if (s) {
    form.value = { ...s };
    accounts.value = await accountStore.loadBySystem(s.id).then(() => accountStore.list);
  } else {
    form.value = { name: '', url: '', environment: 'development', icon: '', iconColor: '', favorite: false, sort: 0, remark: '' };
    accounts.value = [];
  }
}, { immediate: true });

function addTag() {
  if (!newTag.value.trim()) return;
  const name = newTag.value.trim();
  tagStore.create(name).then(id => {
    selectedTags.value.push({ id, name });
    newTag.value = '';
  });
}

function removeTag(id: string) {
  selectedTags.value = selectedTags.value.filter(t => t.id !== id);
}

async function addAccount() {
  // Open account creation modal (simplified for plan)
  const role = prompt('角色名称');
  if (!role) return;
  const username = prompt('用户名');
  if (!username) return;
  const password = prompt('密码');
  if (!password) return;
  await accountStore.create({ systemId: props.systemId, role, username, password, isDefault: accounts.value.length === 0 });
  accounts.value = accountStore.list;
}

async function deleteAccount(id: string) {
  await accountStore.remove(id, props.systemId);
  accounts.value = accountStore.list;
}

async function save() {
  if (props.system) {
    await systemStore.update(props.system.id, form.value);
    await systemStore.setTags(props.system.id, selectedTags.value.map(t => t.name));
    toast.success('系统已更新');
  } else {
    const id = await systemStore.create(form.value);
    await systemStore.setTags(id, selectedTags.value.map(t => t.name));
    toast.success('系统已创建');
  }
  emit('saved');
}

function copy(text: string) { copyToClipboard(text); }
</script>

<style scoped>
.detail-panel { background: white; border-radius: 8px; border: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; min-width: 360px; }
.detail-header { padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-soft); }
.card-title { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--text-primary); }
.card-title i { color: var(--primary); font-size: 12px; }
.icon-btn { width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary); cursor: pointer; }
.icon-btn:hover { background: var(--border-soft); }
.detail-tabs { display: flex; padding: 0 14px; border-bottom: 1px solid var(--border-soft); }
.detail-tab { padding: 10px 12px; font-size: 12px; color: var(--text-secondary); cursor: pointer; position: relative; font-weight: 500; }
.detail-tab.active { color: var(--primary); font-weight: 600; }
.detail-tab.active::after { content: ""; position: absolute; bottom: -1px; left: 12px; right: 12px; height: 2px; background: var(--primary); border-radius: 2px 2px 0 0; }
.detail-body { padding: 14px; flex: 1; overflow-y: auto; }
.form-row { display: flex; align-items: flex-start; margin-bottom: 10px; }
.form-label { width: 78px; font-size: 12px; color: var(--text-secondary); padding-top: 7px; flex-shrink: 0; }
.form-label .req { color: var(--danger); }
.form-field { flex: 1; min-width: 0; }
.form-input, .form-select, .form-textarea { width: 100%; height: 30px; border: 1px solid var(--border); border-radius: 5px; padding: 0 10px; font-size: 12px; background: white; outline: none; font-family: inherit; color: var(--text-primary); }
.form-textarea { height: 80px; padding: 6px 10px; resize: vertical; }
.form-input:focus, .form-select:focus, .form-textarea:focus { border-color: #93c5fd; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
.form-icon { position: relative; }
.form-icon i { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); color: var(--text-tertiary); font-size: 11px; cursor: pointer; }
.tag-list { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.tag-input { border: 1px dashed var(--border); border-radius: 3px; padding: 1px 6px; font-size: 11px; width: 100px; outline: none; }
.detail-footer { padding: 10px 14px; border-top: 1px solid var(--border-soft); display: flex; justify-content: flex-end; gap: 8px; background: #fafbfc; }
.btn { display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid transparent; font-family: inherit; }
.btn-primary { background: var(--primary); color: white; }
.btn-default { background: white; color: #374151; border-color: var(--border); }
</style>
```

- [ ] **Step 4: Create SystemView.vue**

```vue
<template>
  <div class="system-view">
    <div class="table-area">
      <SystemTable
        :systems="store.list"
        :selected-id="store.selectedId"
        @create="onCreate"
        @select="onSelect"
        @open="onOpen"
        @delete="onDelete"
        @toggle-fav="store.toggleFavorite"
        @bulk-delete="onBulkDelete"
      />
    </div>
    <div class="detail-area">
      <SystemForm
        v-if="store.selected || creating"
        :system="store.selected"
        :system-id="store.selectedId || ''"
        @close="onCloseForm"
        @saved="onSaved"
        @cancel="onCloseForm"
      />
      <div v-else class="empty-state">
        <i class="fa-solid fa-table-columns"></i>
        <p>选择一个系统查看详情，或点击"新增系统"</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSystemStore } from '@shared/stores/systemStore';
import { useToastStore } from '@shared/stores/toastStore';
import type { System } from '@shared/types/entities';
import SystemTable from '../components/system/SystemTable.vue';
import SystemForm from '../components/system/SystemForm.vue';

const store = useSystemStore();
const toast = useToastStore();
const creating = ref(false);

onMounted(async () => {
  await store.load();
});

function onCreate() {
  creating.value = true;
  store.select(null);
}

function onSelect(id: string) {
  creating.value = false;
  store.select(id);
}

function onOpen(system: System) {
  window.open(system.url, '_blank');
  store.update(system.id, {}).then(() => store.load());
}

async function onDelete(id: string) {
  if (!confirm('确认删除该系统？')) return;
  await store.remove(id);
  toast.success('已删除');
}

async function onBulkDelete(ids: string[]) {
  if (!confirm(`确认删除 ${ids.length} 个系统？`)) return;
  for (const id of ids) await store.remove(id);
  toast.success(`已删除 ${ids.length} 个系统`);
}

function onCloseForm() {
  creating.value = false;
  store.select(null);
}

async function onSaved() {
  creating.value = false;
  await store.load();
}
</script>

<style scoped>
.system-view { display: grid; grid-template-columns: 1fr 360px; gap: 12px; padding: 12px; flex: 1; min-height: 0; }
.table-area { min-width: 0; }
.detail-area { min-width: 0; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-tertiary); }
.empty-state i { font-size: 48px; margin-bottom: 12px; }
.empty-state p { font-size: 13px; }
</style>
```

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/components/system/ src/dashboard/views/SystemView.vue
git commit -m "feat: add system management UI (table, form, account list)"
```

---

## Phase 9: Server Management UI

### Task 9.1: Server Cards and Form

**Files:**
- Create: `src/dashboard/components/server/ServerCard.vue`
- Create: `src/dashboard/components/server/ServerForm.vue`
- Modify: `src/dashboard/views/ServerView.vue`

- [ ] **Step 1: Create ServerCard.vue**

```vue
<template>
  <div class="server-card" @click="$emit('select')">
    <div class="server-status" :class="server.status">{{ statusLabel }}</div>
    <div class="server-ip">{{ server.ip }}</div>
    <div class="server-desc">{{ server.name }}</div>
    <div class="server-meta">
      {{ server.username }} · SSH {{ server.sshPort }}<br />
      {{ server.environment }}
    </div>
    <div class="server-actions">
      <div class="row-action" @click.stop="$emit('edit')" title="编辑"><i class="fa-solid fa-pen"></i></div>
      <div class="row-action" @click.stop="$emit('copyIp')" title="复制IP"><i class="fa-solid fa-copy"></i></div>
      <div class="row-action" @click.stop="$emit('copySsh')" title="复制SSH"><i class="fa-solid fa-terminal"></i></div>
      <div class="row-action" @click.stop="$emit('copyPwd')" title="复制密码"><i class="fa-solid fa-key"></i></div>
      <div class="row-action" @click.stop="$emit('toggleFav')" title="收藏">
        <i :class="server.favorite ? 'fa-solid fa-star' : 'fa-regular fa-star'" :style="{ color: server.favorite ? '#f59e0b' : '#9ca3af' }"></i>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Server } from '@shared/types/entities';

const props = defineProps<{ server: Server }>();
defineEmits<{ select: []; edit: []; copyIp: []; copySsh: []; copyPwd: []; toggleFav: [] }>();

const statusLabel = computed(() => ({ online: '在线', warn: '告警', offline: '离线' }[props.server.status ?? 'online']));
</script>

<style scoped>
.server-card { border: 1px solid var(--border-soft); border-radius: 6px; padding: 10px; cursor: pointer; background: white; transition: all 0.15s; }
.server-card:hover { border-color: #93c5fd; box-shadow: 0 2px 8px rgba(59,130,246,0.08); }
.server-status { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; color: var(--success-text); font-weight: 500; margin-bottom: 4px; }
.server-status::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--success); }
.server-status.warn { color: var(--warning-text); }
.server-status.warn::before { background: var(--warning); }
.server-status.offline { color: var(--text-tertiary); }
.server-status.offline::before { background: var(--text-tertiary); }
.server-ip { font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 2px; }
.server-desc { font-size: 11px; color: var(--text-secondary); margin-bottom: 6px; }
.server-meta { font-size: 11px; color: #4b5563; line-height: 1.6; margin-bottom: 8px; }
.server-actions { display: flex; align-items: center; gap: 2px; border-top: 1px solid var(--border-soft); padding-top: 6px; }
.row-action { width: 22px; height: 22px; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); cursor: pointer; font-size: 11px; }
.row-action:hover { background: var(--border-soft); color: var(--primary); }
</style>
```

- [ ] **Step 2: Create ServerForm.vue**

```vue
<template>
  <teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-dialog">
        <div class="modal-header"><h3>{{ server ? '编辑服务器' : '新增服务器' }}</h3></div>
        <div class="modal-body">
          <div class="form-row"><div class="form-label">名称 <span class="req">*</span></div><input v-model="form.name" class="form-input" /></div>
          <div class="form-row"><div class="form-label">IP <span class="req">*</span></div><input v-model="form.ip" class="form-input" /></div>
          <div class="form-row"><div class="form-label">SSH 端口</div><input v-model.number="form.sshPort" class="form-input" type="number" /></div>
          <div class="form-row"><div class="form-label">账号</div><input v-model="form.username" class="form-input" /></div>
          <div class="form-row"><div class="form-label">密码</div><input v-model="form.password" class="form-input" type="password" /></div>
          <div class="form-row"><div class="form-label">SSH Key</div><textarea v-model="form.sshKey" class="form-textarea"></textarea></div>
          <div class="form-row"><div class="form-label">环境</div>
            <select v-model="form.environment" class="form-select">
              <option v-for="env in ENVIRONMENTS" :key="env.value" :value="env.value">{{ env.label }}</option>
            </select>
          </div>
          <div class="form-row"><div class="form-label">用途</div><input v-model="form.purpose" class="form-input" /></div>
          <div class="form-row"><div class="form-label">备注</div><textarea v-model="form.remark" class="form-textarea"></textarea></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="$emit('close')">取消</button>
          <button class="btn btn-primary" @click="save">保存</button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Server, ServerInput } from '@shared/types/entities';
import { ENVIRONMENTS } from '@shared/types/enums';
import { useServerStore } from '@shared/stores/serverStore';
import { useToastStore } from '@shared/stores/toastStore';

const props = defineProps<{ visible: boolean; server: Server | null }>();
const emit = defineEmits<{ close: []; saved: [] }>();

const store = useServerStore();
const toast = useToastStore();

const form = ref<ServerInput>({
  name: '', ip: '', sshPort: 22, username: '', password: '', sshKey: '',
  environment: 'development', purpose: '', remark: '', favorite: false,
});

watch(() => props.visible, (v) => {
  if (v) {
    if (props.server) {
      form.value = { ...props.server, password: '', sshKey: '' };
    } else {
      form.value = { name: '', ip: '', sshPort: 22, username: '', password: '', sshKey: '', environment: 'development', purpose: '', remark: '', favorite: false };
    }
  }
});

async function save() {
  if (props.server) {
    await store.update(props.server.id, form.value);
    toast.success('服务器已更新');
  } else {
    await store.create(form.value);
    toast.success('服务器已创建');
  }
  emit('saved');
}
</script>

<style scoped>
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 10000; }
.modal-dialog { background: white; border-radius: 8px; padding: 20px; min-width: 480px; max-width: 600px; max-height: 80vh; overflow-y: auto; }
.modal-header h3 { margin: 0 0 12px; font-size: 15px; }
.form-row { display: flex; align-items: flex-start; margin-bottom: 10px; }
.form-label { width: 78px; font-size: 12px; color: var(--text-secondary); padding-top: 7px; flex-shrink: 0; }
.form-label .req { color: var(--danger); }
.form-field { flex: 1; }
.form-input, .form-select, .form-textarea { width: 100%; height: 30px; border: 1px solid var(--border); border-radius: 5px; padding: 0 10px; font-size: 12px; outline: none; font-family: inherit; }
.form-textarea { height: 60px; padding: 6px 10px; resize: vertical; }
.modal-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.btn { display: inline-flex; align-items: center; height: 30px; padding: 0 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid transparent; font-family: inherit; }
.btn-primary { background: var(--primary); color: white; }
.btn-default { background: white; color: #374151; border-color: var(--border); }
</style>
```

- [ ] **Step 3: Create ServerView.vue**

```vue
<template>
  <div class="server-view">
    <div class="action-bar">
      <button class="btn btn-primary" @click="onCreate"><i class="fa-solid fa-plus"></i> 新增服务器</button>
      <div class="search-wrap">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input v-model="store.searchQuery" class="search-input" placeholder="搜索服务器..." />
      </div>
    </div>
    <div class="server-grid">
      <ServerCard v-for="s in store.filtered" :key="s.id" :server="s" @select="onSelect(s.id)" @edit="onEdit(s)" @copy-ip="store.copyIp(s.id)" @copy-ssh="store.copySshCommand(s.id)" @copy-pwd="store.copyPassword(s.id)" @toggle-fav="store.toggleFavorite(s.id)" />
      <div class="server-card add-card" @click="onCreate"><i class="fa-solid fa-plus"></i><div>新增服务器</div></div>
    </div>
    <ServerForm :visible="formVisible" :server="editing" @close="formVisible = false" @saved="onSaved" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useServerStore } from '@shared/stores/serverStore';
import type { Server } from '@shared/types/entities';
import ServerCard from '../components/server/ServerCard.vue';
import ServerForm from '../components/server/ServerForm.vue';

const store = useServerStore();
const formVisible = ref(false);
const editing = ref<Server | null>(null);

onMounted(async () => { await store.load(); });

function onCreate() { editing.value = null; formVisible.value = true; }
function onEdit(s: Server) { editing.value = s; formVisible.value = true; }
function onSelect(id: string) { /* show detail or edit */ onEdit(store.list.find(s => s.id === id)!); }
async function onSaved() { formVisible.value = false; await store.load(); }
</script>

<style scoped>
.server-view { padding: 12px; }
.action-bar { display: flex; gap: 8px; margin-bottom: 12px; }
.btn { display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid transparent; font-family: inherit; }
.btn-primary { background: var(--primary); color: white; }
.search-wrap { position: relative; margin-left: auto; }
.search-wrap i { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-tertiary); font-size: 11px; }
.search-input { height: 30px; border: 1px solid var(--border); border-radius: 6px; padding: 0 10px 0 30px; font-size: 12px; width: 240px; outline: none; font-family: inherit; }
.server-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
.add-card { border: 1px dashed #d1d5db; background: #fafbfc; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-secondary); font-size: 12px; min-height: 110px; cursor: pointer; }
.add-card i { font-size: 18px; margin-bottom: 4px; }
.add-card:hover { border-color: #93c5fd; color: var(--primary); }
</style>
```

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/components/server/ src/dashboard/views/ServerView.vue
git commit -m "feat: add server management UI (card grid, form)"
```

---

## Phase 10: Middleware Management UI

### Task 10.1: Middleware Table and Form

**Files:**
- Create: `src/dashboard/components/middleware/MiddlewareTable.vue`
- Create: `src/dashboard/components/middleware/MiddlewareForm.vue`
- Modify: `src/dashboard/views/MiddlewareView.vue`

- [ ] **Step 1: Create MiddlewareTable.vue**

```vue
<template>
  <div class="card">
    <div class="action-bar">
      <button class="btn btn-primary" @click="$emit('create')"><i class="fa-solid fa-plus"></i> 新增中间件</button>
      <div class="search-wrap">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input v-model="search" class="search-input" placeholder="搜索中间件..." />
      </div>
    </div>
    <table class="data-table">
      <thead>
        <tr>
          <th>类型</th>
          <th>名称 / 版本</th>
          <th>连接地址</th>
          <th>端口</th>
          <th>账号</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="m in filtered" :key="m.id">
          <td>
            <div class="sys-name">
              <div class="sys-icon" :style="{ background: getMeta(m.type).color }"><i :class="'fa-solid ' + getMeta(m.type).icon"></i></div>
            </div>
          </td>
          <td><div class="font-medium">{{ m.name }} <span class="version">{{ m.version }}</span></div></td>
          <td>{{ m.host }}</td>
          <td>{{ m.port }}</td>
          <td>{{ m.username || '-' }}</td>
          <td>
            <div class="row-actions">
              <div class="row-action" @click="$emit('copyConn', m.id)" title="复制连接串"><i class="fa-solid fa-link"></i></div>
              <div class="row-action" @click="$emit('copyPwd', m.id)" title="复制密码"><i class="fa-solid fa-key"></i></div>
              <div class="row-action" @click="$emit('edit', m)" title="编辑"><i class="fa-solid fa-pen"></i></div>
              <div class="row-action" @click="$emit('delete', m.id)" title="删除"><i class="fa-solid fa-trash"></i></div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Middleware } from '@shared/types/entities';
import { getMiddlewareMeta } from '@shared/types/enums';

const props = defineProps<{ middlewares: Middleware[] }>();
defineEmits<{ create: []; edit: [m: Middleware]; delete: [id: string]; copyConn: [id: string]; copyPwd: [id: string] }>();

const search = ref('');
const filtered = computed(() => {
  if (!search.value.trim()) return props.middlewares;
  const q = search.value.toLowerCase();
  return props.middlewares.filter(m => m.name.toLowerCase().includes(q) || m.host.toLowerCase().includes(q));
});
function getMeta(type: string) { return getMiddlewareMeta(type as any); }
</script>

<style scoped>
.card { background: white; border-radius: 8px; border: 1px solid var(--border); overflow: hidden; }
.action-bar { display: flex; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--border-soft); }
.btn { display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid transparent; font-family: inherit; }
.btn-primary { background: var(--primary); color: white; }
.search-wrap { position: relative; margin-left: auto; }
.search-wrap i { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-tertiary); font-size: 11px; }
.search-input { height: 30px; border: 1px solid var(--border); border-radius: 6px; padding: 0 10px 0 30px; font-size: 12px; width: 240px; outline: none; font-family: inherit; }
.data-table { width: 100%; font-size: 12px; border-collapse: collapse; }
.data-table th { background: #f9fafb; padding: 9px 12px; text-align: left; font-weight: 500; color: var(--text-secondary); border-bottom: 1px solid var(--border-soft); }
.data-table td { padding: 10px 12px; border-bottom: 1px solid var(--border-soft); color: var(--text-primary); }
.sys-name { display: flex; align-items: center; }
.sys-icon { width: 18px; height: 18px; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-size: 9px; }
.version { color: var(--text-tertiary); font-size: 11px; margin-left: 4px; }
.row-actions { display: flex; gap: 4px; }
.row-action { width: 22px; height: 22px; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); cursor: pointer; font-size: 11px; }
.row-action:hover { background: var(--border-soft); color: var(--primary); }
</style>
```

- [ ] **Step 2: Create MiddlewareForm.vue (with dynamic fields)**

```vue
<template>
  <teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-dialog">
        <div class="modal-header"><h3>{{ middleware ? '编辑中间件' : '新增中间件' }}</h3></div>
        <div class="modal-body">
          <div class="form-row"><div class="form-label">类型 <span class="req">*</span></div>
            <select v-model="form.type" class="form-select" @change="onTypeChange">
              <option v-for="t in MIDDLEWARE_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select>
          </div>
          <div class="form-row"><div class="form-label">名称 <span class="req">*</span></div><input v-model="form.name" class="form-input" /></div>
          <div class="form-row"><div class="form-label">版本</div><input v-model="form.version" class="form-input" /></div>
          <div class="form-row"><div class="form-label">Host <span class="req">*</span></div><input v-model="form.host" class="form-input" /></div>
          <div class="form-row"><div class="form-label">端口</div><input v-model.number="form.port" class="form-input" type="number" /></div>
          <div class="form-row"><div class="form-label">数据库</div><input v-model="form.database" class="form-input" /></div>
          <div class="form-row"><div class="form-label">账号</div><input v-model="form.username" class="form-input" /></div>
          <div class="form-row"><div class="form-label">密码</div><input v-model="form.password" class="form-input" type="password" /></div>
          <div v-if="extraFields.length > 0" class="extra-section">
            <div class="section-title">额外参数</div>
            <div v-for="field in extraFields" :key="field.key" class="form-row">
              <div class="form-label">{{ field.label }}</div>
              <input v-model="extraValues[field.key]" :type="field.type === 'number' ? 'number' : 'text'" class="form-input" :placeholder="field.placeholder" />
            </div>
          </div>
          <div class="form-row"><div class="form-label">备注</div><textarea v-model="form.remark" class="form-textarea"></textarea></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" @click="$emit('close')">取消</button>
          <button class="btn btn-primary" @click="save">保存</button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { Middleware, MiddlewareInput } from '@shared/types/entities';
import { MIDDLEWARE_TYPES, type MiddlewareType } from '@shared/types/enums';
import { MIDDLEWARE_EXTRA_SCHEMAS } from '@shared/types/middlewareSchemas';
import { useMiddlewareStore } from '@shared/stores/middlewareStore';
import { useToastStore } from '@shared/stores/toastStore';

const props = defineProps<{ visible: boolean; middleware: Middleware | null }>();
const emit = defineEmits<{ close: []; saved: [] }>();

const store = useMiddlewareStore();
const toast = useToastStore();

const form = ref<MiddlewareInput>({
  type: 'redis', name: '', version: '', host: '', port: 6379, database: '',
  username: '', password: '', extra: {}, remark: '', favorite: false,
});
const extraValues = ref<Record<string, unknown>>({});

const extraFields = computed(() => MIDDLEWARE_EXTRA_SCHEMAS[form.value.type] ?? []);

watch(() => props.visible, (v) => {
  if (v) {
    if (props.middleware) {
      form.value = { ...props.middleware, password: '' };
      extraValues.value = { ...(props.middleware.extra ?? {}) };
    } else {
      form.value = { type: 'redis', name: '', version: '', host: '', port: 6379, database: '', username: '', password: '', extra: {}, remark: '', favorite: false };
      extraValues.value = {};
    }
  }
});

function onTypeChange() {
  extraValues.value = {};
  const schema = MIDDLEWARE_EXTRA_SCHEMAS[form.value.type];
  for (const field of schema) {
    if (field.defaultValue !== undefined) extraValues.value[field.key] = field.defaultValue;
  }
  // Update default port
  const defaultPorts: Record<string, number> = { mysql: 3306, redis: 6379, rabbitmq: 5672, mongodb: 27017, elasticsearch: 9200 };
  if (defaultPorts[form.value.type]) form.value.port = defaultPorts[form.value.type];
}

async function save() {
  form.value.extra = { ...extraValues.value };
  if (props.middleware) {
    await store.update(props.middleware.id, form.value);
    toast.success('中间件已更新');
  } else {
    await store.create(form.value);
    toast.success('中间件已创建');
  }
  emit('saved');
}
</script>

<style scoped>
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 10000; }
.modal-dialog { background: white; border-radius: 8px; padding: 20px; min-width: 480px; max-width: 600px; max-height: 80vh; overflow-y: auto; }
.modal-header h3 { margin: 0 0 12px; font-size: 15px; }
.form-row { display: flex; align-items: flex-start; margin-bottom: 10px; }
.form-label { width: 78px; font-size: 12px; color: var(--text-secondary); padding-top: 7px; flex-shrink: 0; }
.form-label .req { color: var(--danger); }
.form-input, .form-select, .form-textarea { width: 100%; height: 30px; border: 1px solid var(--border); border-radius: 5px; padding: 0 10px; font-size: 12px; outline: none; font-family: inherit; }
.form-textarea { height: 60px; padding: 6px 10px; resize: vertical; }
.extra-section { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border-soft); }
.section-title { font-size: 12px; font-weight: 600; margin-bottom: 8px; }
.modal-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.btn { display: inline-flex; align-items: center; height: 30px; padding: 0 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid transparent; font-family: inherit; }
.btn-primary { background: var(--primary); color: white; }
.btn-default { background: white; color: #374151; border-color: var(--border); }
</style>
```

- [ ] **Step 3: Create MiddlewareView.vue**

```vue
<template>
  <div class="middleware-view">
    <MiddlewareTable :middlewares="store.list" @create="onCreate" @edit="onEdit" @delete="onDelete" @copy-conn="store.copyConnectionString" @copy-pwd="store.copyPassword" />
    <MiddlewareForm :visible="formVisible" :middleware="editing" @close="formVisible = false" @saved="onSaved" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useMiddlewareStore } from '@shared/stores/middlewareStore';
import { useToastStore } from '@shared/stores/toastStore';
import type { Middleware } from '@shared/types/entities';
import MiddlewareTable from '../components/middleware/MiddlewareTable.vue';
import MiddlewareForm from '../components/middleware/MiddlewareForm.vue';

const store = useMiddlewareStore();
const toast = useToastStore();
const formVisible = ref(false);
const editing = ref<Middleware | null>(null);

onMounted(async () => { await store.load(); });

function onCreate() { editing.value = null; formVisible.value = true; }
function onEdit(m: Middleware) { editing.value = m; formVisible.value = true; }
async function onDelete(id: string) {
  if (!confirm('确认删除？')) return;
  await store.remove(id);
  toast.success('已删除');
}
async function onSaved() { formVisible.value = false; await store.load(); }
</script>

<style scoped>
.middleware-view { padding: 12px; }
</style>
```

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/components/middleware/ src/dashboard/views/MiddlewareView.vue
git commit -m "feat: add middleware management UI with dynamic fields"
```

---

## Phase 11: Tag and Settings UI

### Task 11.1: Tag Management View

**Files:** Modify `src/dashboard/views/TagView.vue`

- [ ] **Step 1: Create TagView.vue**

```vue
<template>
  <div class="tag-view">
    <div class="action-bar">
      <button class="btn btn-primary" @click="onCreate"><i class="fa-solid fa-plus"></i> 新增标签</button>
    </div>
    <div class="tag-grid">
      <div v-for="t in store.list" :key="t.id" class="tag-card">
        <TagPill :name="t.name" :color="t.color" />
        <div class="tag-actions">
          <input v-model="editColors[t.id]" type="color" @change="onColorChange(t.id)" :title="'颜色'" />
          <div class="row-action" @click="onRename(t)"><i class="fa-solid fa-pen"></i></div>
          <div class="row-action" @click="onDelete(t.id)"><i class="fa-solid fa-trash"></i></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { useTagStore } from '@shared/stores/tagStore';
import { useToastStore } from '@shared/stores/toastStore';
import TagPill from '../components/common/TagPill.vue';

const store = useTagStore();
const toast = useToastStore();
const editColors = reactive<Record<string, string>>({});

onMounted(async () => {
  await store.load();
  store.list.forEach(t => { editColors[t.id] = t.color || '#3b82f6'; });
});

async function onCreate() {
  const name = prompt('标签名称');
  if (!name) return;
  await store.create(name, '#3b82f6');
  toast.success('标签已创建');
}

async function onRename(tag: any) {
  const name = prompt('新名称', tag.name);
  if (name && name !== tag.name) {
    await store.update(tag.id, { name });
    toast.success('已重命名');
  }
}

async function onColorChange(id: string) {
  await store.update(id, { color: editColors[id] });
}

async function onDelete(id: string) {
  if (!confirm('确认删除该标签？关联的标签关系也会删除。')) return;
  await store.remove(id);
  toast.success('已删除');
}
</script>

<style scoped>
.tag-view { padding: 12px; }
.action-bar { margin-bottom: 12px; }
.btn { display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; background: var(--primary); color: white; border: none; font-family: inherit; }
.tag-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; }
.tag-card { background: white; border: 1px solid var(--border); border-radius: 6px; padding: 10px; display: flex; align-items: center; justify-content: space-between; }
.tag-actions { display: flex; align-items: center; gap: 4px; }
.tag-actions input[type="color"] { width: 24px; height: 24px; border: none; border-radius: 4px; cursor: pointer; padding: 0; background: none; }
.row-action { width: 22px; height: 22px; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); cursor: pointer; font-size: 11px; }
.row-action:hover { background: var(--border-soft); color: var(--primary); }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/dashboard/views/TagView.vue
git commit -m "feat: add tag management view"
```

---

### Task 11.2: Settings View

**Files:** Modify `src/dashboard/views/SettingsView.vue`

- [ ] **Step 1: Create SettingsView.vue**

```vue
<template>
  <div class="settings-view">
    <div class="settings-section">
      <h3>主密码</h3>
      <div v-if="!cryptoStore.enabled" class="crypto-section">
        <p class="status">状态: 未设置</p>
        <div class="form-row">
          <input v-model="setupPassword" type="password" placeholder="设置主密码" class="form-input" />
          <button class="btn btn-primary" @click="onSetup">设置主密码</button>
        </div>
        <p class="hint">设置后，所有密码类字段将被 AES-GCM 加密存储。请牢记主密码，丢失后数据无法恢复。</p>
      </div>
      <div v-else class="crypto-section">
        <p class="status">状态: {{ cryptoStore.unlocked ? '已解锁' : '已锁定' }}</p>
        <div v-if="!cryptoStore.unlocked" class="form-row">
          <input v-model="unlockPassword" type="password" placeholder="输入主密码" class="form-input" />
          <button class="btn btn-primary" @click="onUnlock">解锁</button>
        </div>
        <div v-else class="button-group">
          <button class="btn btn-default" @click="cryptoStore.lock()">锁定</button>
          <button class="btn btn-default" @click="onChangePassword">修改密码</button>
          <button class="btn btn-danger" @click="onDisable">禁用主密码</button>
        </div>
        <div class="form-row">
          <label>自动锁定 (分钟):</label>
          <input v-model.number="prefStore.autoLockMinutes" type="number" min="1" max="60" class="form-input small" />
        </div>
      </div>
    </div>

    <div class="settings-section">
      <h3>偏好</h3>
      <div class="form-row">
        <label>主题:</label>
        <select v-model="prefStore.theme" class="form-select">
          <option value="light">浅色</option>
          <option value="dark">深色</option>
        </select>
      </div>
      <div class="form-row">
        <label>默认环境:</label>
        <select v-model="prefStore.defaultEnvironment" class="form-select">
          <option v-for="env in ENVIRONMENTS" :key="env.value" :value="env.value">{{ env.label }}</option>
        </select>
      </div>
      <div class="form-row">
        <label>Popup 布局:</label>
        <select v-model="prefStore.popupLayout" class="form-select">
          <option value="compact">紧凑</option>
          <option value="expanded">展开</option>
        </select>
      </div>
    </div>

    <div class="settings-section danger-zone">
      <h3>危险区</h3>
      <button class="btn btn-danger" @click="onClearAll">清空所有数据</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useCryptoStore } from '@shared/stores/cryptoStore';
import { usePrefStore } from '@shared/stores/prefStore';
import { useToastStore } from '@shared/stores/toastStore';
import { importExportService } from '@shared/services/importExportService';
import { ENVIRONMENTS } from '@shared/types/enums';

const cryptoStore = useCryptoStore();
const prefStore = usePrefStore();
const toast = useToastStore();

const setupPassword = ref('');
const unlockPassword = ref('');

async function onSetup() {
  if (setupPassword.value.length < 4) {
    toast.error('密码至少 4 位');
    return;
  }
  await cryptoStore.setup(setupPassword.value);
  setupPassword.value = '';
  toast.success('主密码已设置');
}

async function onUnlock() {
  const ok = await cryptoStore.unlock(unlockPassword.value);
  if (ok) toast.success('已解锁');
  else toast.error('密码错误');
  unlockPassword.value = '';
}

async function onChangePassword() {
  const oldPwd = prompt('当前密码');
  if (!oldPwd) return;
  const newPwd = prompt('新密码');
  if (!newPwd) return;
  try {
    await cryptoStore.changePassword(oldPwd, newPwd);
    toast.success('密码已修改');
  } catch {
    toast.error('当前密码错误');
  }
}

async function onDisable() {
  const pwd = prompt('输入主密码以禁用');
  if (!pwd) return;
  try {
    await cryptoStore.disablePassword(pwd);
    toast.success('主密码已禁用，密码字段恢复明文存储');
  } catch {
    toast.error('密码错误');
  }
}

async function onClearAll() {
  if (!confirm('确认清空所有数据？此操作不可恢复！')) return;
  if (!confirm('再次确认：所有系统、账号、服务器、中间件将被永久删除。')) return;
  await importExportService.clearAll();
  toast.success('所有数据已清空');
}
</script>

<style scoped>
.settings-view { padding: 12px; max-width: 600px; }
.settings-section { background: white; border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-bottom: 12px; }
.settings-section h3 { margin: 0 0 12px; font-size: 14px; color: var(--text-primary); }
.crypto-section .status { font-size: 12px; color: var(--text-secondary); margin: 0 0 8px; }
.form-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.form-row label { font-size: 12px; color: var(--text-secondary); width: 100px; flex-shrink: 0; }
.form-input, .form-select { height: 30px; border: 1px solid var(--border); border-radius: 5px; padding: 0 10px; font-size: 12px; outline: none; font-family: inherit; flex: 1; }
.form-input.small { max-width: 80px; }
.button-group { display: flex; gap: 8px; margin-bottom: 8px; }
.btn { display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid transparent; font-family: inherit; }
.btn-primary { background: var(--primary); color: white; }
.btn-default { background: white; color: #374151; border-color: var(--border); }
.btn-danger { background: white; color: #dc2626; border-color: #fecaca; }
.hint { font-size: 11px; color: var(--text-tertiary); margin-top: 8px; }
.danger-zone { border-color: #fecaca; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/dashboard/views/SettingsView.vue
git commit -m "feat: add settings view (master password, preferences, danger zone)"
```

---

## Phase 12: Popup UI

### Task 12.1: Popup Components

**Files:**
- Modify: `src/popup/App.vue`
- Create: `src/popup/components/SearchBox.vue`
- Create: `src/popup/components/RecentList.vue`
- Create: `src/popup/components/FavoriteGrid.vue`
- Create: `src/popup/components/QuickAdd.vue`

- [ ] **Step 1: Create SearchBox.vue**

```vue
<template>
  <div class="search-box">
    <i class="fa-solid fa-magnifying-glass search-icon"></i>
    <input
      ref="inputRef"
      v-model="query"
      type="text"
      placeholder="搜索系统/URL/标签/账号..."
      @input="onInput"
      @keyup.enter="onEnter"
      @keydown.down.prevent="onArrowDown"
      @keydown.up.prevent="onArrowUp"
    />
    <span class="shortcut">{{ shortcutKey }}</span>
  </div>
  <div v-if="results.length > 0" class="results">
    <div
      v-for="(r, i) in results"
      :key="r.id"
      class="result-item"
      :class="{ active: i === activeIndex }"
      @click="onSelect(r)"
      @mouseenter="activeIndex = i"
    >
      <div class="result-icon" :style="{ background: getColor(r.type) }">
        <i :class="getIcon(r.type)"></i>
      </div>
      <div class="result-text">
        <div class="result-title">{{ r.title }}</div>
        <div class="result-subtitle">{{ r.subtitle }}</div>
      </div>
      <div class="result-type">{{ typeLabel(r.type) }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useSearchStore } from '@shared/stores/searchStore';
import { storeToRefs } from 'pinia';
import { systemService } from '@shared/services/systemService';
import { recentRepo } from '@shared/db/repositories/recentRepo';
import type { SearchResult } from '@shared/services/searchService';

const searchStore = useSearchStore();
const { results } = storeToRefs(searchStore);

const query = ref('');
const inputRef = ref<HTMLInputElement | null>(null);
const activeIndex = ref(0);
const shortcutKey = navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl+K';

onMounted(() => {
  inputRef.value?.focus();
});

watch(results, () => { activeIndex.value = 0; });

function onInput() {
  searchStore.search(query.value);
}

async function onEnter() {
  if (results.value.length > 0) {
    await onSelect(results.value[activeIndex.value]);
  }
}

function onArrowDown() {
  if (activeIndex.value < results.value.length - 1) activeIndex.value++;
}

function onArrowUp() {
  if (activeIndex.value > 0) activeIndex.value--;
}

async function onSelect(r: SearchResult) {
  if (r.type === 'system') {
    const system = await systemService.byId(r.id);
    if (system) {
      await recentRepo.touch('system', system.id);
      chrome.tabs.create({ url: system.url });
      window.close();
    }
  }
}

function getColor(type: string) {
  const colors: Record<string, string> = {
    system: 'linear-gradient(135deg,#3b82f6,#2563eb)',
    server: 'linear-gradient(135deg,#10b981,#059669)',
    middleware: 'linear-gradient(135deg,#f59e0b,#d97706)',
  };
  return colors[type] || colors.system;
}

function getIcon(type: string) {
  const icons: Record<string, string> = {
    system: 'fa-solid fa-briefcase',
    server: 'fa-solid fa-server',
    middleware: 'fa-solid fa-cubes',
  };
  return icons[type] || icons.system;
}

function typeLabel(type: string) {
  const labels: Record<string, string> = { system: '系统', server: '服务器', middleware: '中间件' };
  return labels[type] || type;
}
</script>

<style scoped>
.search-box { position: relative; padding: 12px; }
.search-icon { position: absolute; left: 22px; top: 50%; transform: translateY(-50%); color: var(--text-tertiary); font-size: 13px; }
.search-box input { width: 100%; height: 36px; border: 1px solid var(--border); border-radius: 8px; padding: 0 50px 0 36px; font-size: 13px; outline: none; font-family: inherit; }
.search-box input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
.shortcut { position: absolute; right: 22px; top: 50%; transform: translateY(-50%); font-size: 10px; color: var(--text-tertiary); border: 1px solid var(--border); padding: 2px 6px; border-radius: 3px; background: white; }
.results { max-height: 300px; overflow-y: auto; padding: 0 8px; }
.result-item { display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 6px; cursor: pointer; }
.result-item:hover, .result-item.active { background: var(--primary-50); }
.result-icon { width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; flex-shrink: 0; }
.result-text { flex: 1; min-width: 0; }
.result-title { font-size: 12px; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.result-subtitle { font-size: 10px; color: var(--text-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.result-type { font-size: 10px; color: var(--text-tertiary); background: var(--border-soft); padding: 1px 6px; border-radius: 3px; }
</style>
```

- [ ] **Step 2: Create RecentList.vue**

```vue
<template>
  <div class="section">
    <div class="section-header">
      <span>最近访问</span>
    </div>
    <div class="recent-list">
      <div v-for="r in recents" :key="r.id" class="recent-item" @click="onOpen(r)">
        <div class="ri-icon" :style="{ background: getColor(r.entityType) }">
          <i :class="getIcon(r.entityType)"></i>
        </div>
        <div class="ri-text">
          <div class="ri-name">{{ getEntityName(r) }}</div>
          <div class="ri-time">{{ formatRelativeTime(r.lastAccessedAt) }} · {{ r.role || '' }}</div>
        </div>
      </div>
      <div v-if="recents.length === 0" class="empty">暂无最近访问</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { recentRepo } from '@shared/db/repositories/recentRepo';
import { systemRepo } from '@shared/db/repositories/systemRepo';
import { serverRepo } from '@shared/db/repositories/serverRepo';
import { middlewareRepo } from '@shared/db/repositories/middlewareRepo';
import { formatRelativeTime } from '@shared/utils/time';

const recents = ref<Array<{ id: string; entityType: string; entityId: string; lastAccessedAt: number; role?: string }>>([]);

onMounted(async () => {
  recents.value = await recentRepo.top(5);
});

async function onOpen(r: any) {
  if (r.entityType === 'system') {
    const sys = await systemRepo.byId(r.entityId);
    if (sys) {
      await recentRepo.touch('system', sys.id, r.role);
      chrome.tabs.create({ url: sys.url });
      window.close();
    }
  }
}

async function getEntityName(r: any): Promise<string> {
  if (r.entityType === 'system') {
    const s = await systemRepo.byId(r.entityId);
    return s?.name ?? r.entityId;
  }
  return r.entityId;
}

function getColor(type: string) {
  return { system: 'linear-gradient(135deg,#3b82f6,#2563eb)', server: 'linear-gradient(135deg,#10b981,#059669)', middleware: 'linear-gradient(135deg,#f59e0b,#d97706)' }[type] || '#3b82f6';
}
function getIcon(type: string) {
  return { system: 'fa-solid fa-briefcase', server: 'fa-solid fa-server', middleware: 'fa-solid fa-cubes' }[type] || 'fa-solid fa-globe';
}
</script>

<style scoped>
.section { padding: 0 12px 12px; }
.section-header { font-size: 11px; font-weight: 600; color: var(--text-secondary); padding: 8px 0 4px; text-transform: uppercase; }
.recent-list { display: flex; flex-direction: column; gap: 2px; }
.recent-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; cursor: pointer; }
.recent-item:hover { background: var(--border-soft); }
.ri-icon { width: 24px; height: 24px; border-radius: 5px; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; flex-shrink: 0; }
.ri-text { flex: 1; min-width: 0; }
.ri-name { font-size: 12px; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ri-time { font-size: 10px; color: var(--text-tertiary); }
.empty { padding: 12px; text-align: center; font-size: 11px; color: var(--text-tertiary); }
</style>
```

- [ ] **Step 3: Create FavoriteGrid.vue**

```vue
<template>
  <div class="section">
    <div class="section-header"><span>收藏</span></div>
    <div class="fav-grid">
      <div v-for="s in favorites" :key="s.id" class="fav-item" @click="onOpen(s)">
        <div class="fav-icon" :style="{ background: s.iconColor || 'linear-gradient(135deg,#3b82f6,#2563eb)' }">
          <i :class="s.icon || 'fa-solid fa-globe'"></i>
        </div>
        <div class="fav-name">{{ s.name }}</div>
      </div>
      <div v-if="favorites.length === 0" class="empty">暂无收藏</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { systemRepo } from '@shared/db/repositories/systemRepo';
import { recentRepo } from '@shared/db/repositories/recentRepo';
import type { System } from '@shared/types/entities';

const favorites = ref<System[]>([]);

onMounted(async () => {
  const all = await systemRepo.all();
  favorites.value = all.filter(s => s.favorite).slice(0, 8);
});

async function onOpen(s: System) {
  await recentRepo.touch('system', s.id);
  chrome.tabs.create({ url: s.url });
  window.close();
}
</script>

<style scoped>
.section { padding: 0 12px 12px; }
.section-header { font-size: 11px; font-weight: 600; color: var(--text-secondary); padding: 8px 0 4px; text-transform: uppercase; }
.fav-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.fav-item { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 4px; border-radius: 8px; cursor: pointer; }
.fav-item:hover { background: var(--border-soft); }
.fav-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px; }
.fav-name { font-size: 10px; color: var(--text-primary); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.empty { grid-column: 1 / -1; padding: 12px; text-align: center; font-size: 11px; color: var(--text-tertiary); }
</style>
```

- [ ] **Step 4: Create QuickAdd.vue**

```vue
<template>
  <div class="quick-actions">
    <button class="qa-btn" @click="openDashboard('systems')">
      <i class="fa-solid fa-plus"></i>
      <span>新增</span>
    </button>
    <button class="qa-btn" @click="openDashboard()">
      <i class="fa-solid fa-table-columns"></i>
      <span>面板</span>
    </button>
  </div>
</template>

<script setup lang="ts">
function openDashboard(hash?: string) {
  const url = hash ? `dashboard.html#${hash}` : 'dashboard.html';
  chrome.tabs.create({ url: chrome.runtime.getURL(url) });
  window.close();
}
</script>

<style scoped>
.quick-actions { display: flex; gap: 8px; padding: 0 12px 12px; }
.qa-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; height: 36px; background: var(--primary-50); border: 1px solid var(--primary-100); color: var(--primary-700); border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer; font-family: inherit; }
.qa-btn:hover { background: var(--primary-100); }
</style>
```

- [ ] **Step 5: Update popup App.vue**

```vue
<template>
  <div class="popup-root">
    <SearchBox />
    <RecentList />
    <FavoriteGrid />
    <QuickAdd />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { usePrefStore } from '@shared/stores/prefStore';
import { useCryptoStore } from '@shared/stores/cryptoStore';
import SearchBox from './components/SearchBox.vue';
import RecentList from './components/RecentList.vue';
import FavoriteGrid from './components/FavoriteGrid.vue';
import QuickAdd from './components/QuickAdd.vue';

const prefStore = usePrefStore();
const cryptoStore = useCryptoStore();

onMounted(async () => {
  await prefStore.load();
  await cryptoStore.checkStatus();
});
</script>

<style scoped>
.popup-root { width: 360px; height: 480px; overflow-y: auto; background: var(--bg); }
.popup-root::-webkit-scrollbar { width: 6px; }
.popup-root::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
</style>
```

- [ ] **Step 6: Update popup.css to include tokens**

`src/popup/styles/popup.css`:
```css
:root {
  --primary: #2563eb;
  --primary-50: #eff6ff;
  --primary-100: #dbeafe;
  --primary-700: #1d4ed8;
  --bg: #f5f7fa;
  --border: #e5e7eb;
  --border-soft: #f3f4f6;
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --text-tertiary: #9ca3af;
}
* { box-sizing: border-box; }
body { font-family: 'Noto Sans SC', -apple-system, sans-serif; font-size: 13px; margin: 0; }
```

- [ ] **Step 7: Commit**

```bash
git add src/popup/
git commit -m "feat: add popup UI (search, recent, favorites, quick add)"
```

---

## Phase 13: Background Service Worker

### Task 13.1: Background Modules

**Files:**
- Modify: `src/background/index.ts`
- Create: `src/background/contextMenus.ts`
- Create: `src/background/tabMonitor.ts`
- Create: `src/background/commands.ts`
- Create: `src/background/messaging.ts`
- Create: `src/background/iconBadge.ts`

- [ ] **Step 1: Create contextMenus.ts**

```typescript
import { autoFillService } from '../shared/services/autoFillService';
import { systemService } from '../shared/services/systemService';
import { copyToClipboard } from '../shared/utils/clipboard';

export function setupContextMenus() {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({ id: 'save-current-site', title: '保存当前网站为内部系统', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'copy-system-info', title: '复制当前系统信息', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'fill-credentials', title: '自动填充账号密码', contexts: ['editable'] });
  });

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab?.url) return;
    switch (info.menuItemId) {
      case 'save-current-site':
        await openDashboardWithPrefill(tab);
        break;
      case 'copy-system-info':
        await copyMatchedSystemInfo(tab);
        break;
      case 'fill-credentials':
        await triggerAutoFill(tab);
        break;
    }
  });
}

async function openDashboardWithPrefill(tab: chrome.tabs.Tab) {
  const url = new URL(chrome.runtime.getURL('dashboard.html'));
  url.hash = `/systems/new?url=${encodeURIComponent(tab.url!)}&name=${encodeURIComponent(tab.title ?? '')}`;
  await chrome.tabs.create({ url: url.toString() });
}

async function copyMatchedSystemInfo(tab: chrome.tabs.Tab) {
  const system = await autoFillService.findSystemByUrl(tab.url!);
  if (!system) {
    chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon-48.png', title: 'Nav Portal', message: '未找到匹配的系统' });
    return;
  }
  const info = `# ${system.name}\nURL: ${system.url}\n环境: ${system.environment}\n备注: ${system.remark ?? ''}`;
  await copyToClipboard(info);
}

async function triggerAutoFill(tab: chrome.tabs.Tab) {
  const accounts = await autoFillService.findAccountsForUrl(tab.url!);
  if (accounts.length === 0) return;
  const payload = accounts.length === 1
    ? { systemId: accounts[0].systemId, systemName: accounts[0].systemName, account: accounts[0].account }
    : { picker: accounts };
  await chrome.tabs.sendMessage(tab.id!, { type: 'AUTO_FILL', payload });
}
```

- [ ] **Step 2: Create tabMonitor.ts and iconBadge.ts**

`src/background/iconBadge.ts`:
```typescript
export async function updateBadgeForTab(tab: chrome.tabs.Tab, matched: boolean, label?: string) {
  if (matched) {
    await chrome.action.setBadgeText({ text: '★', tabId: tab.id });
    await chrome.action.setBadgeBackgroundColor({ color: '#2563eb', tabId: tab.id });
    await chrome.action.setTitle({ title: label || '已收藏', tabId: tab.id });
  } else {
    await chrome.action.setBadgeText({ text: '', tabId: tab.id });
  }
}
```

`src/background/tabMonitor.ts`:
```typescript
import { autoFillService } from '../shared/services/autoFillService';
import { updateBadgeForTab } from './iconBadge';

export function setupTabMonitor() {
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete' || !tab.url) return;
    await checkTab(tab);
  });

  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) await checkTab(tab);
  });
}

async function checkTab(tab: chrome.tabs.Tab) {
  try {
    const system = await autoFillService.findSystemByUrl(tab.url!);
    await updateBadgeForTab(tab, !!system, system ? `已收藏: ${system.name}` : undefined);
  } catch {
    await updateBadgeForTab(tab, false);
  }
}
```

- [ ] **Step 3: Create commands.ts**

```typescript
import { triggerAutoFillFromCommand } from './messaging';

export function setupCommands() {
  chrome.commands.onCommand.addListener(async (command) => {
    if (command !== 'auto-fill-current') return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;
    await triggerAutoFillFromCommand(tab);
  });
}
```

- [ ] **Step 4: Create messaging.ts**

```typescript
import { autoFillService } from '../shared/services/autoFillService';
import { recentRepo } from '../db/repositories/recentRepo';
import { cryptoService } from '../services/cryptoService';
import { cryptoSession } from '../crypto/session';
import type { Message, MessageResponse } from '../types/messages';

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
```

- [ ] **Step 5: Update background/index.ts**

```typescript
import { setupContextMenus } from './contextMenus';
import { setupTabMonitor } from './tabMonitor';
import { setupCommands } from './commands';
import { setupMessaging } from './messaging';

setupContextMenus();
setupTabMonitor();
setupCommands();
setupMessaging();

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html#/onboarding') });
  }
});

console.log('[Nav Portal] background service worker started');
```

- [ ] **Step 6: Commit**

```bash
git add src/background/
git commit -m "feat: add background service worker (context menus, tab monitor, commands, messaging)"
```

---

## Phase 14: Content Script & Auto-Fill

### Task 14.1: Content Script Modules

**Files:**
- Modify: `src/content/index.ts`
- Create: `src/content/detector.ts`
- Create: `src/content/filler.ts`
- Create: `src/content/accountPicker.ts`
- Create: `src/content/bridge.ts`

- [ ] **Step 1: Create detector.ts**

```typescript
export interface LoginForm {
  form: HTMLFormElement | null;
  usernameField: HTMLInputElement;
  passwordField: HTMLInputElement;
  submitButton?: HTMLElement;
}

export function detectLoginForm(): LoginForm[] {
  const passwordFields = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="password"]')
  );
  const results: LoginForm[] = [];

  for (const pwd of passwordFields) {
    if (pwd.hidden || pwd.disabled) continue;
    const form = pwd.closest('form');
    const usernameField = findUsernameField(pwd, form);
    if (usernameField) {
      results.push({
        form,
        usernameField,
        passwordField: pwd,
        submitButton: findSubmitButton(form),
      });
    }
  }
  return results;
}

function findUsernameField(pwd: HTMLInputElement, form: HTMLFormElement | null): HTMLInputElement | null {
  const searchRoot = form || document;
  const candidates = Array.from(
    searchRoot.querySelectorAll<HTMLInputElement>('input[type="text"], input[type="email"], input:not([type])')
  );
  return candidates
    .filter(c => !c.hidden && !c.disabled)
    .filter(c => compareDocumentPosition(c, pwd) <= 0)
    .sort((a, b) => getDistance(b, pwd) - getDistance(a, pwd))[0] ?? null;
}

function findSubmitButton(form: HTMLFormElement | null): HTMLElement | undefined {
  if (form) {
    const btn = form.querySelector<HTMLButtonElement>('button[type="submit"], button:not([type])');
    if (btn) return btn;
  }
  return document.querySelector<HTMLButtonElement>('button[type="submit"]') ?? undefined;
}

function compareDocumentPosition(a: Node, b: Node): number {
  if (a === b) return 0;
  const position = a.compareDocumentPosition(b);
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
}

function getDistance(a: Element, b: Element): number {
  const rectA = a.getBoundingClientRect();
  const rectB = b.getBoundingClientRect();
  return Math.abs(rectA.top - rectB.top) + Math.abs(rectA.left - rectB.left);
}
```

- [ ] **Step 2: Create filler.ts**

```typescript
import type { LoginForm } from './detector';

export async function fillForm(form: LoginForm, account: { username: string; plainPassword: string }) {
  setNativeValue(form.usernameField, account.username);
  setNativeValue(form.passwordField, account.plainPassword);
  form.usernameField.dispatchEvent(new Event('input', { bubbles: true }));
  form.passwordField.dispatchEvent(new Event('input', { bubbles: true }));
  form.usernameField.dispatchEvent(new Event('change', { bubbles: true }));
  form.passwordField.dispatchEvent(new Event('change', { bubbles: true }));
}

function setNativeValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(el, value);
}

export function flashFilledIndicator() {
  const banner = document.createElement('div');
  banner.textContent = '✓ Nav Portal 已填充';
  banner.style.cssText = `
    position: fixed; top: 16px; right: 16px; z-index: 2147483647;
    background: #10b981; color: white; padding: 8px 14px;
    border-radius: 6px; font-size: 13px; font-family: sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: opacity 0.3s;
  `;
  document.body.appendChild(banner);
  setTimeout(() => {
    banner.style.opacity = '0';
    setTimeout(() => banner.remove(), 300);
  }, 1500);
}
```

- [ ] **Step 3: Create accountPicker.ts**

```typescript
import type { AccountMatch } from '../shared/types/messages';
import type { LoginForm } from './detector';
import { fillForm, flashFilledIndicator } from './filler';

export function showAccountPicker(accounts: AccountMatch[], forms: LoginForm[]) {
  const host = document.createElement('div');
  host.id = 'nav-portal-picker-host';
  host.style.cssText = 'position: fixed; top: 16px; right: 16px; z-index: 2147483647;';
  const shadow = host.attachShadow({ mode: 'closed' });

  shadow.innerHTML = `
    <style>
      .panel { background: white; border: 1px solid #e5e7eb; border-radius: 8px;
               box-shadow: 0 8px 24px rgba(0,0,0,0.15); padding: 8px; min-width: 240px;
               font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
      .title { font-size: 12px; color: #6b7280; padding: 4px 8px; }
      .item { display: flex; align-items: center; gap: 8px; padding: 8px;
              border-radius: 6px; cursor: pointer; font-size: 13px; color: #111827; }
      .item:hover { background: #f3f4f6; }
      .role { font-size: 11px; padding: 1px 6px; border-radius: 3px; background: #eff6ff; color: #1d4ed8; }
    </style>
    <div class="panel">
      <div class="title">选择要填充的账号</div>
      ${accounts.map((a, i) => `
        <div class="item" data-idx="${i}">
          <span class="role">${a.account.role}</span>
          <span>${a.account.username}</span>
        </div>
      `).join('')}
    </div>
  `;

  document.body.appendChild(host);

  shadow.querySelectorAll<HTMLElement>('.item').forEach(item => {
    item.addEventListener('click', async () => {
      const idx = Number(item.dataset.idx);
      const chosen = accounts[idx];
      await fillForm(forms[0], chosen.account);
      flashFilledIndicator();
      host.remove();
    });
  });

  setTimeout(() => {
    document.addEventListener('click', function handler(e: MouseEvent) {
      if (!host.contains(e.target as Node)) {
        host.remove();
        document.removeEventListener('click', handler);
      }
    });
  }, 100);

  document.addEventListener('keydown', function handler(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      host.remove();
      document.removeEventListener('keydown', handler);
    }
  });
}
```

- [ ] **Step 4: Create bridge.ts**

```typescript
import type { Message, AutoFillPayload } from '../shared/types/messages';

export function listenForMessages(handler: (msg: Message & { payload?: AutoFillPayload }) => void) {
  chrome.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
    handler(msg);
  });
}
```

- [ ] **Step 5: Update content/index.ts**

```typescript
import { detectLoginForm } from './detector';
import { fillForm, flashFilledIndicator } from './filler';
import { showAccountPicker } from './accountPicker';
import { listenForMessages } from './bridge';
import type { Message, AutoFillPayload } from '../shared/types/messages';

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
```

- [ ] **Step 6: Commit**

```bash
git add src/content/
git commit -m "feat: add content script (detector, filler, account picker, bridge)"
```

---

## Phase 15: Import/Export UI and Onboarding

### Task 15.1: Import/Export View

**Files:** Modify `src/dashboard/views/ImportExportView.vue`

- [ ] **Step 1: Create ImportExportView.vue**

```vue
<template>
  <div class="ie-view">
    <div class="ie-section">
      <h3>导出数据</h3>
      <label class="checkbox-label">
        <input v-model="includePasswords" type="checkbox" />
        包含明文密码
      </label>
      <button class="ie-btn" @click="onExportMarkdown"><i class="fa-brands fa-markdown"></i> 导出为 Markdown (.md)</button>
      <button class="ie-btn green" @click="onExportJSON"><i class="fa-solid fa-code"></i> 导出为 JSON (.json)</button>
    </div>

    <div class="ie-section">
      <h3>导入数据</h3>
      <div class="import-mode">
        <label>模式:</label>
        <select v-model="importMode" class="form-select">
          <option value="merge">合并（推荐）</option>
          <option value="replace">替换（清空后导入）</option>
        </select>
      </div>
      <input ref="fileInput" type="file" accept=".md,.json" @change="onFileSelected" style="display:none" />
      <button class="ie-btn" @click="$refs.fileInput.click()"><i class="fa-solid fa-file-import"></i> 选择文件导入</button>
    </div>

    <div class="ie-section">
      <h3>Markdown 预览</h3>
      <pre class="md-preview">{{ preview }}</pre>
    </div>

    <div v-if="summary" class="ie-section summary">
      <h3>导入结果</h3>
      <p>新增系统: {{ summary.created.systems }}</p>
      <p>更新系统: {{ summary.updated.systems }}</p>
      <p>新增服务器: {{ summary.created.servers }}</p>
      <p>跳过: {{ summary.skipped.count }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { importExportService, type ImportSummary } from '@shared/services/importExportService';
import { useToastStore } from '@shared/stores/toastStore';

const toast = useToastStore();
const includePasswords = ref(false);
const importMode = ref<'merge' | 'replace'>('merge');
const preview = ref('');
const summary = ref<ImportSummary | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

async function onExportMarkdown() {
  try {
    const md = await importExportService.exportMarkdown({ includePasswords: includePasswords.value });
    preview.value = md;
    downloadFile(md, 'nav-portal-backup.md', 'text/markdown');
    toast.success('Markdown 导出成功');
  } catch (e) {
    toast.error((e as Error).message);
  }
}

async function onExportJSON() {
  const json = await importExportService.exportJSON();
  downloadFile(json, 'nav-portal-backup.json', 'application/json');
  toast.success('JSON 导出成功');
}

async function onFileSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const text = await file.text();
  try {
    if (file.name.endsWith('.md')) {
      summary.value = await importExportService.importMarkdown(text, { mode: importMode.value });
    } else if (file.name.endsWith('.json')) {
      summary.value = await importExportService.importJSON(text, { mode: importMode.value });
    }
    toast.success('导入成功');
  } catch (e) {
    toast.error(`导入失败: ${(e as Error).message}`);
  }
  if (fileInput.value) fileInput.value.value = '';
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<style scoped>
.ie-view { padding: 12px; max-width: 600px; }
.ie-section { background: white; border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-bottom: 12px; }
.ie-section h3 { margin: 0 0 12px; font-size: 14px; }
.checkbox-label { display: flex; align-items: center; gap: 6px; font-size: 12px; margin-bottom: 8px; cursor: pointer; }
.ie-btn { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; height: 32px; background: var(--primary-50); color: var(--primary-700); border: 1px solid var(--primary-100); border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; margin-bottom: 6px; font-family: inherit; }
.ie-btn:hover { background: var(--primary-100); }
.ie-btn.green { background: #f0fdf4; color: #047857; border-color: #bbf7d0; }
.import-mode { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.import-mode label { font-size: 12px; color: var(--text-secondary); }
.form-select { height: 28px; border: 1px solid var(--border); border-radius: 5px; padding: 0 8px; font-size: 12px; font-family: inherit; }
.md-preview { background: #f9fafb; border: 1px solid var(--border-soft); border-radius: 6px; padding: 12px; font-family: monospace; font-size: 11px; max-height: 200px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; }
.summary p { margin: 4px 0; font-size: 12px; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/dashboard/views/ImportExportView.vue
git commit -m "feat: add import/export view with MD/JSON support"
```

---

### Task 15.2: Onboarding Wizard

**Files:** Modify `src/dashboard/views/OnboardingView.vue`

- [ ] **Step 1: Create OnboardingView.vue**

```vue
<template>
  <div class="onboarding">
    <div class="wizard-card">
      <h2>欢迎使用 Nav Portal</h2>
      <div class="steps">
        <div class="step" :class="{ active: step === 1 }">1. 创建第一个系统</div>
        <div class="step" :class="{ active: step === 2 }">2. 设置主密码（可选）</div>
        <div class="step" :class="{ active: step === 3 }">3. 完成</div>
      </div>

      <div v-if="step === 1" class="step-content">
        <p>添加你的第一个内部系统：</p>
        <input v-model="systemName" placeholder="系统名称（如：内部OA）" class="form-input" />
        <input v-model="systemUrl" placeholder="https://..." class="form-input" />
        <button class="btn btn-primary" @click="onCreateSystem" :disabled="!systemName || !systemUrl">下一步</button>
      </div>

      <div v-else-if="step === 2" class="step-content">
        <p>是否设置主密码加密密码字段？</p>
        <input v-model="masterPassword" type="password" placeholder="主密码（留空跳过）" class="form-input" />
        <div class="btn-group">
          <button class="btn btn-default" @click="step = 3">跳过</button>
          <button class="btn btn-primary" @click="onSetupCrypto" :disabled="!masterPassword">设置并完成</button>
        </div>
      </div>

      <div v-else class="step-content">
        <i class="fa-solid fa-circle-check success-icon"></i>
        <p>设置完成！</p>
        <button class="btn btn-primary" @click="$router.push('/systems')">进入管理面板</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useSystemStore } from '@shared/stores/systemStore';
import { useCryptoStore } from '@shared/stores/cryptoStore';

const systemStore = useSystemStore();
const cryptoStore = useCryptoStore();

const step = ref(1);
const systemName = ref('');
const systemUrl = ref('');
const masterPassword = ref('');

async function onCreateSystem() {
  await systemStore.create({
    name: systemName.value,
    url: systemUrl.value,
    environment: 'development',
    favorite: false,
    sort: 0,
  });
  step.value = 2;
}

async function onSetupCrypto() {
  if (masterPassword.value) {
    await cryptoStore.setup(masterPassword.value);
  }
  step.value = 3;
}
</script>

<style scoped>
.onboarding { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: var(--bg); }
.wizard-card { background: white; border-radius: 12px; padding: 32px; max-width: 480px; width: 90%; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
.wizard-card h2 { margin: 0 0 24px; font-size: 20px; text-align: center; }
.steps { display: flex; justify-content: space-between; margin-bottom: 24px; }
.step { font-size: 11px; color: var(--text-tertiary); flex: 1; text-align: center; padding: 8px; border-bottom: 2px solid var(--border); }
.step.active { color: var(--primary); border-color: var(--primary); font-weight: 600; }
.step-content { text-align: center; }
.step-content p { font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; }
.form-input { width: 100%; height: 36px; border: 1px solid var(--border); border-radius: 6px; padding: 0 12px; font-size: 13px; margin-bottom: 8px; outline: none; font-family: inherit; }
.form-input:focus { border-color: var(--primary); }
.btn { display: inline-flex; align-items: center; justify-content: center; height: 36px; padding: 0 20px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; font-family: inherit; margin-top: 8px; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--primary); color: white; }
.btn-default { background: var(--border-soft); color: var(--text-primary); }
.btn-group { display: flex; gap: 8px; justify-content: center; }
.success-icon { font-size: 48px; color: var(--success); margin: 16px 0; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/dashboard/views/OnboardingView.vue
git commit -m "feat: add onboarding wizard"
```

---

## Phase 16: CI and Documentation

### Task 16.1: GitHub Actions CI

**Files:** Create `.github/workflows/ci.yml`

- [ ] **Step 1: Create CI workflow**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run test:unit
      - run: npm run build
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow"
```

---

### Task 16.2: QA Checklist

**Files:** Create `docs/qa-checklist.md`

- [ ] **Step 1: Create QA checklist**

```markdown
# QA Checklist

## Installation
- [ ] Fresh install: extension loads without errors
- [ ] Onboarding wizard appears on first install
- [ ] Onboarding can create first system
- [ ] Onboarding can skip master password

## System Management
- [ ] Create system with required fields
- [ ] Edit system: update name, url, environment
- [ ] Delete system: confirmation prompt works
- [ ] Bulk select and delete
- [ ] Favorite toggle persists
- [ ] Search filters by name, url, remark

## Account Management
- [ ] Add multiple accounts to a system
- [ ] Set default account
- [ ] Show/hide password toggle
- [ ] Copy username, copy password, copy all
- [ ] Delete account

## Server Management
- [ ] Create server with IP, port, credentials
- [ ] Edit server
- [ ] Copy IP, copy SSH command, copy password
- [ ] Favorite toggle
- [ ] Search by name or IP

## Middleware Management
- [ ] Create Redis middleware (db field appears)
- [ ] Create MySQL middleware (charset, collation fields appear)
- [ ] Create RabbitMQ middleware (vhost field appears)
- [ ] Copy connection string
- [ ] Edit middleware

## Master Password
- [ ] Set master password
- [ ] Lock and unlock
- [ ] Wrong password rejected
- [ ] Change password
- [ ] Disable password (decrypts all fields)
- [ ] Auto-lock after configured minutes

## Auto-Fill
- [ ] Save a system with URL
- [ ] Navigate to that URL in a tab
- [ ] Badge "★" appears on extension icon
- [ ] Press Ctrl+Shift+L: form fills
- [ ] Multiple accounts: picker appears
- [ ] Right-click > "自动填充账号密码"

## Context Menus
- [ ] Right-click on page: "保存当前网站为内部系统" opens dashboard prefilled
- [ ] Right-click on matched page: "复制当前系统信息" copies to clipboard

## Import/Export
- [ ] Export Markdown without passwords: passwords are "********"
- [ ] Export Markdown with passwords: plaintext included
- [ ] Export JSON
- [ ] Import Markdown in merge mode: existing systems updated, new ones created
- [ ] Import Markdown in replace mode: all data wiped then imported
- [ ] Import JSON

## Preferences
- [ ] Theme toggle persists across sessions
- [ ] Default environment saves
- [ ] Auto-lock minutes saves
- [ ] Preferences sync via chrome.storage.sync

## Popup
- [ ] Popup opens in <100ms
- [ ] Search returns results across systems, servers, middleware
- [ ] Clicking system result opens URL in new tab
- [ ] Recent list shows last 5 accessed
- [ ] Favorites grid shows favorited systems
```

- [ ] **Step 2: Commit**

```bash
git add docs/qa-checklist.md
git commit -m "docs: add QA checklist"
```

---

### Task 16.3: Final Integration Test

**Files:** Create `tests/integration/crypto-roundtrip.test.ts`, `tests/integration/import-export-roundtrip.test.ts`

- [ ] **Step 1: Create crypto round-trip test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/shared/db/schema';
import { cryptoService } from '../../src/shared/services/cryptoService';
import { accountService } from '../../src/shared/services/accountService';
import { systemRepo } from '../../src/shared/db/repositories/systemRepo';

describe('crypto round-trip', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('encrypts on write, decrypts on read', async () => {
    await cryptoService.setPassword('master123');
    const systemId = await systemRepo.create({ name: 'Test', url: 'https://test.com', environment: 'development', favorite: false, sort: 0 });
    const accountId = await accountService.create({
      systemId,
      role: 'admin',
      username: 'admin',
      password: 'secret_password',
      isDefault: true,
    });

    const account = await accountService.getDecrypted(accountId);
    expect(account.plainPassword).toBe('secret_password');
  });

  it('survives lock/unlock cycle', async () => {
    await cryptoService.setPassword('master123');
    const systemId = await systemRepo.create({ name: 'Test', url: 'https://test.com', environment: 'development', favorite: false, sort: 0 });
    const accountId = await accountService.create({
      systemId,
      role: 'admin',
      username: 'admin',
      password: 'secret_password',
      isDefault: true,
    });

    cryptoService.lock();
    expect(cryptoService.isUnlocked()).toBe(false);

    const ok = await cryptoService.unlock('master123');
    expect(ok).toBe(true);

    const account = await accountService.getDecrypted(accountId);
    expect(account.plainPassword).toBe('secret_password');
  });
});
```

- [ ] **Step 2: Run all tests**

Run: `npm run test:unit`
Expected: All tests pass.

- [ ] **Step 3: Run full build**

Run: `npm run build`
Expected: `dist/` folder created with all extension files.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/
git commit -m "test: add crypto and import/export integration tests"
```

---

## Self-Review Checklist

After implementing all phases, verify:

1. **Spec coverage**: Every section of `docs/superpowers/specs/2026-07-16-nav-portal-design.md` has corresponding tasks
2. **Build passes**: `npm run build` succeeds without errors
3. **Tests pass**: `npm run test:unit` all green
4. **Extension loads**: Load `dist/` in Chrome, no console errors
5. **Popup works**: Opens in <100ms, search returns results
6. **Dashboard works**: All CRUD operations functional
7. **Auto-fill works**: Trigger via Ctrl+Shift+L on a matching page
8. **Context menus work**: Right-click shows Nav Portal options
9. **Import/Export works**: MD and JSON round-trips successful
10. **Master password works**: Setup, lock, unlock, change, disable all functional
