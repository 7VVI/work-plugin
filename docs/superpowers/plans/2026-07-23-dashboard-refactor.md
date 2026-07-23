# 管理面板重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将管理面板的系统、服务器、中间件、配置视图精确重构为 v3 设计，并为所有视图添加拖拽排序功能。

**Architecture:** 分阶段渐进式重构。阶段 1 建立统一设计令牌系统；阶段 2 逐个视图精确匹配 v3 布局；阶段 3 扩展数据库 schema 支持排序；阶段 4 集成 vue-draggable-plus 实现拖拽交互。

**Tech Stack:** Vue 3 + TypeScript + Tailwind CSS + vue-draggable-plus + Drizzle ORM + SQLite

## Global Constraints

- 必须与 v3/dashboard.html 的效果完全一致（像素级精确）
- 拖拽排序状态需持久化到数据库
- 使用 v3 的设计令牌系统（CSS 变量）
- 不修改导入导出和设置界面
- 使用 vue-draggable-plus 实现拖拽
- 平滑过渡动画（200ms）

---

## 文件结构

**新建文件：**
- `src/dashboard/styles/design-tokens.css` — 核心设计令牌
- `src/dashboard/styles/components.css` — 组件基类样式
- `src/dashboard/styles/index.css` — 样式汇总入口
- `src/shared/db/migrations/0006_add_sort_order.ts` — 数据库迁移脚本

**修改文件：**
- `src/dashboard/views/SystemView.vue` — 系统视图重构
- `src/dashboard/views/ServerView.vue` — 服务器视图重构
- `src/dashboard/views/MiddlewareView.vue` — 中间件视图重构
- `src/dashboard/views/ConfigView.vue` — 配置视图重构
- `src/dashboard/components/server/ServerCard.vue` — 服务器卡片重构
- `src/dashboard/components/middleware/MiddlewareCard.vue` — 中间件卡片重构（如有）
- `src/shared/db/schema.ts` — 添加 sortOrder 字段
- `src/shared/db/repositories/systemRepo.ts` — 系统排序方法
- `src/shared/db/repositories/serverRepo.ts` — 服务器排序方法
- `src/shared/db/repositories/middlewareRepo.ts` — 中间件排序方法
- `src/shared/db/repositories/configRepo.ts` — 配置排序方法
- `src/shared/stores/systemStore.ts` — 系统排序状态
- `src/shared/stores/serverStore.ts` — 服务器排序状态
- `src/shared/stores/middlewareStore.ts` — 中间件排序状态
- `src/shared/stores/configStore.ts` — 配置排序状态

---

## 阶段 1：设计系统迁移

### Task 1.1：创建设计令牌文件

**Files:**
- Create: `src/dashboard/styles/design-tokens.css`

- [ ] **Step 1: 提取 v3 颜色系统**

```css
:root {
  /* === 颜色系统 === */
  --bg: #F3F6FB;
  --bg2: #EBF0F8;
  --panel: #FFFFFF;
  --panel2: #F4F7FC;
  --solid: #FFFFFF;
  --solid2: #F6F8FC;
  
  --border: #E1E8F2;
  --border2: #C6D2E4;
  
  --ink: #0F1726;
  --ink2: #4E5D75;
  --ink3: #8593A9;
  
  --accent: #2E6BF0;
  --accent2: #0891B2;
  --glow: rgba(46, 107, 240, .25);
  
  --ok: #059669;
  --warn: #B45309;
  --danger: #DC2626;
  --info: #2563EB;
  
  --grid-line: rgba(46, 107, 240, .055);
}
```

- [ ] **Step 2: 添加间距和圆角系统**

```css
:root {
  /* === 间距系统 === */
  --gap-xs: 4px;
  --gap-sm: 8px;
  --gap-md: 12px;
  --gap-lg: 16px;
  --gap-xl: 24px;
  
  /* === 圆角 === */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 16px;
  
  /* === 阴影 === */
  --shadow-xs: 0 1px 2px rgba(15, 23, 38, .03);
  --shadow-sm: 0 2px 4px rgba(15, 23, 38, .05);
  --shadow-md: 0 4px 12px rgba(15, 23, 38, .1);
}
```

- [ ] **Step 3: 添加暗色主题**

```css
html.dark {
  --bg: #060A11;
  --bg2: #0A0F19;
  --panel: rgba(148, 178, 255, .05);
  --panel2: rgba(148, 178, 255, .09);
  --solid: #0C1322;
  --solid2: #111A2C;
  
  --border: rgba(148, 178, 255, .13);
  --border2: rgba(148, 178, 255, .24);
  
  --ink: #E9EEF8;
  --ink2: #93A1B8;
  --ink3: #56657D;
  
  --accent: #3D7FFF;
  --accent2: #22D3EE;
  --glow: rgba(61, 127, 255, .4);
  
  --ok: #34D399;
  --warn: #FBBF24;
  --danger: #F87171;
  --info: #60A5FA;
  
  --grid-line: rgba(148, 178, 255, .05);
}
```

- [ ] **Step 4: 添加兼容映射**

```css
:root {
  --primary: var(--accent);
  --text-primary: var(--ink);
  --text-secondary: var(--ink2);
  --text-tertiary: var(--ink3);
}
```

- [ ] **Step 5: 提交**

```bash
git add src/dashboard/styles/design-tokens.css
git commit -m "feat(design): add design tokens from v3"
```

---

### Task 1.2：创建组件基类样式

**Files:**
- Create: `src/dashboard/styles/components.css`

- [ ] **Step 1: 提取 v3 面板和按钮样式**

```css
.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(15, 23, 38, .03);
}
html.dark .panel {
  box-shadow: none;
  backdrop-filter: blur(10px);
}

.btn-p {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 8px 15px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: .18s;
  box-shadow: 0 4px 14px -4px var(--glow), inset 0 1px 0 rgba(255, 255, 255, .2);
}
.btn-p:hover {
  filter: brightness(1.07);
  box-shadow: 0 6px 20px -4px var(--glow), inset 0 1px 0 rgba(255, 255, 255, .2);
}
.btn-p:active { transform: scale(.97); }
```

- [ ] **Step 2: 添加次要按钮和危险按钮**

```css
.btn-g {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--panel);
  border: 1px solid var(--border);
  color: var(--ink2);
  border-radius: 10px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: .15s;
}
.btn-g:hover {
  border-color: var(--border2);
  color: var(--ink);
  background: var(--panel2);
}
html.dark .btn-g { background: transparent; }
html.dark .btn-g:hover { background: var(--panel2); }
.btn-g:active { transform: scale(.97); }

.btn-d {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--panel);
  border: 1px solid rgba(220, 38, 38, .3);
  color: var(--danger);
  border-radius: 10px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: .15s;
}
.btn-d:hover { background: rgba(220, 38, 38, .06); }
.btn-d:disabled { opacity: .35; cursor: not-allowed; }
```

- [ ] **Step 3: 添加输入框和标签样式**

