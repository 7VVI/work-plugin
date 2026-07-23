# v3 视觉重设计（Light Lab）— 设计文档

- 日期：2026-07-23
- 范围：Chrome 扩展 `nav-portal`（dashboard 管理控制台 + popup 扩展弹窗）
- 目标：将现有 Vue 3 插件的视觉系统、布局与交互对齐 `v3/` 目录下的界面原型（`dashboard.html`、`popup.html`、`index.html`）。

---

## 1. 背景与目标

现有插件为 Vue 3 + Pinia + Vue Router + Dexie + CRXJS 应用，数据层（crypto / repositories / services / stores）成熟稳定。`v3/` 原型为纯 HTML + 原生 JS + Tailwind CDN，呈现一套"Light Lab"亮色高密度运维控制台视觉语言。

本次重设计**只换皮、不换骨**：保留 Vue 架构与全部既有功能，把 v3 的设计令牌、配色、组件、布局、动画迁移到现有 Vue 组件上，并补齐 v3 的标志性结构元素。

## 2. 关键决策

| 决策点 | 选择 |
|---|---|
| 实现方式 | **保留 Vue 架构，重做视觉系统**（不重写为原生 JS、不引入 Tailwind） |
| 覆盖范围 | **dashboard + popup 全覆盖**，公共组件（Modal/Dialog/Toast/EnvBadge 等）一并替换 |
| 新增结构 | **全部加入**：底部状态栏 + 实时时钟、`dock://path` 面包屑、滑动发光 Tab 指示条、系统列表/网格视图切换 |
| 执行路径 | **令牌优先、自底向上**（A）：tokens → 公共组件 → 外壳布局 → 逐视图 → popup |

## 3. 设计令牌（重写 `src/dashboard/styles/tokens.css`）

### 3.1 配色（亮色默认）

```
--bg:        #F3F6FB
--bg2:       #EBF0F8
--panel:     #FFFFFF
--panel2:    #F4F7FC
--solid:     #FFFFFF
--solid2:    #F6F8FC
--border:    #E1E8F2
--border2:   #C6D2E4
--ink:       #0F1726   (主文字)
--ink2:      #4E5D75   (次文字)
--ink3:      #8593A9   (弱文字)
--accent:    #2E6BF0   (主色)
--accent2:   #0891B2   (青色副色)
--glow:      rgba(46,107,240,.25)
--ok:        #059669
--warn:      #B45309
--danger:    #DC2626
--info:      #2563EB
--grid-line: rgba(46,107,240,.055)
```

> 兼容策略：保留旧别名变量（`--primary` = `--accent`、`--text-primary` = `--ink` 等）指向新值，避免大量散落引用一次性断裂；后续逐步收敛命名。

### 3.2 字体

```
--font-sans: "Amazon Ember","Noto Sans SC",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
--font-mono: "JetBrains Mono","SF Mono",Consolas,monospace;
```

- "Amazon Ember" 为亚马逊专有字体，多数用户未安装 → 优雅回退到 Noto Sans SC，观感一致。
- 数据 / URL / IP / 端口 / 路径统一 `--font-mono`。

### 3.3 背景纹理（全局）

- `body::before`：40px 网格线（`--grid-line`），顶部径向遮罩淡出。
- `body::after`：左上蓝 `rgba(46,107,240,.10)` + 右上青 `rgba(8,145,178,.07)` 径向辉光。

### 3.4 暗色模式

- 选择器沿用现有 `[data-theme="dark"]`（App.vue 已用 `document.documentElement.dataset.theme`）。
- 令牌替换为 v3 深色：`--bg:#060A11`、面板半透明 `rgba(148,178,255,.05/.09)`、`--accent:#3D7FFF`、`--accent2:#22D3EE`、文字 `#E9EEF8/#93A1B8/#56657D`。
- `body::after` 与 `.panel` 在暗色下使用 blur + 调整辉光。

## 4. 外壳布局（dashboard）

### 4.1 合并 sticky header

现状：`PageHeader`（64px）+ `NavTabs`（56px）两根独立条。v3 为单根合并 header。

- **顶行（h-14）**：`D` 渐变 logo + "Dock" + "控制台"徽章；右侧主题切换钮 + 头像。移除独立的"设置"齿轮入口（并入"设置" Tab，与 v3 一致）。
- **下行**：Tab 组 + **滑动发光指示条** `#tab-ink`（绝对定位，`transition:left .32s / width .32s cubic-bezier(.3,1.1,.4,1)`，`box-shadow:0 0 12px var(--glow)`）+ 右侧 `dock://systems` 路径与统计副标题（仅 lg 以上显示）。

