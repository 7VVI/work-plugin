# Nav Portal Chrome Extension - Design Spec

- **Date**: 2026-07-16
- **Project**: Nav Portal (内部导航)
- **Status**: Approved by user (2026-07-16)

## 1. Overview

### 1.1 Purpose

A Chrome browser extension that helps development teams centrally manage internal systems, accounts/passwords, servers, middleware, and tags. All data is stored locally; the extension provides fast access from the toolbar and a full management dashboard.

### 1.2 Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension platform | Chrome Extension Manifest V3 |
| Frontend framework | Vue 3 + TypeScript + Vite |
| Build tooling | `@crxjs/vite-plugin` (CRXJS) |
| State management | Pinia |
| Local storage | IndexedDB via Dexie |
| Synced preferences | `chrome.storage.sync` |
| Session-scoped secrets | `chrome.storage.session` (for crypto key in background) |
| Markdown parsing | `markdown-it` + `front-matter` |
| Local encryption | Web Crypto API (AES-GCM + PBKDF2) |
| Testing | Vitest + Vue Test Utils + fake-indexeddb |

### 1.3 Key Non-Functional Requirements

- Popup first paint: **<100ms**
- Search response: <50ms for up to 1,000 records
- Dashboard first paint: <500ms acceptable
- All sensitive data stays local unless user explicitly exports

## 2. Architecture

### 2.1 Approach: Layered Multi-Entry

Two independent Vue entries (popup + dashboard) plus a background service worker and content script. All share a common `shared/` layer for types, DB, crypto, services, and stores.

- **Popup**: Minimal Vue app for quick access. No Vue Router, no heavy libs.
- **Dashboard**: Full SPA with Vue Router for tab navigation.
- **Background**: MV3 service worker. No Vue, just TypeScript. Coordinates cross-context operations.
- **Content Script**: Injected into all URLs. Detects login forms and fills credentials.
- **Shared**: Single source of truth for types, db, crypto, services, stores, utils.

### 2.2 Project Structure

```
nav-portal/
├── manifest.config.ts              # CRXJS dynamic manifest
├── vite.config.ts                  # CRXJS + Vue plugin
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── public/
│   ├── icons/                      # 16/32/48/128
│   ├── popup.html
│   └── dashboard.html
├── src/
│   ├── popup/                      # Popup entry (minimal)
│   │   ├── main.ts
│   │   ├── App.vue
│   │   ├── components/
│   │   │   ├── SearchBox.vue
│   │   │   ├── RecentList.vue
│   │   │   ├── FavoriteGrid.vue
│   │   │   └── QuickAdd.vue
│   │   └── styles/
│   │
│   ├── dashboard/                  # Dashboard entry (full SPA)
│   │   ├── main.ts
│   │   ├── App.vue
│   │   ├── router.ts
│   │   ├── views/
│   │   │   ├── SystemView.vue
│   │   │   ├── ServerView.vue
│   │   │   ├── MiddlewareView.vue
│   │   │   ├── TagView.vue
│   │   │   ├── ImportExportView.vue
│   │   │   ├── SettingsView.vue
│   │   │   └── OnboardingView.vue
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   ├── system/
│   │   │   ├── server/
│   │   │   ├── middleware/
│   │   │   └── common/
│   │   └── styles/
│   │
│   ├── background/                 # Service worker
│   │   ├── index.ts
│   │   ├── contextMenus.ts
│   │   ├── tabMonitor.ts
│   │   ├── iconBadge.ts
│   │   ├── commands.ts
│   │   └── messaging.ts
│   │
│   ├── content/                    # Content script (auto-fill)
│   │   ├── index.ts
│   │   ├── detector.ts
│   │   ├── filler.ts
│   │   ├── accountPicker.ts
│   │   └── bridge.ts
│   │
│   └── shared/                     # Common code
│       ├── db/
│       │   ├── schema.ts
│       │   ├── repositories/
│       │   └── migrations.ts
│       ├── crypto/
│       │   ├── masterKey.ts
│       │   ├── cipher.ts
│       │   ├── session.ts
│       │   └── storage.ts
│       ├── stores/
│       ├── services/
│       ├── types/
│       └── utils/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── mocks/
│   │   └── chrome.ts
│   └── e2e/                        # Optional V1
└── docs/
    ├── superpowers/specs/          # This file
    └── qa-checklist.md
```

