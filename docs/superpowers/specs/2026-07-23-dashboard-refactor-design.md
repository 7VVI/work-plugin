# 管理面板重构设计文档

**日期：** 2026-07-23
**作者：** Claude
**状态：** 待审批

---

## 1. 概述

### 1.1 目标

优化插件管理面板，使系统、服务器、中间件、配置界面与 `v3/dashboard.html` 完全一致，并添加拖拽排序功能。

### 1.2 范围

- ✅ 系统视图（列表 + 网格）
- ✅ 服务器视图（网格）
- ✅ 中间件视图（网格）
- ✅ 配置视图（左右分栏）
- ❌ 导入导出视图（保持现状）
- ❌ 设置视图（保持现状）

### 1.3 非目标

- 不修改导入导出和设置界面
- 不改变现有数据结构（仅扩展）

---

## 2. 设计系统迁移

### 2.1 文件结构

```
src/dashboard/styles/
├── design-tokens.css     # 核心令牌（颜色、间距、阴影等）
├── components.css         # 组件样式基类
└── index.css              # 汇总入口
```

### 2.2 设计令牌定义

**design-tokens.css:**

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

  /* === 网格背景 === */
  --grid-line: rgba(46, 107, 240, .055);

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

/* 暗色主题 */
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

/* 兼容映射 */
:root {
  --primary: var(--accent);
  --text-primary: var(--ink);
  --text-secondary: var(--ink2);
  --text-tertiary: var(--ink3);
}
```

### 2.3 组件基类

**components.css:** 从 v3 提取通用组件样式

- `.panel` - 卡片容器
- `.btn-p` - 主按钮
- `.btn-g` - 次要按钮
- `.inp` - 输入框
- `.chip` - 标签
- `.env` - 环境徽章（含发光效果）
- `.stat-card` - 统计卡片（hover 渐变高光）

---

## 3. 核心视图重构

### 3.1 系统视图

**布局结构：**

```
┌─────────────────────────────────────────┐
│ 新增系统 + 删除选中 + 视图切换 + 搜索    │
├─────────────────────────────────────────┤
│ 列表视图 / 网格视图                      │
└─────────────────────────────────────────┘
```

**关键样式调整：**

| 元素 | 现有 | v3 | 调整 |
|------|------|-----|------|
| 操作栏间距 | `gap-lg` | `gap-3` (12px) | 减少 |
| 表头字体 | 12px | 10.5px | 缩小 |
| 表头字距 | normal | 0.08em | 增加 |
| 卡片内边距 | 16px | 16px | 一致 ✓ |
| 卡片圆角 | 14px | 14px | 一致 ✓ |

**表格列宽：**

- checkbox: 40px
- 系统名称: 28%
- URL: 32%
- 环境: 96px
- 最近更新: 112px
- 操作: 128px

**网格响应式：**

- 默认: 1列
- sm (640px): 2列
- xl (1280px): 3列
- 2xl (1536px): 4列

### 3.2 服务器视图

**卡片结构：**

```
┌─────────────────────────┐
│ 状态点 + 操作按钮         │  ← 在线有呼吸动画
├─────────────────────────┤
│ 图标 + 名称/IP           │  ← 图标 40x40，橙色
├─────────────────────────┤
│ 环境徽章 + 用途 chip     │
├─────────────────────────┤
│ 账号 / SSH端口 / 更新时间 │  ← dl 列表，border-top
├─────────────────────────┤
│ 复制IP  |  复制SSH       │  ← 两个按钮
└─────────────────────────┘
```

**关键样式：**

- 在线状态：呼吸点动画（`@keyframes ping`）
- 图标：固定橙色 `#F59E0B`，阴影 `0 5px 14px -4px #F59E0B`
- 详情列表：使用 `<dl>` 标签，border-top 分隔

### 3.3 中间件视图

**类型颜色映射：**

```typescript
const MW_TYPES = {
  Redis:        { icon: 'fa-solid fa-bolt', color: '#DC382D' },
  MySQL:        { icon: 'fa-solid fa-database', color: '#00758F' },
  PostgreSQL:   { icon: 'fa-solid fa-database', color: '#336791' },
  MongoDB:      { icon: 'fa-solid fa-leaf', color: '#47A248' },
  Elasticsearch: { icon: 'fa-solid fa-magnifying-glass', color: '#B7791F' },
  RabbitMQ:     { icon: 'fa-solid fa-message', color: '#FF6600' },
  Kafka:        { icon: 'fa-solid fa-stream', color: '#4B5563' },
  Nginx:        { icon: 'fa-solid fa-server', color: '#009639' },
  MinIO:        { icon: 'fa-solid fa-cube', color: '#C72E49' },
};
```