### 4.2 全宽主区域

- 移除 `view-container` 对内容宽度的额外限制，`main` 全宽铺满；保留纵向滚动与状态栏预留底部 padding（`pb-16` 量级）。

### 4.3 底部固定状态栏（新增 `StatusBar.vue`）

- `position:fixed; bottom:0; height:32px`，`backdrop-filter:blur(14px)`，半透 `--bg`。
- 左：呼吸同步点（`.dot` `pulse` 2.4s）+ "本地已同步"。
- 中：资产统计 `系统 X · 服务器 X · 中间件 X · 项目 X`（从各 store 取数）。
- 右：`chrome.storage.local` + **实时时钟**（每秒 `tick`）+ `Dock v3.0.0`。

### 4.4 滑动指示条 Tab（NavTabs 重构）

- Tab 数据增补 `path`（如 `dock://systems`）、可选统计副标题来源。
- active Tab 文字转 `--accent`；指示条随激活 Tab 滑动；`resize` 与路由切换时重算位置。

## 5. 公共组件（tokens.css 通用类 + `components/common/*`）

| 现有 | v3 对应 | 改动 |
|---|---|---|
| `.btn-primary` | `.btn-p` | 实心 `--accent` + glow + 内高光；`hover brightness(1.07)`；`active scale(.97)` |
| `.btn-default` | `.btn-g` | 描边 ghost，hover 加深边框/底色 |
| `.btn-danger` | `.btn-d` | 描边红，hover 泛红底 |
| `.btn-ghost` | `.ibtn` | 透明图标钮，hover 浅底；`.danger` 态泛红 |
| `.form-input/.search-input` | `.inp` | focus `0 0 0 3px rgba(46,107,240,.16)`；select 自定义箭头 |
| `EnvBadge.vue` | `.env` | **发光圆点 + 文字**：`::before` 圆点 `box-shadow:0 0 6px currentColor`；生产绿/开发蓝/测试琥珀/预发紫 |
| `.icon-tile` | （彩色 tile） | 保留渐变色板，加**彩色 box-shadow** `0 5px 14px -4px <color>` |
| `Tag/TagPill` | `.chip` | 小圆角描边胶囊 |
| `.row-action` | `.ibtn` | 无边框透明图标钮 |
| —（新增） | `.stat-card` | hover `translateY(-2px)` + 顶部 2px `linear-gradient(accent→accent2)` 高光 |
| —（新增） | `.sw` | 开关组件（设置页主密码） |
| —（新增） | `.seg-btn` | 分段控件（主题 浅色/深色/跟随系统） |
| —（新增） | `.finput` | 行内编辑输入（配置页） |
| Modal/DialogHost | `.modal` | spring 入场 `panelIn/ovIn`，关闭 `panelOut/ovOut`；弹窗内 `.mtab` 子 Tab + 发光下划线 |
| ToastContainer | `.toast-item` | 入场 `toastIn`、退场 `toastOut`；右下角 `z-[80]` |

## 6. 逐视图套用

- **SystemView**：保留现有表格；新增**列表/网格切换**（`.view-btn` 分段，state 持久化到 pref）；网格卡 = `.stat-card` + 彩色图标 + 环境徽章 + 账号数 + hover 操作；空状态用 v3 居中样式（图标 + 引导文案）；多选删除条复用。
- **ServerView / ServerCard**：`.stat-card` + 在线呼吸点（`animate-ping`）+ 琥珀服务器图标 + 详情 `dl`（账号/端口/更新）+ "复制 IP / 复制 SSH" + 末位虚线"添加服务器"卡。
- **MiddlewareView**：`.stat-card` + `MW_TYPES` 配色图标（Redis #DC382D / MySQL #00758F / PostgreSQL #336791 / MongoDB #47A248 / ES #B7791F / RabbitMQ #FF6600 / Kafka #4B5563 / Nginx #009639 / MinIO #C72E49）+ 类型版本徽章 + 连接地址 mono + 复制按钮 + 末位"添加中间件"卡。
- **ConfigView**：沿用现有内联编辑；套 v3 左侧项目列表（选中态 accent 软底 + 发光描边）+ 右侧配置 chip 切换 + 字段表 + "已自动保存"提示气泡。
- **ImportExportView**：双卡（导出范围勾选 / 拖拽 drop-zone 含 dragover 高亮）+ 底部琥珀安全警示条。
- **SettingsView**：分段主题（浅色/深色/跟随系统，对接 prefStore）、自动锁定 select、主密码开关 `.sw`、快捷键 `.kbd` 列表、关于卡 + 清除数据。
- **TagView / OnboardingView**：v3 未画但需保留 → 套同一令牌与 `.panel/.stat-card` 风格，保证不突兀。