## 3. Data Model

### 3.1 Entity Types

```typescript
type EncryptedField =
  | { __encrypted: true; iv: string; ciphertext: string }
  | { __encrypted: false; value: string };

type Environment = 'production' | 'development' | 'test' | 'staging';

type MiddlewareType = 'mysql' | 'redis' | 'rabbitmq' | 'kafka' | 'nacos'
  | 'apollo' | 'minio' | 'elasticsearch' | 'clickhouse' | 'mongodb' | 'rocketmq';

interface System {
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

interface Account {
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

interface Server {
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

interface Middleware {
  id: string;
  type: MiddlewareType;
  name: string;
  version?: string;
  host: string;
  port: number;
  database?: string;
  username?: string;
  password?: EncryptedField;
  extra?: Record<string, any>;
  remark?: string;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
}

interface Tag {
  id: string;
  name: string;
  color?: string;
  createdAt: number;
}

interface SystemTag { systemId: string; tagId: string; }
interface ServerTag { serverId: string; tagId: string; }
interface MiddlewareTag { middlewareId: string; tagId: string; }

interface Recent {
  id: string;            // `${entityType}:${entityId}`
  entityType: 'system' | 'server' | 'middleware';
  entityId: string;
  lastAccessedAt: number;
  role?: string;
}
```

### 3.2 Dexie Schema

```typescript
db.version(1).stores({
  systems:        'id, name, url, environment, favorite, sort, createdAt, updatedAt',
  accounts:       'id, systemId, isDefault, createdAt',
  servers:        'id, name, ip, environment, favorite, createdAt',
  middlewares:    'id, type, name, host, favorite, createdAt',
  tags:           'id, name, createdAt',
  systemTags:     '[systemId+tagId], systemId, tagId',
  serverTags:     '[serverId+tagId], serverId, tagId',
  middlewareTags: '[middlewareId+tagId], middlewareId, tagId',
  recents:        'id, entityType, entityId, lastAccessedAt',
  meta:           'key'   // masterPasswordSalt, masterPasswordVerifier, schemaVersion
});
```

### 3.3 Tag Relationships

Tags are many-to-many with **all entity types** (System, Server, Middleware). Each relationship type has its own junction table to keep indexes clean and queries fast.

### 3.4 Middleware Dynamic Fields

Common fields are stored as columns (type, name, version, host, port, database, username, password, remark). Type-specific fields are stored in `extra: Record<string, any>`:

- **Redis**: `{ db: 0 }`
- **MySQL**: `{ charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }`
- **RabbitMQ**: `{ vhost: '/' }`
- **MongoDB**: `{ authSource: 'admin' }`
- **Kafka**: `{ brokerId: 1 }`

The dashboard form dynamically renders fields based on `type` using a schema map (`src/shared/types/middlewareSchemas.ts`).

## 4. Encryption Layer

### 4.1 Scope of Encryption

Only password-class fields are encrypted. Other fields (URL, IP, username, host, etc.) remain plaintext for search and indexing.

Encrypted fields:
- `Account.password`
- `Server.password`
- `Server.sshKey`
- `Middleware.password`

### 4.2 Crypto Strategy

- **Master password NOT set**: `EncryptedField = { __encrypted: false, value: "..." }`. Plaintext, no encryption.
- **Master password SET**: `EncryptedField = { __encrypted: true, iv, ciphertext }`. AES-GCM with key derived from master password via PBKDF2 (600,000 iterations, SHA-256).

### 4.3 Key Management

The derived key lives **only in memory** (`crypto/session.ts`). It is never persisted to disk.

**Verification on unlock**: A known plaintext + its ciphertext (the "verifier") is stored in the `meta` table. On unlock attempt, the entered password is derived into a key; the verifier is decrypted; if it matches the known plaintext, the key is correct and is cached in memory.

**Cross-context sharing (background)**: When master password is enabled and user unlocks in popup/dashboard, the derived key (raw bytes) is sent to background via `chrome.runtime.sendMessage`. Background stores it in `chrome.storage.session` (session-scoped, cleared on browser restart, only accessible to extension context). Background reads from session storage when decrypting for auto-fill.