```css
.inp {
  width: 100%;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--ink);
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}
html.dark .inp { background: var(--bg2); }
.inp::placeholder { color: var(--ink3); }
.inp:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(46, 107, 240, .16);
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 6px;
  background: var(--panel2);
  border: 1px solid var(--border);
  padding: 2px 7px;
  font-size: 10.5px;
  font-weight: 500;
  color: var(--ink2);
}
```

- [ ] **Step 4: 添加环境徽章样式**

```css
.env {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
  box-shadow: inset 0 0 0 1px;
}
.env::before {
  content: '';
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 6px currentColor;
}
.env-生产 {
  color: var(--ok);
  background: rgba(5, 150, 105, .08);
  box-shadow: inset 0 0 0 1px rgba(5, 150, 105, .22);
}
.env-开发 {
  color: var(--info);
  background: rgba(37, 99, 235, .08);
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, .2);
}
.env-测试 {
  color: var(--warn);
  background: rgba(180, 83, 9, .08);
  box-shadow: inset 0 0 0 1px rgba(180, 83, 9, .22);
}
.env-预发 {
  color: #7C3AED;
  background: rgba(124, 58, 237, .07);
  box-shadow: inset 0 0 0 1px rgba(124, 58, 237, .2);
}
```

- [ ] **Step 5: 添加统计卡片样式**

```css
.stat-card {
  position: relative;
  overflow: hidden;
  transition: .2s;
}
.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--accent), var(--accent2), transparent 80%);
  opacity: 0;
  transition: opacity .25s;
}
.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 28px -12px rgba(15, 23, 38, .14);
}
.stat-card:hover::before { opacity: 1; }
```

- [ ] **Step 6: 提交**

```bash
git add src/dashboard/styles/components.css
git commit -m "feat(design): add component base styles from v3"
```

---

### Task 1.3：创建样式入口文件

**Files:**
- Create: `src/dashboard/styles/index.css`

- [ ] **Step 1: 导入所有样式**

```css
@import './design-tokens.css';
@import './components.css';
```

- [ ] **Step 2: 提交**

```bash
git add src/dashboard/styles/index.css
git commit -m "feat(design): create style index entry point"
```

---

### Task 1.4：集成设计令牌到全局样式

**Files:**
- Modify: `src/dashboard/main.ts` 或 `src/dashboard/App.vue`

- [ ] **Step 1: 导入新样式文件**

```typescript
import './styles/index.css';
```

- [ ] **Step 2: 验证令牌生效**

在浏览器开发者工具中检查：
- `--bg`, `--accent` 等变量是否存在
- 亮色/暗色主题切换是否正常

- [ ] **Step 3: 提交**

```bash
git add src/dashboard/main.ts
git commit -m "feat(design): integrate design tokens into app"
```

---

## 阶段 2：核心视图重构

### Task 2.1：重构系统视图

**Files:**
- Modify: `src/dashboard/views/SystemView.vue`

- [ ] **Step 1: 更新操作栏布局**

将操作栏修改为 v3 的 `mb-4 flex flex-wrap items-center gap-3` 布局：

```vue
<div class="action-bar">
  <button class="btn-p" @click="onCreate">
    <i class="fa-solid fa-plus text-[11px]"></i>新增系统
  </button>
  <button
    v-if="selectedIds.size > 0"
    class="btn-d"
    @click="onBulkDelete"
  >
    <i class="fa-regular fa-trash-can text-[11px]"></i>
    删除选中<span v-if="selectedIds.size > 0">（{{ selectedIds.size }}）</span>
  </button>
  <div class="flex-1"></div>
  <div class="view-toggle">
    <button
      class="view-btn"
      :class="{ active: viewMode === 'table' }"
      @click="viewMode = 'table'"
      title="列表视图"
    >
      <i class="fa-solid fa-list text-xs"></i>
    </button>
    <button
      class="view-btn"
      :class="{ active: viewMode === 'card' }"
      @click="viewMode = 'card'"
      title="网格视图"
    >
      <i class="fa-solid fa-table-cells-large text-xs"></i>
    </button>
  </div>
  <div class="search-wrap">
    <i class="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] t3"></i>
    <input
      v-model="search"
      class="inp w-72 !pl-8"
      placeholder="搜索系统名称、URL、标签…"
    />
  </div>
</div>
```

- [ ] **Step 2: 更新列表视图表头**

```vue
<div v-if="viewMode === 'table'" class="table-wrap panel">
  <table class="w-full">
    <thead style="border-bottom:1px solid var(--border);background:var(--panel2)">
      <tr class="text-left text-[10.5px] font-semibold uppercase tracking-widest t3">
        <th class="w-10 py-2.5 pl-4 pr-2">
          <input type="checkbox" class="h-3.5 w-3.5 cursor-pointer" style="accent-color:var(--accent)" :checked="allChecked" @change="toggleAll" />
        </th>
        <th class="px-4 py-2.5 font-semibold">系统名称</th>
        <th class="px-4 py-2.5 font-semibold">URL</th>
        <th class="w-24 px-4 py-2.5 font-semibold">环境</th>
        <th class="w-24 px-4 py-2.5 font-semibold">账号</th>
        <th class="w-28 px-4 py-2.5 font-semibold">最近更新</th>
        <th class="w-32 px-4 py-2.5 pr-4 text-right font-semibold">操作</th>
      </tr>
    </thead>
    <tbody>
      <!-- 表格行 -->
    </tbody>
  </table>
</div>
```

- [ ] **Step 3: 更新表格行样式**

```vue
<tr v-for="s in filteredSystems" :key="s.id" class="row-h group transition" style="border-bottom:1px solid var(--border)">
  <td class="py-3 pl-4 pr-2">
    <input type="checkbox" class="h-3.5 w-3.5 cursor-pointer" style="accent-color:var(--accent)" :checked="selectedIds.has(s.id)" @change="toggleOne(s.id)" />
  </td>
  <td class="px-4 py-3">
    <div class="flex items-center gap-3">
      <span class="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] text-[13px] text-white" :style="iconStyle(s)">
        <i :class="s.icon || 'fa-solid fa-globe'"></i>
      </span>
      <span class="min-w-0">
        <span class="block truncate text-[13.5px] font-medium t1">{{ s.name }}</span>
        <span v-if="s.tags?.length" class="mt-0.5 flex gap-1">
          <span v-for="tag in s.tags" :key="tag" class="chip">{{ tag }}</span>
        </span>
      </span>
    </div>
  </td>
  <td class="px-4 py-3">
    <span class="flex items-center gap-1.5 mono text-xs t2">
      <i class="fa-solid fa-link text-[10px] t3"></i>
      <span class="max-w-[340px] truncate">{{ s.url }}</span>
      <button class="ibtn !h-5 !w-5 opacity-0 transition group-hover:opacity-100" title="复制链接" @click="copyText(s.url, '链接已复制')">
        <i class="fa-regular fa-copy text-[10px]"></i>
      </button>
    </span>
  </td>
  <td class="px-4 py-3">
    <EnvBadge :env="s.environment" />
  </td>
  <td class="px-4 py-3">
    <span class="inline-flex items-center gap-1 text-xs t2">
      <i class="fa-solid fa-key text-[10px] t3"></i>{{ acctCounts[s.id] ?? 0 }} 个
    </span>
  </td>
  <td class="px-4 py-3 text-xs t3">
    {{ formatRelativeTime(s.updatedAt) }}
  </td>
  <td class="py-3 pl-4 pr-4 text-right">
    <div class="flex justify-end gap-0.5 opacity-50 transition group-hover:opacity-100">
      <button class="ibtn" title="编辑" @click="onEdit(s)">
        <i class="fa-solid fa-pen text-xs"></i>
      </button>
      <button class="ibtn" title="打开系统" @click="onOpen(s)">
        <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i>
      </button>
      <button class="ibtn danger" title="删除" @click="onDelete(s.id)">
        <i class="fa-regular fa-trash-can text-xs"></i>
      </button>
    </div>
  </td>
</tr>
```

