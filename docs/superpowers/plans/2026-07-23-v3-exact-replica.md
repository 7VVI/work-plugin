# v3 精确复刻实施计划（Exact Replica）

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** 让插件 UI/交互 100% 复刻 `v3/` 原型（弹窗、布局、功能效果一模一样），含简化（移除 v3 没有的功能/视图）。

**核心原则（给每个实施者）：** 打开 `v3/dashboard.html` 与 `v3/popup.html`，把指定段落的 HTML 结构 + CSS + 交互**照搬**进对应 Vue 组件，并接到现有 store/service。**不要"适配"现有组件结构——替换它以匹配 v3。** v3 是唯一真相源。

**Tech Stack:** Vue 3 + Pinia + Vue Router + Dexie + CRXJS。已有 v3 令牌/外壳（前一轮已合并到 main）。

## Global Constraints

- **v3 是真相源**：结构/字段/类名/动画/文案逐字照搬 `v3/dashboard.html`、`v3/popup.html`。实施者必须先读对应 v3 段落。
- **含简化**：v3 没有的功能/视图一律移除（标签 TagView、引导 OnboardingView、设置页的完整加解密管理、IO 的 markdown/合并替换/预览、服务器卡的复制密码）。底层 service 代码保留但不再有 UI。
- **接现有数据层**：弹窗/视图接到现有 store（systemStore/serverStore/middlewareStore/configStore）与 service，保持真实增删改查可用。
- **不改**：`src/shared/**` 业务逻辑、background、content、manifest 权限、Dexie schema。
- **验证**：`npm run type-check && npm run build && npm run test:unit` 必须全绿；`npm run lint` 无新错。
- **提交**：每任务结束提交；只 `git add` 本任务路径（仓库有两处无关的未提交删除，勿扫入；勿 `git add -A`）。

## v3 源码段落索引（dashboard.html 行号）

- 顶栏+Tab：172-196；状态栏：378-386
- 系统区(表格/网格)：201-234 + 渲染 683-756
- 服务器区：236-247 + 渲染 896-935
- 中间件区：249-260 + 渲染 953-987
- 配置区：262-284 + 渲染 1006-1211
- 导入导出：286-317
- 设置：319-375
- **系统弹窗**：388-454（基本信息/账号密码/备注 三 Tab）
- **服务器弹窗**：457-492
- **中间件弹窗**：495-540
- Toast/复制/主题等 JS：545-1290

popup.html：120-150（弹窗结构）、159-268（交互 JS）。

---

## Task 1: 导航对齐 v3（6 Tab，移除标签/引导）

**Files:** `src/dashboard/components/layout/NavTabs.vue`、`src/dashboard/router.ts`、`src/dashboard/utils/dockPath.ts`
- v3 Tab 顺序：系统/服务器/中间件/配置/导入/导出/设置（6 个，无"标签""引导"）。
- 从 NavTabs 的 tabs 数组移除 `/tags`；router 移除 tags/onboarding 路由（或保留文件但不在导航露出——优先移除路由）。
- dockPath 的 PATH_MAP 已有 /tags→dock://tags；移除该条（对齐 v3 的 6 项）。
- 验证：`npm run type-check && npm run build && npm run test:unit` 全绿。
- 提交：`feat(ui): align nav to v3 (6 tabs, drop tags/onboarding)`。

## Task 2: 系统弹窗按 v3 精确重建

**Files:** `src/dashboard/components/system/SystemForm.vue`（重建内部结构）
- **先读 v3/dashboard.html 388-454 + 相关 JS（颜色/图标/标签/账号行 780-891）**，照搬：
  - 弹窗标题"新增系统/编辑系统" + 关闭钮。
  - `.mtab` 三 Tab：基本信息 / 账号密码(N) / 备注。
  - 基本：系统名称*、系统地址*（+粘贴钮）、环境分类(select 开发/测试/预发/生产)、颜色(QUICK_COLORS 圆点选择)、图标(QUICK_ICONS 网格选择)、标签(chip 输入，回车添加)。
  - 账号密码：表头(角色/用户名/密码/操作) + 账号行(role/user/pwd+显隐/删除) + "添加账号"虚线钮。
  - 备注：textarea。
  - 底部：取消 / 保存。
- 接到 systemStore（保存）+ accountService（账号）。保存后 toast + 关闭 + 刷新列表。
- 用现有 `Modal.vue`（已是 v3 spring）承载，内部模板照搬 v3。
- 验证 + 提交 `feat(ui): rebuild system modal to v3 exact (3-tab, pickers, account rows)`。

## Task 3: 服务器 + 中间件弹窗按 v3 精确重建

**Files:** `src/dashboard/components/server/ServerForm.vue`、`src/dashboard/components/middleware/MiddlewareForm.vue`
- **读 v3 457-492（服务器）与 495-540（中间件）**，照搬字段布局：
  - 服务器：名称*、IP*、SSH端口(22)、账号、密码(+显隐)、SSH Key(textarea)、环境、用途、备注。
  - 中间件：类型*(select，按 MW_TYPES)、名称*、版本、环境、Host*、端口(按类型默认)、数据库、DB Index、账号、密码(+显隐)、额外参数、备注。
- 接 serverStore / middlewareStore 保存。
- 验证 + 提交 `feat(ui): rebuild server & middleware modals to v3 exact`。

## Task 4: 设置页按 v3 精确重建（含简化）