### 4.4 Auto-Lock

- Default 5-minute idle timer (configurable in Settings).
- `cryptoService` tracks `lastActivityAt` (updated on every encrypt/decrypt call).
- The Vue app context (popup or dashboard, whichever is open and unlocked) runs a `setInterval` check every 30s; if idle > threshold, calls `lock()` and emits `'locked'` event. Vue app contexts have continuous JS execution, so `setInterval` works reliably there.
- On lock, the Vue app sends a `LOCK_CRYPTO` message to the background service worker, which clears its `chrome.storage.session` crypto key entry.
- If no Vue app is open, the in-memory key in popup/dashboard is gone anyway (closed window), and `chrome.storage.session` will be cleared on browser restart. To proactively clear it after the idle threshold even with no popup open, the background registers a one-shot `chrome.alarms.create('crypto-lock', { delayInMinutes: threshold })` on each unlock; the alarm handler clears the session key. Alarm is rescheduled on any subsequent activity (the Vue app sends `CRYPTO_ACTIVITY` messages to background, which reset the alarm).

### 4.5 Password Lifecycle Operations

- **Setup**: User enters password -> derive key -> generate verifier -> persist `{ salt, verifier }` to `meta` table -> re-encrypt all existing plaintext password fields -> cache key in memory.
- **Unlock**: User enters password -> derive key -> check verifier -> cache key in memory.
- **Change password**: Verify old -> derive new key -> re-encrypt all fields -> update verifier.
- **Disable**: Verify password -> decrypt all fields to plaintext -> remove `meta` entries -> clear in-memory key.

## 5. State Management & Service Layer

### 5.1 Layered Architecture

```
Component (Vue)
    ↓
Pinia Store        (UI state, cached lists, async orchestration)
    ↓
Service            (business logic: encryption, validation, search, import/export)
    ↓
Repository         (pure Dexie CRUD)
    ↓
Dexie / IndexedDB
```

### 5.2 Repository Layer

Pure data access. Each repository exposes:

- `all()`, `byId(id)`, `byXxx(value)` (indexed lookups)
- `create(data)`, `update(id, patch)`, `delete(id)`
- `search(query)` (entity-specific fuzzy match on relevant fields)
- Entity-specific helpers (e.g., `systemRepo.favorites()`, `accountRepo.bySystemId(systemId)`)

Tag junction repositories expose: `attach`, `detach`, `tagsFor(entityId)`, `entitiesFor(tagId)`.

### 5.3 Service Layer

#### `cryptoService` (singleton)

```typescript
isEnabled(): Promise<boolean>;
isUnlocked(): boolean;
setPassword(pwd: string): Promise<void>;
unlock(pwd: string): Promise<boolean>;
lock(): void;
encryptField(plain: string): Promise<EncryptedField>;
decryptField(field: EncryptedField): Promise<string>;
changePassword(oldPwd: string, newPwd: string): Promise<void>;
disablePassword(pwd: string): Promise<void>;
on(event: 'locked' | 'unlocked', handler: () => void): () => void;
```

#### Entity services (`accountService`, `serverService`, `middlewareService`, `systemService`)

Each wraps its repository and:
- Encrypts password-class fields on write (if master pwd enabled)
- Decrypts on read for UI display/copy
- Validates input (required fields, URL format, etc.)
- Handles defaults (e.g., `isDefault` flag flips others on create/update)

#### `searchService`

```typescript
interface SearchResult {
  type: 'system' | 'server' | 'middleware' | 'account';
  id: string;
  title: string;
  subtitle: string;
  matchedField: string;
  tags?: string[];
}
search(query: string): Promise<SearchResult[]>;
```

Implementation:
- Calls all repos' `search()` methods in parallel
- Merges and ranks (favorites first, then recents, then alphabetical)
- Returns top 20

Search is prefix + substring, case-insensitive. Uses Dexie's `where().startsWithIgnoreCase()` plus in-memory substring filter on the result set.

#### `importExportService`

```typescript
exportMarkdown(options: { includePasswords: boolean }): Promise<string>;
exportJSON(): Promise<string>;
importMarkdown(content: string, options: { mode: 'merge' | 'replace' }): Promise<ImportSummary>;
importJSON(content: string, options: { mode: 'merge' | 'replace' }): Promise<ImportSummary>;
```