- [ ] **Step 4: 更新网格视图**

```vue
<div v-else class="systems-grid grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
  <div v-for="s in filteredSystems" :key="s.id" class="panel stat-card group p-4">
    <div class="flex items-start justify-between">
      <span class="flex h-10 w-10 items-center justify-center rounded-xl text-base text-white" :style="iconStyle(s)">
        <i :class="s.icon || 'fa-solid fa-globe'"></i>
      </span>
      <EnvBadge :env="s.environment" />
    </div>
    <div class="mt-3 text-[14px] font-semibold t1">{{ s.name }}</div>
    <div class="mono mt-0.5 truncate text-xs t3">{{ s.url }}</div>
    <div v-if="s.tags?.length" class="mt-2 flex flex-wrap gap-1">
      <span v-for="tag in s.tags" :key="tag" class="chip">{{ tag }}</span>
    </div>
    <div class="mt-3 flex items-center justify-between pt-3 text-xs t3" style="border-top:1px solid var(--border)">
      <span>
        <i class="fa-solid fa-key mr-1 text-[10px]"></i>{{ acctCounts[s.id] ?? 0 }} 个账号 · {{ formatRelativeTime(s.updatedAt) }}
      </span>
      <div class="flex gap-0.5 opacity-0 transition group-hover:opacity-100">
        <button class="ibtn !h-6 !w-6" @click="onEdit(s)">
          <i class="fa-solid fa-pen text-[11px]"></i>
        </button>
        <button class="ibtn danger !h-6 !w-6" @click="onDelete(s.id)">
          <i class="fa-regular fa-trash-can text-[11px]"></i>
        </button>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 5: 更新样式**

```vue
<style scoped>
.system-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.action-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  flex-shrink: 0;
}

.view-toggle {
  display: flex;
  align-items: center;
  gap: 2px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg2);
  padding: 2px;
}
.view-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 26px;
  border-radius: 7px;
  color: var(--ink3);
  cursor: pointer;
  transition: .15s;
  border: none;
  background: transparent;
}
.view-btn.active {
  background: var(--panel);
  color: var(--accent);
  box-shadow: 0 0 0 1px var(--border), 0 2px 8px -2px rgba(15, 23, 38, .1);
}

.search-wrap {
  position: relative;
}

.table-wrap {
  margin: 0 24px calc(32px + 24px);
  overflow: hidden;
}

.systems-grid {
  padding: 0 24px calc(32px + 24px);
}
</style>
```

- [ ] **Step 6: 验证效果**

使用 MCP 工具截图对比 v3/dashboard.html 和当前页面，确保视觉一致。

- [ ] **Step 7: 提交**

```bash
git add src/dashboard/views/SystemView.vue
git commit -m "feat(views): refactor SystemView to match v3"
```

---

### Task 2.2：重构服务器卡片组件

**Files:**
- Modify: `src/dashboard/components/server/ServerCard.vue`

- [ ] **Step 1: 重写卡片结构**

```vue
<template>
  <div class="panel stat-card group p-4" @click="$emit('select')">
    <!-- 状态点 + 操作 -->
    <div class="flex items-center justify-between">
      <span class="inline-flex items-center gap-1.5 text-[11px] font-medium" :style="statusColor">
        <span class="relative flex h-1.5 w-1.5">
          <span v-if="online" class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" :style="{ background: statusColor.background }"></span>
          <span class="relative inline-flex h-1.5 w-1.5 rounded-full" :style="dotStyle"></span>
        </span>
        {{ statusLabel }}
      </span>
      <div class="flex gap-0.5 opacity-0 transition group-hover:opacity-100">
        <button class="ibtn !h-6 !w-6" title="终端" @click.stop="onCopySsh">
          <i class="fa-solid fa-terminal text-[11px]"></i>
        </button>
        <button class="ibtn danger !h-6 !w-6" title="删除" @click.stop="$emit('delete')">
          <i class="fa-regular fa-trash-can text-[11px]"></i>
        </button>
      </div>
    </div>

    <!-- 图标 + 名称 -->
    <div class="mt-3 flex items-center gap-3">
      <span class="flex h-10 w-10 flex-none items-center justify-center rounded-xl text-base text-white" style="background:#F59E0B;box-shadow:0 5px 14px -4px #F59E0B">
        <i class="fa-solid fa-server"></i>
      </span>
      <div class="min-w-0">
        <div class="truncate text-[14px] font-semibold t1">{{ server.name }}</div>
        <div class="mono truncate text-xs t3">{{ server.ip }}:{{ server.sshPort || 22 }}</div>
      </div>
    </div>

    <!-- 环境徽章 -->
    <div class="mt-2.5 flex items-center gap-1.5">
      <EnvBadge :env="server.environment" />
      <span v-if="server.purpose" class="chip">{{ server.purpose }}</span>
    </div>

    <!-- 详情列表 -->
    <dl class="mt-3 space-y-1.5 pt-3 text-xs" style="border-top:1px solid var(--border)">
      <div class="flex justify-between">
        <dt class="t3">
          <i class="fa-regular fa-user mr-1.5 w-3 text-center"></i>账号
        </dt>
        <dd class="mono t2">{{ server.username || '—' }}</dd>
      </div>
      <div class="flex justify-between">
        <dt class="t3">
          <i class="fa-solid fa-plug mr-1.5 w-3 text-center"></i>SSH 端口
        </dt>
        <dd class="mono t2">{{ server.sshPort || 22 }}</dd>
      </div>
      <div class="flex justify-between">
        <dt class="t3">
          <i class="fa-regular fa-clock mr-1.5 w-3 text-center"></i>最后更新
        </dt>
        <dd class="t2">{{ formatRelativeTime(server.updatedAt) }}</dd>
      </div>
    </dl>

    <!-- 操作按钮 -->
    <div class="mt-3 flex gap-2">
      <button class="btn-g flex-1 justify-center !py-1.5 !text-xs" @click.stop="onCopyIp">
        <i class="fa-regular fa-copy text-[10px]"></i>复制 IP
      </button>
      <button class="btn-g flex-1 justify-center !py-1.5 !text-xs" @click.stop="onCopySsh">
        <i class="fa-solid fa-terminal text-[10px]"></i>复制 SSH
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 更新脚本**