**卡片特点：**

- 左上角：彩色图标（按类型着色）
- 右上角：环境徽章
- 类型 + 版本显示为 chip
- 底部：单个"复制连接地址"按钮

### 3.4 配置视图

**布局结构：**

```
┌──────────────────────────────────────┐
│ 新增项目 + 搜索                        │
├────────────┬─────────────────────────┤
│ 项目列表    │ 配置详情                  │
│ w-60       │ flex-1                   │
│            │                          │
│ ○ cors国内  │ 📁 cors国内               │
│   (3)      │ [接口配置 3] [333 1] [+新增]│
│            │                          │
│            │ ┌──────────────────────┐│
│            │ │ 字段表格              ││
│            │ │ + 字段标识  字段名称  ││
│            │ └──────────────────────┘│
└────────────┴─────────────────────────┘
```

**关键样式：**

- 左侧面板：固定宽度 240px
- 项目项：padding 8px 10px
- 配置 chip：圆角 8px
- 字段表格：10.5px 表头，字距 0.12em

---

## 4. 数据库扩展

### 4.1 Schema 修改

```typescript
// src/shared/db/schema.ts

export const systems = sqliteTable('systems', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  // ... 现有字段
  sortOrder: integer('sort_order').default(0), // 新增
});

export const servers = sqliteTable('servers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ip: text('ip').notNull(),
  // ... 现有字段
  sortOrder: integer('sort_order').default(0), // 新增
});

export const middlewares = sqliteTable('middlewares', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  // ... 现有字段
  sortOrder: integer('sort_order').default(0), // 新增
});

export const configProjects = sqliteTable('config_projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  // ... 现有字段
  sortOrder: integer('sort_order').default(0), // 新增
});

export const configDefs = sqliteTable('config_defs', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  // ... 现有字段
  sortOrder: integer('sort_order').default(0), // 新增
});
```

### 4.2 迁移脚本

```typescript
// src/shared/db/migrations/0006_add_sort_order.ts

import { sql } from 'drizzle-orm';
import type { BunSQLiteAsyncDialect } from 'drizzle-orm/bun-sqlite';

export async function up(db: BunSQLiteAsyncDialect) {
  // 1. 添加列
  await db.run(sql`ALTER TABLE systems ADD COLUMN sort_order INTEGER DEFAULT 0`);
  await db.run(sql`ALTER TABLE servers ADD COLUMN sort_order INTEGER DEFAULT 0`);
  await db.run(sql`ALTER TABLE middlewares ADD COLUMN sort_order INTEGER DEFAULT 0`);
  await db.run(sql`ALTER TABLE config_projects ADD COLUMN sort_order INTEGER DEFAULT 0`);
  await db.run(sql`ALTER TABLE config_defs ADD COLUMN sort_order INTEGER DEFAULT 0`);

  // 2. 初始化排序（按创建时间）
  await db.run(sql`
    UPDATE systems SET sort_order = (
      SELECT ROW_NUMBER() OVER (ORDER BY created_at) - 1
      FROM systems WHERE id = systems.id
    )
  `);
  // ... 其他表同理
}

export async function down(db: BunSQLiteAsyncDialect) {
  await db.run(sql`ALTER TABLE systems DROP COLUMN sort_order`);
  // ... 其他表
}
```

### 4.3 Repository 层更新

```typescript
// src/shared/db/repositories/systemRepo.ts

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

### 4.4 Store 层更新

```typescript
// src/shared/stores/systemStore.ts

export const useSystemStore = defineStore('system', () => {
  const list = ref<System[]>([]);

  async function updateOrder(newList: System[]) {
    const orders = newList.map((s, i) => ({ id: s.id, sortOrder: i }));
    await systemRepo.updateOrder(db, orders);
    list.value = newList;
  }

  return { list, updateOrder };
});
```

---

## 5. 拖拽功能实现

### 5.1 技术选型

使用 **vue-draggable-plus**（基于 SortableJS 的 Vue 3 原生封装）

```bash
pnpm add vue-draggable-plus
```

### 5.2 系统视图拖拽

**列表视图：**

```vue
<VueDraggable
  v-model="filteredSystems"
  tag="table"
  :animation="200"
  ghost-class="dragging"
  @end="onDragEnd"
>
  <tbody>
    <tr v-for="s in filteredSystems" :key="s.id" class="row-h">
      <!-- 表格内容 -->
    </tr>
  </tbody>