## 7. 弹窗 popup（`popup/App.vue` + `popup/styles/popup.css` + `popup.html`）

- 头部：`D` logo + "全部系统" + 计数 + "新增/面板"按钮。
- 搜索：`fa-terminal` 图标 + `Ctrl K` 键位提示；focus 辉光圈。
- 列表项 `.popup-item`：彩色图标 + 名称 + 星标 + mono URL + hover 显出操作（复制账号/打开）+ 环境徽章；分组"常用/全部系统"。
- 底部：呼吸同步点 + 计数 + "管理控制台"链接。
- 弹窗本体毛玻璃 `backdrop-filter:blur(16px)` + spring 入场 `popOpen`。
- 尺寸按 v3 `378×560`：更新 `popup.html` 的 `html,body{width/height}`；保持 ≤800px 扩展限制。

## 8. 动画体系

统一收敛到令牌过渡曲线：
- 入场 `rise` + 延迟 `d1/.05s d2/.12s d3/.19s`
- Tab 指示条滑动 `cubic-bezier(.3,1.1,.4,1)`
- Modal spring `cubic-bezier(.3,1.3,.45,1)`
- Toast 入退场
- 状态点/在线点 `pulse 2.4s`

## 9. 改动边界

### 9.1 不改动
- `src/shared/**`（types / db / repositories / services / stores / crypto / utils）
- `src/background/**`、`src/content/**`
- Vue Router 结构、Pinia 业务逻辑、Dexie schema
- `manifest.config.ts` 权限（仅 popup 默认尺寸若调整则同步入口 HTML）

### 9.2 改动
- `src/dashboard/styles/tokens.css`（令牌 + 通用类 + 背景 + 暗色）
- `src/popup/styles/popup.css`
- `src/dashboard/App.vue`、`components/layout/{PageHeader,NavTabs}.vue`、新增 `components/layout/StatusBar.vue`
- `src/dashboard/views/*.vue`、`src/dashboard/components/**/*.vue`（模板 + `<style>`）
- `src/popup/App.vue`、`src/popup/components/**/*.vue`
- `dashboard.html`、`popup.html`（字体栈、popup 尺寸）

## 10. 风险与注意事项

1. **未集成 Tailwind**：v3 大量使用 Tailwind 工具类。翻译为等价 CSS 变量/语义类，保留现有 `.btn-*`/`.form-input` 命名仅换视觉，**不引入 Tailwind**，避免破坏 vite/crxjs 构建。
2. **滑动指示条**：需在路由切换、窗口 resize、Tab 横向滚动后重算 `#tab-ink` 的 `left/width`；用 `ResizeObserver` + 路由 `afterEach` 兜底。
3. **状态栏时钟**：用 `setInterval`，组件卸载时 `clearInterval`；避免在 popup 内重复创建。
4. **popup 尺寸**：宽度 378 / 高度 560，确认各浏览器扩展弹窗最大尺寸限制（Chrome 单边 ≤800px，满足）。
5. **暗色覆盖面**：确保所有新增类（`.stat-card/.sw/.seg-btn/.finput/状态栏/网格底纹`）都有暗色分支。
6. **回归**：保持功能不变；现有单测（vitest）应继续通过；视觉变更不引入类型错误（`vue-tsc --noEmit`）。

## 11. 验收标准

- dashboard 与 popup 视觉与 v3 原型观感一致（配色、网格底纹、辉光、滑动指示条、状态栏、卡片风格、环境徽章发光点、动画）。
- 亮/暗双主题均正确。
- 全部既有功能可正常使用（增删改查、复制、导入导出、加解密、标签、引导）。
- `npm run build`（含 `vue-tsc --noEmit`）与 `npm run test:unit` 通过。