```typescript
<script setup lang="ts">
import { computed } from 'vue';
import type { Server } from '@shared/types/entities';
import { formatRelativeTime } from '@shared/utils/time';
import { copyToClipboard } from '@shared/utils/clipboard';
import { useToastStore } from '@shared/stores/toastStore';
import EnvBadge from '../common/EnvBadge.vue';

const props = defineProps<{ server: Server }>();
defineEmits<{ select: []; delete: [] }>();

const toast = useToastStore();

const statusKey = computed(() => props.server.status ?? 'online');
const online = computed(() => statusKey.value !== 'offline');
const statusLabel = computed(() => ({
  online: '在线',
  warn: '告警',
  offline: '离线',
}[statusKey.value as string] ?? '在线'));

const statusColor = computed(() => ({
  background: online.value ? 'var(--ok)' : 'var(--ink3)',
}));

const dotStyle = computed(() => ({
  background: online.value ? 'var(--ok)' : 'var(--ink3)',
  boxShadow: online.value ? '0 0 8px var(--ok)' : 'transparent',
}));

function buildSshCommand() {
  const user = props.server.username || 'root';
  const port = props.server.sshPort || 22;
  return `ssh ${user}@${props.server.ip} -p ${port}`;
}

async function onCopyIp() {
  try {
    await copyToClipboard(props.server.ip);
    toast.success('IP 已复制');
  } catch {
    toast.error('复制失败');
  }
}

async function onCopySsh() {
  try {
    await copyToClipboard(buildSshCommand());
    toast.success('SSH 命令已复制');
  } catch {
    toast.error('复制失败');
  }
}
</script>
```

- [ ] **Step 3: 删除旧样式，保留最小化样式**

```vue
<style scoped>
/* 使用 components.css 中的 panel stat-card 基类 */
</style>
```

- [ ] **Step 4: 验证效果**

使用 MCP 工具截图对比，确保卡片与 v3 完全一致。

- [ ] **Step 5: 提交**

```bash
git add src/dashboard/components/server/ServerCard.vue
git commit -m "feat(views): refactor ServerCard to match v3"
```

---

### Task 2.3：重构服务器视图

**Files:**
- Modify: `src/dashboard/views/ServerView.vue`

- [ ] **Step 1: 更新操作栏布局**

```vue
<div class="action-bar">
  <button class="btn-p" @click="onCreate">
    <i class="fa-solid fa-plus text-[11px]"></i>新增服务器
  </button>
  <div class="flex-1"></div>
  <div class="search-wrap">
    <i class="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] t3"></i>
    <input
      v-model="store.searchQuery"
      class="inp w-72 !pl-8"
      placeholder="搜索服务器名称、IP…"
    />
  </div>
</div>
```

- [ ] **Step 2: 更新网格布局**

```vue
<div class="server-grid grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
  <ServerCard
    v-for="s in store.filtered"
    :key="s.id"
    :server="s"
    @select="onSelect(s.id)"
    @delete="onDelete(s.id)"
  />
  <button
    class="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed t3 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
    style="border-color:var(--border2)"
    @click="onCreate"
  >
    <i class="fa-solid fa-plus text-lg"></i>
    <span class="text-[13px] font-medium">添加服务器</span>
    <span class="text-[11px]">快速创建新的服务器连接</span>
  </button>
</div>
```

- [ ] **Step 3: 更新样式**

```vue
<style scoped>
.server-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.action-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  flex-shrink: 0;
}

.server-grid {
  padding: 0 24px calc(32px + 24px);
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
</style>
```

- [ ] **Step 4: 提交**

```bash
git add src/dashboard/views/ServerView.vue
git commit -m "feat(views): refactor ServerView to match v3"
```

---

### Task 2.4：重构中间件视图

**Files:**
- Modify: `src/dashboard/views/MiddlewareView.vue`

- [ ] **Step 1: 更新操作栏**

```vue
<div class="action-bar">
  <button class="btn-p" @click="onCreate">
    <i class="fa-solid fa-plus text-[11px]"></i>新增中间件
  </button>
  <div class="flex-1"></div>
  <div class="search-wrap">
    <i class="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] t3"></i>
    <input
      v-model="search"
      class="inp w-72 !pl-8"
      placeholder="搜索中间件名称、Host…"
    />
  </div>
</div>
```

- [ ] **Step 2: 更新卡片结构**

```vue
<div class="mw-grid grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
  <div v-for="m in filtered" :key="m.id" class="panel stat-card group p-4">
    <!-- 图标 + 环境 -->
    <div class="flex items-start justify-between">
      <span
        class="flex h-10 w-10 items-center justify-center rounded-xl text-base text-white"
        :style="{ background: mwMeta(m.type).color, boxShadow: '0 5px 14px -4px ' + mwMeta(m.type).color }"
      >
        <i :class="mwMeta(m.type).icon"></i>
      </span>
      <div class="flex items-center gap-1.5">
        <EnvBadge :env="mwEnv(m)" />
        <div class="flex gap-0.5 opacity-0 transition group-hover:opacity-100">
          <button class="ibtn danger !h-6 !w-6" @click="onDelete(m.id)">
            <i class="fa-regular fa-trash-can text-[11px]"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- 名称 + 类型 -->
    <div class="mt-3 flex items-center gap-2">
      <span class="text-[14px] font-semibold t1">{{ m.name }}</span>
      <span class="mono rounded px-1 py-0.5 text-[10px] t2" style="background:var(--panel2);border:1px solid var(--border)">
        {{ m.type }}{{ m.version ? ' ' + m.version : '' }}
      </span>
    </div>

    <!-- 地址 -->
    <div class="mono mt-1 truncate text-xs t3">
      {{ m.host }}:{{ m.port }}{{ m.database ? ' / ' + m.database : '' }}
    </div>

    <!-- 详情 -->
    <dl class="mt-3 space-y-1.5 pt-3 text-xs" style="border-top:1px solid var(--border)">
      <div class="flex justify-between">
        <dt class="t3">
          <i class="fa-regular fa-user mr-1.5 w-3 text-center"></i>账号
        </dt>
        <dd class="mono t2">{{ m.username || '—' }}</dd>
      </div>
      <div class="flex justify-between">
        <dt class="t3">
          <i class="fa-regular fa-clock mr-1.5 w-3 text-center"></i>最后更新
        </dt>
        <dd class="t2">{{ formatRelativeTime(m.updatedAt) }}</dd>
      </div>
    </dl>

    <!-- 复制按钮 -->
    <button
      class="btn-g mt-3 w-full justify-center !py-1.5 !text-xs"
      @click="onCopyAddr(m)"
    >
      <i class="fa-regular fa-copy text-[10px]"></i>复制连接地址
    </button>
  </div>

  <button
    class="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed t3 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
    style="border-color:var(--border2)"
    @click="onCreate"
  >
    <i class="fa-solid fa-plus text-lg"></i>
    <span class="text-[13px] font-medium">添加中间件</span>
    <span class="mono text-[10.5px]">Redis · MySQL · MongoDB · ES</span>
  </button>
</div>
```