#### `autoFillService` (runs in background context)

```typescript
findSystemByUrl(url: string): Promise<System | undefined>;
findAccountsForUrl(url: string): Promise<Array<{ systemId: string; systemName: string; account: Account & { plainPassword: string } }>>;
```

URL matching: hostname equality OR `target.href.startsWith(saved.url)`.

### 5.4 Pinia Stores

Each store mirrors a service and adds UI state (loading flags, selection, filters, sort). Stores call services and refresh their cached list after mutations.

Key stores:
- `systemStore`, `serverStore`, `middlewareStore`, `tagStore` - entity CRUD + UI state
- `searchStore` - query + results cache
- `cryptoStore` - enabled/unlocked state, lock countdown
- `prefStore` - synced preferences (theme, autoLockMinutes, defaultEnvironment, popupLayout)

`prefStore` writes to `chrome.storage.sync` on every change via `watch()`.

### 5.5 Cross-Context Communication

- **Popup/Dashboard to data**: Direct via Pinia store -> service -> repo -> Dexie (same execution context).
- **Content script to data**: `chrome.runtime.sendMessage` -> background -> `autoFillService` -> responds.
- **Tab URL change**: Background listens to `chrome.tabs.onUpdated` -> updates badge -> notifies open popup if relevant.

## 6. Background Service Worker

### 6.1 Lifecycle

MV3 service workers are ephemeral. All listeners registered **synchronously** at top level. No reliance on in-memory state across events. Each handler re-fetches from Dexie.

### 6.2 Responsibilities

1. **Context menu registration** (`contextMenus.ts`):
   - "保存当前网站为内部系统" (page context)
   - "复制当前系统信息" (page context)
   - "自动填充账号密码" (editable context)

2. **Tab monitoring** (`tabMonitor.ts`):
   - On `chrome.tabs.onUpdated` (status complete) and `chrome.tabs.onActivated`
   - Match URL against saved systems
   - Set badge "★" with blue background if match
   - Set tooltip "已收藏: {systemName}"

3. **Keyboard commands** (`commands.ts`):
   - `Ctrl+Shift+L` (Win) / `Cmd+Shift+L` (Mac): Trigger auto-fill on current tab
   - `Ctrl+Shift+K` / `Cmd+Shift+K`: Open popup (Chrome default behavior)

4. **Message router** (`messaging.ts`):
   - `GET_MATCHING_ACCOUNTS` -> `autoFillService.findAccountsForUrl(url)`
   - `GET_SYSTEM_FOR_URL` -> `autoFillService.findSystemByUrl(url)`
   - `RECORD_ACCESS` -> `recentRepo.touch(entityType, entityId)`
   - `PAGE_HAS_LOGIN_FORM` -> update badge to indicate fillable
   - `CRYPTO_KEY_SYNC` -> cache key in `chrome.storage.session` + schedule `chrome.alarms.create('crypto-lock', { delayInMinutes: threshold })`
   - `CRYPTO_ACTIVITY` -> reschedule the `crypto-lock` alarm (reset idle timer in background)
   - `LOCK_CRYPTO` -> clear `chrome.storage.session` crypto key entry + clear `crypto-lock` alarm

### 6.3 Manifest Commands

```typescript
commands: {
  'auto-fill-current': {
    suggested_key: { default: 'Ctrl+Shift+L', mac: 'Command+Shift+L' },
    description: '在当前页面自动填充账号密码',
  },
  _execute_action: {
    suggested_key: { default: 'Ctrl+Shift+K', mac: 'Command+Shift+K' },
    description: '打开搜索',
  },
}
```

## 7. Content Script & Auto-Fill

### 7.1 Content Script Entry

- Matches: `<all_urls>`
- Run at: `document_idle` (lets SPA frameworks mount before detecting)
- `all_frames: false` (login forms are in top frame)

### 7.2 Form Detection

Heuristic:
1. Find all `<input type="password">` (visible, enabled)
2. For each, find the closest preceding visible text/email input as the username field
3. Find submit button (closest `button[type="submit"]` or `<button>` near the form)
4. Return list of `LoginForm` objects