</VueDraggable>
```

**网格视图：**

```vue
<VueDraggable
  v-model="filteredSystems"
  class="systems-grid"
  :animation="200"
  ghost-class="dragging"
  @end="onDragEnd"
>
  <div v-for="s in filteredSystems" :key="s.id" class="panel stat-card group p-4">
    <!-- 卡片内容 -->
  </div>
</VueDraggable>
```

### 5.3 服务器/中间件视图拖拽

```vue
<VueDraggable
  v-model="store.list"
  :animation="200"
  ghost-class="dragging"
  @end="onDragEnd"
>
  <ServerCard v-for="s in store.list" :key="s.id" :server="s" />
</VueDraggable>
```

### 5.4 配置视图拖拽

**项目列表：**

```vue
<VueDraggable
  v-model="filteredProjects"
  class="left-list"
  :animation="200"
  @end="onProjectDragEnd"
>
  <div v-for="p in filteredProjects" :key="p.id" class="proj-item group">
    <!-- 项目项内容 -->
  </div>
</VueDraggable>
```

**配置 chips：**

```vue
<VueDraggable
  v-model="selectedProject.configs"
  :animation="200"
  @end="onConfigDragEnd"
>
  <span v-for="c in selectedProject.configs" :key="c.id" class="cfg-chip group">
    <!-- 配置 chip 内容 -->
  </span>
</VueDraggable>
```

### 5.5 拖拽样式

```css
.dragging {
  opacity: 0.5;
  background: var(--accent) !important;
  box-shadow: 0 8px 24px rgba(46, 107, 240, 0.3) !important;
}

.vue-draggable-ghost {
  border: 2px dashed var(--accent);
  background: rgba(46, 107, 240, 0.05);
}

.systems-grid .panel,
.server-grid .server-card,
.mw-grid .mw-card,
.left-list .proj-item,
.cfg-chips .cfg-chip {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
```

---

## 6. 实施阶段

### 阶段 1：设计系统迁移（预估 2-3 小时）

1. 创建 `design-tokens.css`
2. 创建 `components.css`
3. 更新全局样式入口
4. 验证设计令牌正确性

### 阶段 2：核心视图重构（预估 6-8 小时）

1. SystemView 重构
2. ServerCard 重构
3. MiddlewareView 重构
4. ConfigView 重构
5. 使用 MCP 工具截图验证

### 阶段 3：数据库扩展（预估 2-3 小时）

1. 更新 schema
2. 创建迁移脚本
3. 更新 Repository 层
4. 更新 Store 层

### 阶段 4：拖拽功能实现（预估 4-5 小时）

1. 安装 vue-draggable-plus
2. 系统视图拖拽
3. 服务器视图拖拽
4. 中间件视图拖拽
5. 配置视图拖拽
6. 测试排序持久化

---

## 7. 验收标准

### 7.1 视觉精确匹配

- [ ] 系统列表视图与 v3 完全一致
- [ ] 系统网格视图与 v3 完全一致
- [ ] 服务器卡片与 v3 完全一致
- [ ] 中间件卡片与 v3 完全一致
- [ ] 配置左右分栏与 v3 完全一致
- [ ] 暗色主题正确切换

### 7.2 拖拽功能

- [ ] 系统列表可拖拽排序
- [ ] 系统网格可拖拽排序
- [ ] 服务器网格可拖拽排序
- [ ] 中间件网格可拖拽排序
- [ ] 配置项目列表可拖拽排序
- [ ] 配置 chips 可拖拽排序
- [ ] 排序状态持久化到数据库

### 7.3 交互体验

- [ ] 拖拽动画流畅（200ms 过渡）
- [ ] 拖拽元素有视觉反馈
- [ ] 排序更新后 toast 提示
- [ ] 刷新页面后排序保持

---

## 8. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 设计令牌冲突 | 高 | 使用兼容映射，保留旧变量名 |
| 数据库迁移失败 | 高 | 提供 down 回滚脚本，备份数据 |
| 拖拽性能问题 | 中 | 限制拖拽范围，优化 DOM 结构 |
| 样式覆盖不完全 | 中 | 分阶段验证，使用 MCP 截图对比 |

---

## 9. 后续优化

1. **键盘快捷键**：支持 Ctrl+↑/↓ 调整排序
2. **批量操作**：支持多选拖拽
3. **撤销/重做**：记录排序历史
4. **动画优化**：使用 FLIP 动画技术

---

**审批：**

- [ ] 设计已审查
- [ ] 实施计划已创建
- [ ] 开始开发