- [ ] **Step 3: 更新样式**

```vue
<style scoped>
.middleware-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.action-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  flex-shrink: 0;
}

.mw-grid {
  padding: 0 24px calc(32px + 24px);
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
</style>
```

- [ ] **Step 4: 提交**

```bash
git add src/dashboard/views/MiddlewareView.vue
git commit -m "feat(views): refactor MiddlewareView to match v3"
```

---

### Task 2.5：重构配置视图

**Files:**
- Modify: `src/dashboard/views/ConfigView.vue`

- [ ] **Step 1: 更新操作栏和分栏布局**

```vue
<div class="config-view">
  <div class="action-bar">
    <button class="btn-p" @click="startAddProject">
      <i class="fa-solid fa-plus text-[11px]"></i>新增项目
    </button>
    <div class="flex-1"></div>
    <div class="search-wrap">
      <i class="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] t3"></i>
      <input
        v-model="search"
        class="inp w-72 !pl-8"
        placeholder="搜索项目、配置…"
      />
    </div>
  </div>

  <div class="split-body flex gap-4">
    <!-- 左侧项目列表 -->
    <div class="w-60 flex-none">
      <div class="panel p-2">
        <div class="flex items-center justify-between px-2 pb-1.5 pt-1">
          <span class="text-[10px] font-semibold tracking-widest t3">项目</span>
          <button class="ibtn !h-5 !w-5" title="新增项目" @click="startAddProject">
            <i class="fa-solid fa-plus text-[10px]"></i>
          </button>
        </div>
        <div class="project-list">
          <!-- 项目项 -->
        </div>
      </div>
    </div>

    <!-- 右侧配置详情 -->
    <div class="panel min-h-[340px] flex-1 p-5">
      <!-- 配置内容 -->
    </div>
  </div>
</div>
```

- [ ] **Step 2: 更新项目列表项**

```vue
<div
  v-for="p in filteredProjects"
  :key="p.id"
  class="group flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-2 transition"
  :class="{ 't2': p.id !== store.selectedProjectId }"
  :style="p.id === store.selectedProjectId ? 'background:rgba(46,107,240,.09);color:var(--accent);box-shadow:inset 0 0 0 1px rgba(46,107,240,.25)' : ''"
  @click="store.selectProject(p.id)"
>
  <i class="fa-regular fa-folder text-xs" :style="{ color: p.id === store.selectedProjectId ? 'var(--accent)' : 'var(--ink3)' }"></i>
  <span class="flex-1 truncate text-[13px] font-medium">{{ p.name }}</span>
  <span class="mono text-[10px] t3">{{ p.configs.length }}</span>
  <button class="ibtn !h-5 !w-5 opacity-0 transition group-hover:opacity-100" title="重命名" @click.stop="startRenameProject(p)">
    <i class="fa-solid fa-pen text-[9px]"></i>
  </button>
  <button class="ibtn danger !h-5 !w-5 opacity-0 transition group-hover:opacity-100" title="删除" @click.stop="onDeleteProject(p.id)">
    <i class="fa-solid fa-xmark text-[10px]"></i>
  </button>
</div>
```

- [ ] **Step 3: 更新配置 chips**

```vue
<div class="cfg-chips flex flex-wrap items-center gap-2 mt-3">
  <span
    v-for="c in store.selectedProject.configs"
    :key="c.id"
    class="group inline-flex cursor-pointer items-center gap-1.5 rounded-lg border py-1.5 pl-3 pr-2 text-[12.5px] transition"
    :class="{ 'font-medium': c.id === store.selectedConfigId, 't2': c.id !== store.selectedConfigId }"
    :style="c.id === store.selectedConfigId ? 'border-color:rgba(46,107,240,.4);background:rgba(46,107,240,.08);color:var(--accent)' : 'border-color:var(--border);background:var(--panel)'"
    @click="store.selectConfig(c.id)"
  >
    {{ c.name }}
    <span class="mono text-[10px] t3">{{ c.fields.length }}</span>
    <button class="ibtn !h-4 !w-4 opacity-0 transition group-hover:opacity-100" title="重命名" @click.stop="startRenameConfig(c)">
      <i class="fa-solid fa-pen text-[8px]"></i>
    </button>
    <button class="ibtn danger !h-4 !w-4 opacity-0 transition group-hover:opacity-100" title="删除" @click.stop="onDeleteConfig(c.id)">
      <i class="fa-solid fa-xmark text-[9px]"></i>
    </button>
  </span>
  <button class="inline-flex items-center gap-1 rounded-lg border border-dashed px-2.5 py-1.5 text-[12px] t3 transition hover:border-[var(--accent)] hover:text-[var(--accent)]" style="border-color:var(--border2)" @click="startAddConfig">
    <i class="fa-solid fa-plus text-[9px]"></i>新增配置
  </button>
</div>
```

- [ ] **Step 4: 更新样式**

```vue
<style scoped>
.config-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 16px 24px calc(32px + 24px);
  gap: 16px;
}

.action-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.split-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>
```

- [ ] **Step 5: 提交**

```bash
git add src/dashboard/views/ConfigView.vue
git commit -m "feat(views): refactor ConfigView to match v3"
```

---

## 阶段 3：数据库扩展

### Task 3.1：更新数据库 Schema

**Files:**
- Modify: `src/shared/db/schema.ts`

- [ ] **Step 1: 添加 sortOrder 字段到所有表**

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const systems = sqliteTable('systems', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  environment: text('environment').notNull(),
  icon: text('icon'),
  iconColor: text('icon_color'),
  tags: text('tags', { mode: 'json' }),
  remark: text('remark'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0), // 新增
});

export const servers = sqliteTable('servers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ip: text('ip').notNull(),
  sshPort: integer('ssh_port'),
  username: text('username'),
  password: text('password'),
  environment: text('environment').notNull(),
  purpose: text('purpose'),
  status: text('status').default('online'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0), // 新增
});

export const middlewares = sqliteTable('middlewares', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  host: text('host').notNull(),
  port: integer('port').notNull(),
  version: text('version'),
  database: text('database'),
  username: text('username'),
  password: text('password'),
  extra: text('extra', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0), // 新增
});

export const configProjects = sqliteTable('config_projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0), // 新增
});