**Files:** `src/dashboard/views/SettingsView.vue`
- **读 v3 319-375**，照搬四块卡片：
  - 外观：主题分段（浅色/深色/跟随系统）→ 需支持 `system`（见 R8）；接 prefStore。
  - 安全：自动锁定(select 从不/5分/15分/1时) + 主密码开关(`.sw`，视觉切换+toast，**不接真实加解密**——v3 即视觉)。
  - 快捷键：`.kbd` 列表（Ctrl+K / Esc / ↑↓ / Enter）。
  - 关于：D logo + "Dock for Chrome" + mono `v3.0.0 · Manifest V3` + "清除所有数据"钮（接 importExportService.clearAll，保留二次确认）。
- **移除**原完整加解密管理区（setup/unlock/lock/change/disable）、默认环境/popup布局 select。
- 验证 + 提交 `feat(ui): rebuild settings to v3 exact (segmented theme, master-pwd toggle, shortcuts, about)`。

## Task 5: 导入导出按 v3 精确重建（含简化）

**Files:** `src/dashboard/views/ImportExportView.vue`
- **读 v3 286-317 + 导出 JS 1216-1229 + 导入 JS 1230-1255**，照搬：
  - 导出卡：图标 + "导出数据" + 说明 + 范围勾选(系统含账号密码/服务器/中间件/配置) + "导出 JSON"钮。
  - 导入卡：图标 + "导入数据" + 说明 + 拖拽 drop-zone（dragover 高亮、drop 选文件）+ 隐藏 file input。
  - 底部琥珀警示条（明文账号密码警告）。
  - 导出：按勾选范围从各 store 收集数据 → JSON 下载（文件名 `dock-backup-YYYY-MM-DD.json`）。
  - 导入：读 JSON → 写回各 store；保留 v3 的"清除/覆盖"语义即可（不需要 merge/replace 选择）。
- **移除** markdown 导出、合并/替换模式、预览、摘要。
- 验证 + 提交 `feat(ui): rebuild import/export to v3 exact (scope export, drop-zone)`。

## Task 6: popup 按 v3 精确复刻

**Files:** `src/popup/components/FavoriteGrid.vue`（+ 必要的 SearchBox/App）
- **读 v3/popup.html 120-268**，照搬列表项与交互：
  - `.popup-item`：彩色图标(system.iconColor 或 hash 调色板 + 彩色 box-shadow) + 名称 + 星标 + mono URL + hover 显出操作(复制账号 username / 打开) + 环境徽章。
  - 分组："常用"(starred) / "全部系统"，分组小标题（`tracking-widest t3`）。
  - 空状态：图标 + "未找到匹配的系统" + "清除搜索"。
  - 键盘：↑↓ 选择、Enter 打开、Esc 清空（沿用现有逻辑，对齐 v3 行为）。
  - footer：呼吸同步点 + 计数 + "管理控制台"。
- 复制账号 = 复制 username（明文，不需解密；v3 即如此）。
- 验证 + 提交 `feat(ui): replicate v3 popup list (copy-account, grouping, empty state)`。

## Task 7: 卡片视图按 v3 精确对齐

**Files:** `src/dashboard/views/SystemView.vue`、`ServerView.vue`、`components/server/ServerCard.vue`、`MiddlewareView.vue`
- **系统**（读 v3 201-234 + 683-748）：表格列对齐 v3（复选框/名称+icon+tags/URL+复制/环境/账号数/最近更新/操作）；网格卡对齐 v3；"删除选中"条；空状态。
- **服务器**（读 v3 236-247 + 896-935）：卡 = 状态呼吸点 + 琥珀图标 + 名称 + ip:port mono + 环境+用途 chip + dl(账号/SSH端口/更新) + 复制IP/复制SSH + 末位"添加服务器"虚线卡。**移除之前加的"复制密码"钮**（v3 没有）。
- **中间件**（读 v3 249-260 + 953-987）：卡 = 类型配色图标 + 名称 + 类型版本 chip + host:port mono + dl(账号/更新) + 复制连接地址 + 末位"添加中间件"虚线卡。**移除"复制密码"钮**（v3 没有）。
- 验证 + 提交 `feat(ui): align system/server/middleware cards to v3 exact`。

## Task 8: 主题"跟随系统" + 终验

**Files:** `src/shared/stores/prefStore.ts`（仅扩展 theme 类型）、`src/dashboard/App.vue`、`src/popup/App.vue`、`dashboard.html`
- prefStore.theme 扩展为 `'light'|'dark'|'system'`；App.vue applyTheme 在 `system` 时按 `matchMedia('(prefers-color-scheme: dark)')` 决定；监听系统主题变化。
- 设置页分段三态生效。
- dashboard.html 字体已是 v3（前一轮已改）；确认 popup.html 字体/尺寸(378×560) 正确。
- 全量验证：`npm run type-check && npm run build && npm run test:unit && npm run lint`；出 `dist/`。
- 提交 `feat(ui): system-theme support; finalize v3 exact replica`。

---

## Self-Review

- v3 每个段落都能指到一个任务：弹窗(R2/R3)、设置(R4)、IO(R5)、popup(R6)、卡片(R7)、导航(R1)、主题(R8)。
- 含简化已明确：移除标签/引导/加解密管理/markdown/合并替换/复制密码。
- 接现有 store/service，数据流不断。