### 7.3 Form Filling

Uses native input value setter (via `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set`) so React/Vue controlled inputs accept the value. Dispatches `input` and `change` events with `bubbles: true` after setting.

### 7.4 Account Picker

When multiple accounts match a system, content script shows a Shadow-DOM-encapsulated floating panel listing accounts. User clicks one -> fillForm called -> success banner shown. Picker auto-dismisses on outside click or Escape.

### 7.5 Auto-Fill Flow

```
User triggers (Ctrl+Shift+L | icon click | right-click -> 填充)
       ↓
Background receives command
       ↓
autoFillService.findAccountsForUrl(tab.url)
   - Match URL to System
   - Fetch Accounts for System
   - Decrypt passwords (using key from chrome.storage.session)
       ↓
Background sends AUTO_FILL message to content script
   - 1 account: payload is the account
   - N accounts: payload is { picker: accounts }
       ↓
Content script
   - Detect login forms
   - If picker: show shadow-DOM picker
   - Fill form via native setter
   - Show "✓ Nav Portal 已填充" banner for 1.5s
```

## 8. Markdown Import/Export

### 8.1 Format

```markdown
---
navPortalVersion: 1
exportedAt: 2026-07-16T10:30:00.000Z
encrypted: false
passwordsIncluded: true
---

# Nav Portal Backup

## 系统

### 内部OA系统

- **URL**: https://oa.company.com
- **环境**: 生产
- **图标**: fa-briefcase
- **颜色**: #2563eb
- **标签**: 办公, admin
- **备注**: 公司内部办公系统

#### 账号

- **管理员** (默认)
  - 用户名: admin
  - 密码: admin123
- **开发**
  - 用户名: dev_user
  - 密码: dev456

## 服务器

### 生产服务器

- **IP**: 10.0.1.10
- **SSH 端口**: 22
- **账号**: root
- **密码**: ********
- **SSH Key**: (已加密，不导出)
- **环境**: 生产
- **用途**: 核心业务

## 中间件

### MySQL

- **类型**: mysql
- **版本**: 8.0.32
- **Host**: 10.0.1.20
- **端口**: 3306
- **数据库**: schema_name
- **账号**: root
- **密码**: ********
- **额外参数**:
  - charset: utf8mb4

## 标签

- 办公 (#3b82f6)
- 代码 (#f97316)
```

### 8.2 Front-Matter Fields

| Field | Type | Purpose |
|-------|------|---------|
| `navPortalVersion` | number | Schema version for forward-compat migration |
| `exportedAt` | ISO string | When export was created |
| `encrypted` | boolean | Whether source DB had master password enabled |
| `passwordsIncluded` | boolean | If false, all passwords are `********` |

### 8.3 Password Export Policy

- **Master pwd NOT set**: `includePasswords: true` -> plaintext. `false` -> `********`.
- **Master pwd set + unlocked**: `includePasswords: true` -> plaintext (decrypt then export). `false` -> `********`.
- **Master pwd set + locked**: `includePasswords: true` -> **error, refuse** (must unlock first). `false` -> `********`.

Export UI shows checkbox "包含明文密码" with warning. Default unchecked.

### 8.4 Parser

`front-matter` package splits front-matter from body. `markdown-it` tokenizes the body. We walk the token stream directly (NOT the HTML output) to extract structured data. State machine tracks current H2 section / H3 entity / H4 sub-section.

### 8.5 Serializer

Template-string-based, iterating entities and appending lines. Straightforward.

### 8.6 Import Modes

- **Merge (default)**: Match by `name + url` (systems), `name + ip` (servers), `type + name` (middleware). Update if exists, create if not. Tags matched by name.
- **Replace**: Wipe all data first, then import. Confirmation dialog required.

```typescript
interface ImportSummary {
  created: { systems: number; servers: number; middlewares: number; tags: number };
  updated: { systems: number; servers: number; middlewares: number };
  skipped: { count: number; reasons: string[] };
  errors: string[];
}
```

### 8.7 JSON Format

JSON export is lossless (preserves IDs, timestamps, all metadata). Same data shape as `BackupData`. Import validates with `zod` schema before upserting.

## 9. Popup UI

### 9.1 Layout (360×480px)