export const configDefs = sqliteTable('config_defs', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0), // 新增
});
```

- [ ] **Step 2: 提交**

```bash
git add src/shared/db/schema.ts
git commit -m "feat(db): add sortOrder field to all sortable tables"
```

---

### Task 3.2：创建迁移脚本

**Files:**
- Create: `src/shared/db/migrations/0006_add_sort_order.ts`

- [ ] **Step 1: 编写迁移脚本**

```typescript
import { sql } from 'drizzle-orm';
import type { BunSQLiteAsyncDialect } from 'drizzle-orm/bun-sqlite';

export async function up(db: BunSQLiteAsyncDialect) {
  // 添加列
  await db.run(sql`ALTER TABLE systems ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`);
  await db.run(sql`ALTER TABLE servers ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`);
  await db.run(sql`ALTER TABLE middlewares ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`);
  await db.run(sql`ALTER TABLE config_projects ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`);
  await db.run(sql`ALTER TABLE config_defs ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`);

  // 初始化排序（按创建时间）
  await db.run(sql`
    UPDATE systems SET sort_order = (
      SELECT ROW_NUMBER() OVER (ORDER BY created_at) - 1
      FROM systems s WHERE s.id = systems.id
    )
  `);
  await db.run(sql`
    UPDATE servers SET sort_order = (
      SELECT ROW_NUMBER() OVER (ORDER BY created_at) - 1
      FROM servers s WHERE s.id = servers.id
    )
  `);
  await db.run(sql`
    UPDATE middlewares SET sort_order = (
      SELECT ROW_NUMBER() OVER (ORDER BY created_at) - 1
      FROM middlewares m WHERE m.id = middlewares.id
    )
  `);
  await db.run(sql`
    UPDATE config_projects SET sort_order = (
      SELECT ROW_NUMBER() OVER (ORDER BY created_at) - 1
      FROM config_projects p WHERE p.id = config_projects.id
    )
  `);
  await db.run(sql`
    UPDATE config_defs SET sort_order = (
      SELECT ROW_NUMBER() OVER (ORDER BY created_at) - 1
      FROM config_defs c WHERE c.id = config_defs.id
    )
  `);
}

export async function down(db: BunSQLiteAsyncDialect) {
  await db.run(sql`ALTER TABLE systems DROP COLUMN sort_order`);
  await db.run(sql`ALTER TABLE servers DROP COLUMN sort_order`);
  await db.run(sql`ALTER TABLE middlewares DROP COLUMN sort_order`);
  await db.run(sql`ALTER TABLE config_projects DROP COLUMN sort_order`);
  await db.run(sql`ALTER TABLE config_defs DROP COLUMN sort_order`);
}
```

- [ ] **Step 2: 提交**

```bash
git add src/shared/db/migrations/0006_add_sort_order.ts
git commit -m "feat(db): add migration for sortOrder columns"
```

---

### Task 3.3：更新 Repository 层

**Files:**
- Modify: `src/shared/db/repositories/systemRepo.ts`

- [ ] **Step 1: 更新 list 方法按 sortOrder 排序**

```typescript
import { eq, asc, desc } from 'drizzle-orm';
import { systems } from '../schema';

export const systemRepo = {
  async list(db: BunDatabase) {
    return db
      .select()
      .from(systems)
      .orderBy(asc(systems.sortOrder), desc(systems.updatedAt));
  },

  async updateOrder(db: BunDatabase, orders: { id: string; sortOrder: number }[]) {
    for (const { id, sortOrder } of orders) {
      await db
        .update(systems)
        .set({ sortOrder })
        .where(eq(systems.id, id));
    }
  },
};
```

- [ ] **Step 2: 对其他表做同样更新**

```typescript
// serverRepo.ts
export const serverRepo = {
  async list(db: BunDatabase) {
    return db
      .select()
      .from(servers)
      .orderBy(asc(servers.sortOrder), desc(servers.updatedAt));
  },

  async updateOrder(db: BunDatabase, orders: { id: string; sortOrder: number }[]) {
    for (const { id, sortOrder } of orders) {
      await db
        .update(servers)
        .set({ sortOrder })
        .where(eq(servers.id, id));
    }
  },
};

// middlewareRepo.ts
export const middlewareRepo = {
  async list(db: BunDatabase) {
    return db
      .select()
      .from(middlewares)
      .orderBy(asc(middlewares.sortOrder), desc(middlewares.updatedAt));
  },

  async updateOrder(db: BunDatabase, orders: { id: string; sortOrder: number }[]) {
    for (const { id, sortOrder } of orders) {
      await db
        .update(middlewares)
        .set({ sortOrder })
        .where(eq(middlewares.id, id));
    }
  },
};

// configRepo.ts
export const configRepo = {
  async listProjects(db: BunDatabase) {
    return db
      .select()
      .from(configProjects)
      .orderBy(asc(configProjects.sortOrder));
  },

  async updateProjectOrder(db: BunDatabase, orders: { id: string; sortOrder: number }[]) {
    for (const { id, sortOrder } of orders) {
      await db
        .update(configProjects)
        .set({ sortOrder })
        .where(eq(configProjects.id, id));
    }
  },

  async listConfigsByProject(db: BunDatabase, projectId: string) {
    return db
      .select()
      .from(configDefs)
      .where(eq(configDefs.projectId, projectId))
      .orderBy(asc(configDefs.sortOrder));
  },

  async updateConfigOrder(db: BunDatabase, projectId: string, orders: { id: string; sortOrder: number }[]) {
    for (const { id, sortOrder } of orders) {
      await db
        .update(configDefs)
        .set({ sortOrder })
        .where(eq(configDefs.id, id));
    }
  },
};
```

- [ ] **Step 3: 提交**

```bash
git add src/shared/db/repositories/*.ts
git commit -m "feat(db): add updateOrder methods to all repositories"
```

---

### Task 3.4：更新 Store 层

**Files:**
- Modify: `src/shared/stores/systemStore.ts`

- [ ] **Step 1: 添加 updateOrder 方法**

```typescript
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { systemRepo } from '@shared/db/repositories/systemRepo';

export const useSystemStore = defineStore('system', () => {
  const list = ref<System[]>([]);

  async function load() {
    list.value = await systemRepo.list(db);
  }

  async function updateOrder(newList: System[]) {
    const orders = newList.map((s, i) => ({ id: s.id, sortOrder: i }));
    await systemRepo.updateOrder(db, orders);
    list.value = newList;
  }

  return { list, load, updateOrder };
});
```

- [ ] **Step 2: 对其他 store 做同样更新**

```typescript
// serverStore.ts
export const useServerStore = defineStore('server', () => {
  const list = ref<Server[]>([]);

  async function load() {
    list.value = await serverRepo.list(db);
  }

  async function updateOrder(newList: Server[]) {
    const orders = newList.map((s, i) => ({ id: s.id, sortOrder: i }));
    await serverRepo.updateOrder(db, orders);
    list.value = newList;
  }

  return { list, load, updateOrder };
});

// middlewareStore.ts
export const useMiddlewareStore = defineStore('middleware', () => {
  const list = ref<Middleware[]>([]);

  async function load() {
    list.value = await middlewareRepo.list(db);
  }

  async function updateOrder(newList: Middleware[]) {
    const orders = newList.map((m, i) => ({ id: m.id, sortOrder: i }));
    await middlewareRepo.updateOrder(db, orders);
    list.value = newList;
  }

  return { list, load, updateOrder };
});

// configStore.ts
export const useConfigStore = defineStore('config', () => {
  const list = ref<ConfigProject[]>([]);

  async function load() {
    list.value = await configRepo.listProjects(db);
  }

  async function updateProjectOrder(newList: ConfigProject[]) {
    const orders = newList.map((p, i) => ({ id: p.id, sortOrder: i }));
    await configRepo.updateProjectOrder(db, orders);
    list.value = newList;
  }

  async function updateConfigOrder(projectId: string, newList: ConfigDef[]) {
    const orders = newList.map((c, i) => ({ id: c.id, sortOrder: i }));
    await configRepo.updateConfigOrder(db, projectId, orders);
    const proj = list.value.find(p => p.id === projectId);
    if (proj) proj.configs = newList;
  }

  return { list, load, updateProjectOrder, updateConfigOrder };
});
```

- [ ] **Step 3: 提交**

```bash
git add src/shared/stores/*.ts
git commit -m "feat(store): add updateOrder methods to all stores"
```

---

## 阶段 4：拖拽功能实现

### Task 4.1：安装 vue-draggable-plus

- [ ] **Step 1: 安装依赖**

```bash
pnpm add vue-draggable-plus
```

- [ ] **Step 2: 提交**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): add vue-draggable-plus"
```

---

### Task 4.2：系统视图拖拽 - 列表视图

**Files:**
- Modify: `src/dashboard/views/SystemView.vue`

- [ ] **Step 1: 导入 VueDraggable**

```typescript
import { VueDraggable } from 'vue-draggable-plus';
```

- [ ] **Step 2: 包裹表格 tbody**

```vue
<div v-if="viewMode === 'table'" class="table-wrap panel">
  <table class="w-full">
    <thead>...</thead>
    <VueDraggable
      v-model="filteredSystems"
      tag="tbody"
      :animation="200"
      ghost-class="dragging"
      handle=".drag-handle"
      @end="onTableDragEnd"
    >
      <tr v-for="s in filteredSystems" :key="s.id" class="row-h group transition" style="border-bottom:1px solid var(--border)">
        <td class="py-3 pl-4 pr-2">
          <i class="fa-solid fa-grip-vertical drag-handle cursor-move text-[11px] t3"></i>
        </td>
        <!-- 其他列 -->
      </tr>
    </VueDraggable>
  </table>
</div>
```

- [ ] **Step 3: 添加拖拽结束处理**

```typescript
async function onTableDragEnd(event: any) {
  const { oldIndex, newIndex } = event;
  if (oldIndex !== newIndex) {
    const newList = [...filteredSystems.value];
    const [moved] = newList.splice(oldIndex, 1);
    newList.splice(newIndex, 0, moved);
    filteredSystems.value = newList;
    await store.updateOrder(newList);
    toast.success('排序已更新');
  }
}
```

- [ ] **Step 4: 添加拖拽样式**

```vue
<style scoped>
.dragging {
  opacity: 0.5;
  background: var(--accent) !important;
  box-shadow: 0 8px 24px rgba(46, 107, 240, 0.3) !important;
}

.drag-handle {
  cursor: move;
  opacity: 0;
  transition: opacity 0.15s;
}
.row-h:hover .drag-handle {
  opacity: 1;
}
</style>
```

- [ ] **Step 5: 提交**

```bash
git add src/dashboard/views/SystemView.vue
git commit -m "feat(drag): add table row drag to SystemView"
```

---

### Task 4.3：系统视图拖拽 - 网格视图

**Files:**
- Modify: `src/dashboard/views/SystemView.vue`

- [ ] **Step 1: 包裹网格容器**

```vue
<VueDraggable
  v-else
  v-model="filteredSystems"
  class="systems-grid grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
  :animation="200"
  ghost-class="dragging"
  @end="onGridDragEnd"
>
  <div v-for="s in filteredSystems" :key="s.id" class="panel stat-card group p-4">
    <!-- 卡片内容 -->
  </div>
</VueDraggable>
```

- [ ] **Step 2: 添加拖拽结束处理**

```typescript
async function onGridDragEnd(event: any) {
  const { oldIndex, newIndex } = event;
  if (oldIndex !== newIndex) {
    const newList = [...filteredSystems.value];
    const [moved] = newList.splice(oldIndex, 1);
    newList.splice(newIndex, 0, moved);
    filteredSystems.value = newList;
    await store.updateOrder(newList);
    toast.success('排序已更新');
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add src/dashboard/views/SystemView.vue
git commit -m "feat(drag): add grid card drag to SystemView"
```

---

### Task 4.4：服务器视图拖拽

**Files:**
- Modify: `src/dashboard/views/ServerView.vue`

- [ ] **Step 1: 导入 VueDraggable**

```typescript
import { VueDraggable } from 'vue-draggable-plus';
```

- [ ] **Step 2: 包裹服务器列表**

```vue
<div class="server-grid grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
  <VueDraggable
    v-model="store.list"
    :animation="200"
    ghost-class="dragging"
    item-key="id"
    @end="onDragEnd"
  >
    <ServerCard
      v-for="s in store.list"
      :key="s.id"
      :server="s"
      @select="onSelect(s.id)"
      @delete="onDelete(s.id)"
    />
  </VueDraggable>
  <button class="add-card" @click="onCreate">...</button>
</div>
```

- [ ] **Step 3: 添加拖拽结束处理**

```typescript
async function onDragEnd(event: any) {
  const { oldIndex, newIndex } = event;
  if (oldIndex !== newIndex) {
    const newList = [...store.list];
    const [moved] = newList.splice(oldIndex, 1);
    newList.splice(newIndex, 0, moved);
    await store.updateOrder(newList);
    toast.success('排序已更新');
  }
}
```

- [ ] **Step 4: 添加拖拽样式**

```vue
<style scoped>
.dragging {
  opacity: 0.5;
  background: var(--accent) !important;
  box-shadow: 0 8px 24px rgba(46, 107, 240, 0.3) !important;
}
</style>
```

- [ ] **Step 5: 提交**

```bash
git add src/dashboard/views/ServerView.vue
git commit -m "feat(drag): add card drag to ServerView"
```

---

### Task 4.5：中间件视图拖拽

**Files:**
- Modify: `src/dashboard/views/MiddlewareView.vue`

- [ ] **Step 1: 导入 VueDraggable**

```typescript
import { VueDraggable } from 'vue-draggable-plus';
```

- [ ] **Step 2: 包裹中间件列表**

```vue
<VueDraggable
  v-model="filtered"
  class="mw-grid grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
  :animation="200"
  ghost-class="dragging"
  @end="onDragEnd"
>
  <div v-for="m in filtered" :key="m.id" class="panel stat-card group p-4">
    <!-- 卡片内容 -->
  </div>
</VueDraggable>
```

- [ ] **Step 3: 添加拖拽结束处理**

```typescript
async function onDragEnd(event: any) {
  const { oldIndex, newIndex } = event;
  if (oldIndex !== newIndex) {
    const newList = [...filtered.value];
    const [moved] = newList.splice(oldIndex, 1);
    newList.splice(newIndex, 0, moved);
    await store.updateOrder(newList);
    toast.success('排序已更新');
  }
}
```

- [ ] **Step 4: 提交**

```bash
git add src/dashboard/views/MiddlewareView.vue
git commit -m "feat(drag): add card drag to MiddlewareView"
```

---

### Task 4.6：配置视图拖拽 - 项目列表

**Files:**
- Modify: `src/dashboard/views/ConfigView.vue`

- [ ] **Step 1: 导入 VueDraggable**

```typescript
import { VueDraggable } from 'vue-draggable-plus';
```

- [ ] **Step 2: 包裹项目列表**

```vue
<VueDraggable
  v-model="filteredProjects"
  class="project-list space-y-0.5"
  :animation="200"
  ghost-class="dragging"
  @end="onProjectDragEnd"
>
  <div
    v-for="p in filteredProjects"
    :key="p.id"
    class="group flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-2 transition"
    :class="{ 't2': p.id !== store.selectedProjectId }"
    :style="p.id === store.selectedProjectId ? 'background:rgba(46,107,240,.09);color:var(--accent);box-shadow:inset 0 0 0 1px rgba(46,107,240,.25)' : ''"
    @click="store.selectProject(p.id)"
  >
    <!-- 项目项内容 -->
  </div>
</VueDraggable>
```

- [ ] **Step 3: 添加拖拽结束处理**

```typescript
async function onProjectDragEnd(event: any) {
  const { oldIndex, newIndex } = event;
  if (oldIndex !== newIndex) {
    const newList = [...filteredProjects.value];
    const [moved] = newList.splice(oldIndex, 1);
    newList.splice(newIndex, 0, moved);
    filteredProjects.value = newList;
    await store.updateProjectOrder(newList);
    toast.success('项目排序已更新');
  }
}
```

- [ ] **Step 4: 提交**

```bash
git add src/dashboard/views/ConfigView.vue
git commit -m "feat(drag): add project list drag to ConfigView"
```

---

### Task 4.7：配置视图拖拽 - 配置 chips

**Files:**
- Modify: `src/dashboard/views/ConfigView.vue`

- [ ] **Step 1: 包裹配置 chips**

```vue
<VueDraggable
  v-model="store.selectedProject.configs"
  class="cfg-chips flex flex-wrap items-center gap-2 mt-3"
  :animation="200"
  ghost-class="dragging"
  @end="onConfigDragEnd"
>
  <span
    v-for="c in store.selectedProject.configs"
    :key="c.id"
    class="group inline-flex cursor-pointer items-center gap-1.5 rounded-lg border py-1.5 pl-3 pr-2 text-[12.5px] transition"
    :class="{ 'font-medium': c.id === store.selectedConfigId, 't2': c.id !== store.selectedConfigId }"
    :style="c.id === store.selectedConfigId ? 'border-color:rgba(46,107,240,.4);background:rgba(46,107,240,.08);color:var(--accent)' : 'border-color:var(--border);background:var(--panel)'"
    @click="store.selectConfig(c.id)"
  >
    <!-- 配置 chip 内容 -->
  </span>
</VueDraggable>
```

- [ ] **Step 2: 添加拖拽结束处理**

```typescript
async function onConfigDragEnd(event: any) {
  const { oldIndex, newIndex } = event;
  if (oldIndex !== newIndex) {
    const newList = [...store.selectedProject.configs];
    const [moved] = newList.splice(oldIndex, 1);
    newList.splice(newIndex, 0, moved);
    await store.updateConfigOrder(store.selectedProject.id, newList);
    toast.success('配置排序已更新');
  }
}
```

- [ ] **Step 3: 添加拖拽样式**

```vue
<style scoped>
.dragging {
  opacity: 0.5;
  background: var(--accent) !important;
  box-shadow: 0 8px 24px rgba(46, 107, 240, 0.3) !important;
}
</style>
```

- [ ] **Step 4: 提交**

```bash
git add src/dashboard/views/ConfigView.vue
git commit -m "feat(drag): add config chips drag to ConfigView"
```

---

## 最终验证

### Task 5.1：视觉精确匹配验证

- [ ] **Step 1: 使用 MCP 工具截图系统列表视图**

使用 `ui_diff_check` 对比 v3/dashboard.html 和当前页面的系统列表视图。

- [ ] **Step 2: 使用 MCP 工具截图系统网格视图**

对比系统网格视图。

- [ ] **Step 3: 使用 MCP 工具截图服务器视图**

对比服务器卡片。

- [ ] **Step 4: 使用 MCP 工具截图中间件视图**

对比中间件卡片。

- [ ] **Step 5: 使用 MCP 工具截图配置视图**

对比配置左右分栏。

- [ ] **Step 6: 修复差异**

如有差异，逐个修复。

---

### Task 5.2：拖拽功能验证

- [ ] **Step 1: 测试系统列表拖拽**

拖动系统行，验证排序更新并持久化。

- [ ] **Step 2: 测试系统网格拖拽**

拖动系统卡片，验证排序更新并持久化。

- [ ] **Step 3: 测试服务器拖拽**

拖动服务器卡片，验证排序更新并持久化。

- [ ] **Step 4: 测试中间件拖拽**

拖动中间件卡片，验证排序更新并持久化。

- [ ] **Step 5: 测试配置项目拖拽**

拖动项目列表项，验证排序更新并持久化。

- [ ] **Step 6: 测试配置 chips 拖拽**

拖动配置 chips，验证排序更新并持久化。

- [ ] **Step 7: 刷新页面验证持久化**

刷新页面后，验证排序是否保持。

---

### Task 5.3：最终提交

- [ ] **Step 1: 创建最终提交**

```bash
git add .
git commit -m "feat(dashboard): complete v3 refactor with drag-to-sort

- Exact visual match with v3/dashboard.html
- Drag-to-sort for all views (systems, servers, middleware, configs)
- Sort order persisted to database
- Smooth 200ms animations
- Full dark theme support"
```

---

## 完成标准

- [ ] 所有视图与 v3 视觉完全一致
- [ ] 所有视图支持拖拽排序
- [ ] 排序状态持久化到数据库
- [ ] 刷新页面后排序保持
- [ ] 暗色主题正常工作
- [ ] 无 TypeScript 错误
- [ ] 无 ESLint 错误
- [ ] 所有拖拽动画流畅

---

**审批：**

- [ ] 计划已审查
- [ ] 准备开始执行