```
┌─────────────────────────────────────┐
│ 🔍 搜索系统/URL/标签/账号...    ⌘K │
├─────────────────────────────────────┤
│ ⏱ 最近访问                          │
│  [OA系统] admin · 2分钟前            │
│  [GitLab] dev · 15分钟前             │
├─────────────────────────────────────┤
│ ⭐ 收藏                              │
│  [Jenkins] [GitLab] [K8S] [Nacos]   │
├─────────────────────────────────────┤
│ + 新增      🚀 跳转      ⚙ 面板     │
└─────────────────────────────────────┘
```

### 9.2 Performance Optimizations

- No Vue Router (single view)
- Only initialize `systemStore`, `cryptoStore`, `prefStore` (skip server/middleware stores)
- Lazy-load dashboard-only modules (don't import at all)
- Pre-fetch top 10 recents + favorites on `onMounted`
- Inline SVG icons (no Font Awesome CDN dependency)
- No Tailwind (scoped CSS in SFCs)

### 9.3 Search Behavior

- Debounced 150ms
- Calls `searchService.search(query)`
- Results grouped by type with type-icon
- Enter opens first result; arrow keys navigate

### 9.4 Click Behavior

- System entry: `chrome.tabs.create({ url: system.url })` + `recentRepo.touch('system', id)`
- Server/middleware: copy IP/host to clipboard + toast
- "新增": open dashboard with `#/systems/new` (or submenu for server/middleware)

## 10. Dashboard UI

### 10.1 Layout

Follows the prototype HTML (`内部系统助手管理面板.html`). Vue Router for tab navigation:
- `/systems` - System management
- `/servers` - Server management (card grid)
- `/middlewares` - Middleware management (table)
- `/tags` - Tag management
- `/import-export` - Import/export center
- `/settings` - Master password + preferences
- `/onboarding` - First-run wizard

### 10.2 System Detail Panel Tabs

1. **基本信息**: name, url, environment, color, tags, remark
2. **账号密码**: account list with add/edit/delete, default flag, copy buttons
3. **备注信息**: textarea

### 10.3 Settings View

```
┌─────────────────────────────────────────┐
│ 主密码                                   │
│  状态: 未设置 [设置主密码]                │
│  或: 状态: 已锁定 [解锁] [修改] [禁用]    │
│  自动锁定: 5分钟 ▼                       │
├─────────────────────────────────────────┤
│ 偏好                                     │
│  主题: 浅色 / 深色                       │
│  默认环境: 开发 ▼                        │
│  Popup 布局: 紧凑 / 展开                  │
├─────────────────────────────────────────┤
│ 危险区                                   │
│  [清空所有数据] (双确认)                  │
└─────────────────────────────────────────┘
```

### 10.4 Styling

- No Tailwind (keeps popup bundle small)
- Scoped CSS in Vue SFCs
- Design tokens in `src/dashboard/styles/tokens.css` matching prototype CSS variables
- Font Awesome via CDN link in `dashboard.html` (cached after first load)

## 11. Error Handling

### 11.1 Error Types

```typescript
class DomainError extends Error {
  constructor(public code: string, message: string, public details?: any) { super(message); }
}
class ValidationError extends DomainError {}
class NotFoundError extends DomainError {}
class EncryptionError extends DomainError {}
class ImportExportError extends DomainError {}
class CryptoLockedError extends DomainError {}
```

### 11.2 Global Handlers

- `app.config.errorHandler` (Vue): log + toast
- `unhandledrejection` (window): log + toast + `event.preventDefault()`
- `chrome.runtime.onErrorDispatched` (background): log

### 11.3 Error Display

- Form validation: inline messages below fields
- Async failures: toast (bottom-right, auto-dismiss 4s)
- Crypto locked: modal blocking dashboard interaction
- Critical (DB corruption): full-page error with export + reset options

### 11.4 Scenario-Specific Behaviors

| Scenario | Behavior |
|----------|----------|
| Dexie `QuotaExceededError` | Toast: "存储空间不足，请清理或导出后重置" |
| Crypto decrypt fails | Mark field `[解密失败]`; log |
| Invalid YAML front-matter | Return `ImportSummary.errors` with line numbers |
| Unknown background message type | Respond `{ error: "Unknown message" }`; warn |
| Content script can't find form | Silent no-op |

## 12. Testing Strategy

### 12.1 Unit Tests (Vitest)

```
tests/unit/
├── crypto/        # masterKey, cipher, session
├── db/            # repositories with fake-indexeddb
├── services/      # searchService, markdownParser, markdownSerializer, importExportService
└── utils/         # url, validation, time
```

Setup: `fake-indexeddb/auto` globally; `jsdom` environment for Vue component tests.

### 12.2 Component Tests (Vue Test Utils)

```
tests/unit/components/
├── popup/SearchBox.test.ts
├── dashboard/SystemForm.test.ts
└── ...
```

### 12.3 Integration Tests

- Crypto round-trip: set password -> encrypt -> persist -> reload -> unlock -> decrypt -> matches
- Import/export round-trip: export -> import into empty DB -> verify data matches
- Auto-fill flow: simulate background message -> mock content script -> verify fill called

### 12.4 E2E Tests (Optional V1)

Playwright with Chrome extension support. Critical paths:
- First-run onboarding
- End-to-end auto-fill on test page
- Popup search -> open system URL

### 12.5 Manual QA Checklist

Located at `docs/qa-checklist.md`. Covers:
- Fresh install + onboarding
- CRUD for each entity
- Master password setup, lock/unlock, change, disable
- Markdown export with/without passwords
- Import merge vs replace
- Auto-recognition badge
- Auto-fill via shortcut / icon / right-click
- Settings sync across devices (chrome.storage.sync)

### 12.6 CI (GitHub Actions)

```yaml
- pnpm install
- pnpm lint
- pnpm test:unit
- pnpm build
```

### 12.7 Test Mocks

`tests/mocks/chrome.ts` implements `chrome.storage.sync`, `chrome.storage.session`, `chrome.runtime.sendMessage`, `chrome.contextMenus`, `chrome.tabs`, `chrome.commands` against in-memory maps.

## 13. V2 Features Implemented in V1

Per user decision, the following "V2" features are implemented directly in V1:

1. **Auto-fill** (manual trigger): Ctrl+Shift+L, icon click, or right-click menu. Content script detects forms, background supplies decrypted credentials.
2. **Context menu**: Three items (save current site, copy system info, auto-fill).
3. **Auto-recognition**: Background monitors tab URL changes, sets badge on extension icon when current site matches a saved system.

Other V2 features (cloud sync, team sharing, AI assistant, SSH client integration) are **out of scope** for V1.

## 14. Out of Scope (V1)

- Cloud sync (WebDAV, Git, enterprise servers)
- Team sharing / multi-user
- AI assistant / knowledge base
- SSH client integration (Xshell, Tabby, Termius)
- Database client integration (Navicat, DataGrip, DBeaver)
- Server ping/health check (button placeholder only)
- Image attachments in remarks
- Browser history import
- Firefox/Edge port (Chrome only for V1)

## 15. Open Questions Resolved

| Question | Decision |
|----------|---------|
| Master password encryption scope | Only password-class fields (Account.password, Server.password, Server.sshKey, Middleware.password) |
| V2 features in V1 | All three: auto-fill, context menu, auto-recognition |
| Build tooling | CRXJS Vite plugin |
| Tag scope | All entities (System, Server, Middleware) |
| Middleware dynamic fields | Common fields + JSON `extra` |
| Auto-fill trigger | Manual (icon click or Ctrl+Shift+L) |
| Architecture | Layered multi-entry (popup + dashboard + background + content + shared) |

## 16. Implementation Order

1. Project scaffold (CRXJS + Vue + TS + Vite + manifest)
2. Shared types + Dexie schema + repositories
3. Crypto layer (master key, cipher, session)
4. Pinia stores + entity services
5. Dashboard UI (layout + system view + account management)
6. Server + middleware views
7. Tag management
8. Settings view (master password, preferences)
9. Popup UI
10. Background service worker (context menus, tab monitor, messaging)
11. Content script (detector, filler, account picker)
12. Auto-fill end-to-end integration
13. Markdown import/export
14. JSON import/export
15. Onboarding wizard
16. Tests (unit, integration, manual QA)
17. Documentation (README, QA checklist)
