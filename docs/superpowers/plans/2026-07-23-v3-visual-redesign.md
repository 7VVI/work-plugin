# v3 视觉重设计（Light Lab）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有 Vue 3 扩展（dashboard + popup）的视觉系统、布局与交互对齐 `v3/` 原型的 "Light Lab" 设计语言，保留全部既有功能与数据层。

**Architecture:** 令牌优先、自底向上：先重写 `tokens.css` / `popup.css`（配色 + 网格底纹 + 辉光 + 暗色 + 组件类），再补两个纯逻辑工具（时钟、dock 路径，TDD），再重做外壳（合并顶栏 / 滑动发光 Tab / 状态栏 / 面包屑），再逐视图套用 v3 卡片与表单风格，最后重做 popup。**不引入 Tailwind**，把 v3 的工具类语义翻译成等价 CSS 变量/类。

**Tech Stack:** Vue 3 + Pinia + Vue Router + Dexie + CRXJS + Vite + TypeScript + vitest（jsdom）+ Font Awesome 6（已通过 CDN 在 HTML 引入）。

## Global Constraints

- **配色（亮色默认，逐字复制自 spec §3.1）**：`--accent:#2E6BF0`、`--accent2:#0891B2`、`--glow:rgba(46,107,240,.25)`、`--bg:#F3F6FB`、`--bg2:#EBF0F8`、`--panel:#FFFFFF`、`--panel2:#F4F7FC`、`--border:#E1E8F2`、`--border2:#C6D2E4`、`--ink:#0F1726`、`--ink2:#4E5D75`、`--ink3:#8593A9`、`--grid-line:rgba(46,107,240,.055)`；语义 `--ok:#059669`、`--warn:#B45309`、`--danger:#DC2626`、`--info:#2563EB`。
- **暗色（`[data-theme="dark"]`）**：`--bg:#060A11`、面板 `rgba(148,178,255,.05/.09)`、`--accent:#3D7FFF`、`--accent2:#22D3EE`、`--ink:#E9EEF8`、`--ink2:#93A1B8`、`--ink3:#56657D`。
- **字体栈**：`--font-sans:"Amazon Ember","Noto Sans SC",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;` `--font-mono:"JetBrains Mono","SF Mono",Consolas,monospace;`（Amazon Ember 多数未安装，回退到 Noto Sans SC，可接受）。
- **不引入 Tailwind**：v3 工具类翻译为等价 CSS；保留现有 `.btn-*`/`.form-input`/`.search-input`/`.icon-tile`/`.row-action` 命名，仅换视觉，并新增 v3 别名类 `.panel/.stat-card/.chip/.ibtn/.env*/.sw/.seg-btn/.finput/.mtab`。
- **兼容别名**：旧变量名（`--primary`/`--text-primary`/`--card-bg`/`--surface*`/`--border*` 等）必须继续存在并指向新值，避免散落引用断裂。
- **不动**：`src/shared/**`（types/db/repositories/services/stores/crypto/utils 既有文件）、`src/background/**`、`src/content/**`、Vue Router 结构、Dexie schema、`manifest.config.ts` 权限。仅允许新增 `src/shared/utils/clock.ts` 与 `src/dashboard/utils/dockPath.ts` 两个纯工具。
- **验证命令**：类型 `npm run type-check`；构建 `npm run build`（含 vue-tsc）；单测 `npm run test:unit`；lint `npm run lint`。视觉任务的"测试循环"= type-check + build + test:unit 全绿 + 渲染清单（见各任务）。
- **提交**：每个任务结束提交一次；执行前先开分支 `feat/v3-light-lab`（当前在 main）。
- **v3 源参考**：所有 v3 视觉值取自 `v3/dashboard.html`、`v3/popup.html` 的 `<style>` 段，实施时可直接对照。

---

## File Structure

**新增文件**
- `src/shared/utils/clock.ts` — 时钟格式化纯函数（`formatClockHHMMSS`）。
- `tests/unit/utils/clock.test.ts` — clock 工具单测。
- `src/dashboard/utils/dockPath.ts` — 路由 → `dock://path` 与副标题映射。
- `tests/unit/utils/dockPath.test.ts` — dockPath 单测。
- `src/dashboard/components/layout/StatusBar.vue` — 底部状态栏（时钟 + 同步点 + 统计）。

**重写文件（完整替换内容）**
- `src/dashboard/styles/tokens.css` — 令牌 + 背景 + 组件类 + 暗色。
- `src/popup/styles/popup.css` — popup 令牌 + 背景 + 毛玻璃。

**修改文件**
- `dashboard.html`、`popup.html` — 字体栈、popup 尺寸 378×560。
- `src/dashboard/App.vue`、`components/layout/PageHeader.vue`、`components/layout/NavTabs.vue` — 外壳。
- `components/common/{Tag,Modal,ToastContainer,DialogHost}.vue` — 公共组件。
- `views/{SystemView,ServerView,MiddlewareView,ConfigView,ImportExportView,SettingsView,TagView,OnboardingView}.vue`、`components/{server/ServerCard,server/ServerForm,system/SystemForm,system/AccountFormModal,system/AccountList,middleware/MiddlewareForm}.vue` — 视图与表单。
- `src/popup/App.vue`、`src/popup/components/{SearchBox,FavoriteGrid,QuickAdd}.vue` — 弹窗。

**职责边界**：tokens.css 是唯一的全局样式真相源（dashboard）；popup.css 是 popup 的等价镜像。视图组件只消费令牌与语义类，不硬编码颜色（彩色图标 tile 除外，按数据着色）。

---

## Task 0: 建分支

**Files:** —
- [ ] **Step 1: 从 main 建分支**
```bash
git checkout main
git checkout -b feat/v3-light-lab
```
- [ ] **Step 2: 确认 spec 文件已纳入版本控制**
```bash
git add docs/superpowers/specs/2026-07-23-v3-visual-redesign-design.md docs/superpowers/plans/2026-07-23-v3-visual-redesign.md
git commit -m "docs: v3 visual redesign spec and plan"
```

---

## Task 1: 重写 dashboard 令牌与全局样式（tokens.css）

**Files:**
- Modify (整体替换): `src/dashboard/styles/tokens.css`

**Interfaces:**
- Produces: 全局 CSS 变量（旧名别名 + v3 新名）与组件类 `.panel/.stat-card/.chip/.ibtn/.env-*/.sw/.seg-btn/.finput/.mtab/.view-btn/.kbd/.pulse-dot`；`body::before/::after` 网格底纹与辉光；`[data-theme="dark"]` v3 暗色。后续所有视图与组件任务直接消费这些令牌与类。

- [ ] **Step 1: 用以下完整内容替换 `src/dashboard/styles/tokens.css`**

```css
:root {
  /* ============================================================
     字体
     ============================================================ */
  --font-sans: "Amazon Ember", "Noto Sans SC", -apple-system,
    BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif;
  --font-mono: "JetBrains Mono", "SF Mono", Monaco, Consolas, monospace;

  /* 字号 scale */
  --text-xs: 12px;
  --text-sm: 13px;
  --text-base: 14px;
  --text-md: 15px;
  --text-lg: 16px;
  --text-xl: 18px;
  --text-2xl: 20px;
  --text-3xl: 24px;

  /* 字重 */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;

  /* 行高 */
  --leading-tight: 1.3;
  --leading-normal: 1.6;

  /* ============================================================
     背景与表面（v3 Light Lab）
     ============================================================ */
  --bg: #F3F6FB;
  --bg2: #EBF0F8;
  --bg-pure: #FFFFFF;          /* 别名 */
  --panel: #FFFFFF;
  --panel2: #F4F7FC;
  --solid: #FFFFFF;
  --solid2: #F6F8FC;
  --card-bg: #FFFFFF;          /* 别名 */
  --surface: #FFFFFF;          /* 别名 */
  --surface-secondary: #F4F7FC;/* 别名 = panel2 */
  --surface-hover: rgba(46,107,240,.04);
  --surface-active: rgba(46,107,240,.06);
  --accent-s: #F4F7FC;
  --grid-line: rgba(46,107,240,.055);

  /* ============================================================
     主色：v3 accent + 青色副色 + 辉光
     ============================================================ */
  --accent: #2E6BF0;
  --accent2: #0891B2;
  --glow: rgba(46,107,240,.25);
  /* 兼容旧名 → 指向 accent */
  --primary: #2E6BF0;
  --primary-hover: #1D4ED8;
  --primary-active: #1D4ED8;
  --primary-50: rgba(46,107,240,.08);
  --primary-100: rgba(46,107,240,.16);
  --primary-600: #2E6BF0;
  --primary-700: #1D4ED8;
  --primary-soft: rgba(46,107,240,.08);

  /* ============================================================
     文字灰阶（v3 ink）
     ============================================================ */
  --ink: #0F1726;
  --ink2: #4E5D75;
  --ink3: #8593A9;
  /* 兼容旧名 */
  --text-primary: #0F1726;
  --text-secondary: #4E5D75;
  --text-tertiary: #8593A9;
  --text-quaternary: #AEB8C9;

  /* ============================================================
     边框
     ============================================================ */
  --border: #E1E8F2;
  --border-soft: #ECF1F7;      /* 别名，略浅 */
  --border-strong: #C6D2E4;
  --border2: #C6D2E4;          /* v3 名 */

  /* ============================================================
     语义色（v3）
     ============================================================ */
  --success: #059669;
  --success-light: rgba(5,150,105,.10);
  --success-text: #059669;
  --warning: #B45309;
  --warning-light: rgba(180,83,9,.10);
  --warning-text: #B45309;
  --danger: #DC2626;
  --danger-light: rgba(220,38,38,.08);
  --danger-text: #DC2626;
  --info: #2563EB;
  --info-light: rgba(37,99,235,.10);
  --info-text: #2563EB;
  --ok: #059669;               /* v3 别名 */

  /* ============================================================
     环境标签色（发光点徽章）
     ============================================================ */
  --env-dev-bg: rgba(37,99,235,.08);     --env-dev-fg: #2563EB;
  --env-prod-bg: rgba(5,150,105,.08);    --env-prod-fg: #059669;
  --env-test-bg: rgba(180,83,9,.08);     --env-test-fg: #B45309;
  --env-staging-bg: rgba(124,58,237,.07);--env-staging-fg: #7C3AED;

  /* ============================================================
     布局
     ============================================================ */
  --header-h: 56px;
  --tabs-h: 48px;
  --sidebar-w: 0px;
  --header-bg: color-mix(in srgb, var(--bg) 82%, transparent);
  --table-header-h: 44px;
  --table-row-h: 64px;
  --statusbar-h: 32px;

  /* ============================================================
     圆角
     ============================================================ */
  --radius-xs: 6px;
  --radius-sm: 8px;
  --radius-md: 10px;
  --radius-lg: 12px;
  --radius-xl: 14px;
  --radius-2xl: 16px;
  --radius-pill: 9999px;

  /* ============================================================
     阴影（v3 辉光体系）
     ============================================================ */
  --shadow-xs: 0 1px 2px rgba(15,23,38,.03);
  --shadow-sm: 0 1px 3px rgba(15,23,38,.04);
  --shadow-md: 0 6px 20px -10px rgba(15,23,38,.14);
  --shadow-lg: 0 16px 44px -16px rgba(15,23,38,.18);
  --shadow-xl: 0 24px 70px -16px rgba(15,23,38,.3);
  --shadow-focus: 0 0 0 3px rgba(46,107,240,.16);
  --shadow-primary: 0 4px 14px -4px var(--glow);

  /* ============================================================
     过渡
     ============================================================ */
  --transition-fast: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  --transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-smooth: all 0.3s cubic-bezier(0.3, 1.1, 0.4, 1);

  /* ============================================================
     间距 scale
     ============================================================ */
  --page-pad: 24px;
  --gap-xs: 4px;
  --gap-sm: 8px;
  --gap-md: 12px;
  --gap-lg: 16px;
  --gap-xl: 24px;
  --gap-2xl: 32px;

  /* 控件高度 */
  --control-h-sm: 32px;
  --control-h: 38px;
  --control-h-lg: 44px;

  /* z-index */
  --z-sticky: 100;
  --z-dropdown: 1000;
  --z-toast: 9000;
  --z-modal-overlay: 9999;
  --z-modal: 10000;
  --z-modal-top: 10001;
  --z-dialog-host: 10002;
}

/* ============================================================
   基础重置 + v3 网格底纹 / 辉光
   ============================================================ */
*, *::before, *::after { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: var(--font-sans);
  background: var(--bg);
  color: var(--ink);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  overflow-x: hidden;
}

/* 40px 网格纹理 */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image:
    linear-gradient(var(--grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
  background-size: 40px 40px;
  -webkit-mask-image: radial-gradient(ellipse 100% 70% at 50% 0%, #000 25%, transparent 100%);
  mask-image: radial-gradient(ellipse 100% 70% at 50% 0%, #000 25%, transparent 100%);
}
/* 顶部蓝/青径向辉光 */
body::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(720px 300px at 18% -8%, rgba(46,107,240,.10), transparent 65%),
    radial-gradient(620px 300px at 88% -8%, rgba(8,145,178,.07), transparent 65%);
}

button { font-family: inherit; }
input, select, textarea { font-family: inherit; }

a { color: var(--accent); text-decoration: none; transition: var(--transition-fast); }
a:hover { color: var(--primary-hover); }

.mono, code, kbd, samp, pre { font-family: var(--font-mono); }
.t1 { color: var(--ink); } .t2 { color: var(--ink2); } .t3 { color: var(--ink3); }

/* ============================================================
   面板 / 卡片
   ============================================================ */
.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xs);
}
.panel-solid {
  background: var(--solid);
  border: 1px solid var(--border);
  border-radius: var(--radius-2xl);
}
.stat-card {
  position: relative;
  overflow: hidden;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xs);
  transition: transform .2s, box-shadow .2s, border-color .2s;
}
.stat-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--accent), var(--accent2), transparent 80%);
  opacity: 0;
  transition: opacity .25s;
}
.stat-card:hover {
  transform: translateY(-2px);
  border-color: var(--border-strong);
  box-shadow: var(--shadow-md);
}
.stat-card:hover::before { opacity: 1; }

/* ============================================================
   通用按钮 — 统一 38px 高（v3 风格）
   ============================================================ */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--gap-sm);
  height: var(--control-h);
  padding: 0 var(--gap-lg);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: var(--transition);
  border: 1px solid transparent;
  background: transparent;
  white-space: nowrap;
  user-select: none;
  line-height: 1;
}
.btn:active { transform: scale(.97); }
.btn:disabled { opacity: .4; cursor: not-allowed; }
.btn i { font-size: var(--text-xs); }

.btn-primary {
  background: var(--accent);
  color: #fff;
  box-shadow: var(--shadow-primary), inset 0 1px 0 rgba(255,255,255,.2);
}
.btn-primary:hover { filter: brightness(1.07); box-shadow: 0 6px 20px -4px var(--glow), inset 0 1px 0 rgba(255,255,255,.2); }
.btn-primary:active { background: var(--primary-active); }

.btn-default {
  background: var(--panel);
  color: var(--ink2);
  border-color: var(--border);
}
.btn-default:hover { border-color: var(--border-strong); color: var(--ink); background: var(--panel2); }

.btn-danger {
  background: var(--panel);
  color: var(--danger);
  border-color: rgba(220,38,38,.3);
}
.btn-danger:hover { background: rgba(220,38,38,.06); }
.btn-danger:disabled { opacity: .35; }

.btn-ghost { background: transparent; color: var(--ink2); }
.btn-ghost:hover { background: var(--panel2); color: var(--ink); }

.btn-link { background: transparent; color: var(--accent); padding: 0 var(--gap-sm); height: auto; }
.btn-link:hover { color: var(--primary-hover); background: var(--primary-50); }

/* 兼容旧名 */
.btn-dark { background: var(--accent); color: #fff; box-shadow: var(--shadow-primary); }
.btn-dark:hover { background: var(--primary-hover); filter: brightness(1.07); }

/* 图标钮（v3 .ibtn） */
.ibtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  color: var(--ink3);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: var(--transition-fast);
}
.ibtn:hover { background: var(--panel2); color: var(--ink); }
.ibtn.danger:hover { background: rgba(220,38,38,.08); color: var(--danger); }
.ibtn i { font-size: var(--text-xs); }

/* ============================================================
   通用搜索框 / 表单输入（v3 .inp）
   ============================================================ */
.search-wrap { position: relative; display: inline-flex; align-items: center; }
.search-wrap > i {
  position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
  color: var(--ink3); font-size: var(--text-xs); pointer-events: none; transition: var(--transition-fast);
}
.search-input {
  height: var(--control-h); width: 100%;
  border: 1px solid var(--border); border-radius: var(--radius-md);
  padding: 0 14px 0 34px; font-size: var(--text-sm);
  background: var(--panel2); outline: none; color: var(--ink); transition: var(--transition);
}
.search-input::placeholder { color: var(--ink3); }
.search-input:hover { border-color: var(--border-strong); }
.search-input:focus { border-color: var(--accent); background: #fff; box-shadow: var(--shadow-focus); }
.search-wrap:has(.search-input:focus) > i { color: var(--accent); }

.form-input, .form-select, .form-textarea {
  width: 100%; height: var(--control-h);
  border: 1px solid var(--border); border-radius: var(--radius-md);
  padding: 0 var(--gap-md); font-size: var(--text-sm);
  background: var(--panel); outline: none; color: var(--ink); transition: var(--transition);
  font-family: inherit;
}
.form-input::placeholder, .form-textarea::placeholder { color: var(--ink3); }
.form-input:hover, .form-select:hover, .form-textarea:hover { border-color: var(--border-strong); }
.form-input:focus, .form-select:focus, .form-textarea:focus { border-color: var(--accent); box-shadow: var(--shadow-focus); }
.form-textarea { height: auto; padding: 10px var(--gap-md); resize: vertical; min-height: 80px; line-height: var(--leading-normal); }
.form-select {
  appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%238593A9' fill='none' stroke-width='1.5' stroke-linecap='round'/></svg>");
  background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px; cursor: pointer;
}

/* 行内编辑输入（v3 .finput） */
.finput {
  width: 100%; background: transparent;
  border: 1px solid transparent; border-radius: 7px;
  padding: 5px 9px; font-size: 12.5px; color: var(--ink); outline: none; transition: .13s;
}
.finput:hover { border-color: var(--border); }
.finput:focus { border-color: var(--accent); background: var(--panel); box-shadow: 0 0 0 3px rgba(46,107,240,.12); }
.finput::placeholder { color: var(--ink3); }

/* ============================================================
   图标 tile（第一列 / 卡片图标，支持彩色辉光）
   ============================================================ */
.icon-tile {
  width: 40px; height: 40px; border-radius: var(--radius-md);
  display: inline-flex; align-items: center; justify-content: center;
  color: #fff; flex-shrink: 0;
  background: linear-gradient(135deg, var(--accent), var(--primary-hover));
  box-shadow: 0 5px 14px -4px var(--glow);
}
.icon-tile i { font-size: var(--text-base); }
/* 通过 --tile-color 自定义彩色辉光 */
.icon-tile[style*="--tile-color"], .icon-tile.colored {
  background: var(--tile-color, var(--accent));
  box-shadow: 0 5px 14px -4px var(--tile-color, var(--glow));
}

/* ============================================================
   URL 链接 / 行内操作 / checkbox
   ============================================================ */
.url-link {
  display: inline-flex; align-items: center; gap: 6px;
  color: var(--ink2); font-size: var(--text-xs); cursor: pointer;
  transition: var(--transition-fast); text-decoration: none;
}
.url-link i { font-size: 11px; opacity: .6; color: var(--ink3); }
.url-link:hover { color: var(--accent); }
.url-link:hover i { color: var(--accent); opacity: 1; }

.row-action {
  width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center;
  border-radius: var(--radius-sm); background: transparent; border: none;
  color: var(--ink3); cursor: pointer; transition: var(--transition-fast); flex-shrink: 0;
}
.row-action i { font-size: var(--text-xs); }
.row-action:hover { background: var(--panel2); color: var(--ink); }
.row-action.edit:hover { color: var(--accent); background: var(--primary-50); }
.row-action.danger:hover { color: var(--danger); background: rgba(220,38,38,.08); }
.row-action.success:hover { color: var(--success); background: var(--success-light); }
.row-action-sm { width: 26px; height: 26px; border-radius: 6px; }

input[type="checkbox"].form-check, .form-check {
  appearance: none; width: 16px; height: 16px;
  border: 1.5px solid var(--border-strong); border-radius: 4px;
  background: var(--panel); cursor: pointer; transition: var(--transition-fast);
  position: relative; flex-shrink: 0; margin: 0;
  accent-color: var(--accent);
}
input[type="checkbox"].form-check:hover { border-color: var(--accent); background: var(--primary-50); }
input[type="checkbox"].form-check:checked { background: var(--accent); border-color: var(--accent); }
input[type="checkbox"].form-check:checked::after {
  content: ''; position: absolute; left: 4.5px; top: 1.5px;
  width: 4.5px; height: 8.5px; border: solid #fff; border-width: 0 1.5px 1.5px 0; transform: rotate(45deg);
}

/* ============================================================
   小标签 chip / 键位 kbd
   ============================================================ */
.chip {
  display: inline-flex; align-items: center; gap: 4px;
  border-radius: 6px; background: var(--panel2);
  border: 1px solid var(--border); padding: 2px 7px;
  font-size: 10.5px; font-weight: var(--font-medium); color: var(--ink2);
  line-height: 1.4;
}
.kbd {
  display: inline-flex; align-items: center;
  border: 1px solid var(--border); border-bottom-width: 2px; border-radius: 5px;
  background: var(--panel2); padding: 2px 5px;
  font-family: var(--font-mono); font-size: 10px; font-weight: var(--font-medium); color: var(--ink3);
}

/* ============================================================
   分段控件 / 视图切换 / 开关
   ============================================================ */
.seg-group {
  display: inline-flex; align-items: center; gap: 2px;
  border: 1px solid var(--border); background: var(--bg2);
  border-radius: var(--radius-md); padding: 2px;
}
.seg-btn {
  border-radius: var(--radius-sm); padding: 6px 13px; font-size: 12px;
  color: var(--ink3); cursor: pointer; transition: var(--transition-fast);
  border: none; background: transparent;
}
.seg-btn:hover { color: var(--ink); }
.seg-btn.on { background: var(--panel); color: var(--accent); box-shadow: 0 0 0 1px var(--border), 0 2px 8px -2px rgba(15,23,38,.08); }

.view-btn {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 26px; border-radius: 7px;
  color: var(--ink3); cursor: pointer; transition: var(--transition-fast);
  border: none; background: transparent;
}
.view-btn:hover { color: var(--ink); }
.view-btn.active { background: var(--panel); color: var(--accent); box-shadow: 0 0 0 1px var(--border), 0 2px 8px -2px rgba(15,23,38,.1); }

.sw {
  width: 38px; height: 21px; border-radius: 999px;
  background: var(--bg2); border: 1px solid var(--border);
  position: relative; transition: .2s; cursor: pointer; flex: none;
}
.sw::after {
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 15px; height: 15px; border-radius: 50%; background: #fff;
  box-shadow: 0 1px 3px rgba(15,23,38,.25); transition: .2s;
}
.sw.on { background: var(--accent); border-color: var(--accent); }
.sw.on::after { transform: translateX(17px); background: #fff; }

/* ============================================================
   弹窗内子 Tab（v3 .mtab）
   ============================================================ */
.mtab {
  position: relative; padding: 12px var(--gap-lg);
  font-size: var(--text-sm); font-weight: var(--font-medium);
  color: var(--ink3); cursor: pointer; transition: var(--transition-fast);
  background: none; border: none;
}
.mtab:hover { color: var(--ink); }
.mtab.active { color: var(--accent); }
.mtab::after { content: ''; position: absolute; left: var(--gap-lg); right: var(--gap-lg); bottom: -1px; height: 2px; border-radius: 2px; background: transparent; }
.mtab.active::after { background: var(--accent); box-shadow: 0 0 8px var(--glow); }

/* ============================================================
   呼吸点 / 入场动画
   ============================================================ */
.pulse-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ok); box-shadow: 0 0 8px var(--ok); animation: pulse 2.4s infinite; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
.rise { animation: rise .5s cubic-bezier(.2,.9,.3,1) both; }
@keyframes rise { from { opacity: 0; transform: translateY(14px); } }
.d1 { animation-delay: .05s; } .d2 { animation-delay: .12s; } .d3 { animation-delay: .19s; }

/* ============================================================
   滚动条 / 选区
   ============================================================ */
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: #C4CEDE; border-radius: 8px;
  border: 3px solid transparent; background-clip: content-box;
}
::-webkit-scrollbar-thumb:hover { background: #AEBBD0; background-clip: content-box; }
::selection { background: var(--primary-100); color: var(--ink); }

/* ============================================================
   深色主题（v3）
   ============================================================ */
[data-theme="dark"] {
  --bg: #060A11;
  --bg2: #0A0F19;
  --bg-pure: #0C1322;
  --panel: rgba(148,178,255,.05);
  --panel2: rgba(148,178,255,.09);
  --solid: #0C1322;
  --solid2: #111A2C;
  --card-bg: #0C1322;
  --surface: #0C1322;
  --surface-secondary: rgba(148,178,255,.09);
  --surface-hover: rgba(148,178,255,.08);
  --surface-active: rgba(148,178,255,.12);
  --accent-s: #111A2C;
  --grid-line: rgba(148,178,255,.05);

  --accent: #3D7FFF;
  --accent2: #22D3EE;
  --glow: rgba(61,127,255,.4);
  --primary: #3D7FFF;
  --primary-hover: #5A8FFF;
  --primary-active: #5A8FFF;
  --primary-50: rgba(61,127,255,.12);
  --primary-100: rgba(61,127,255,.2);
  --primary-600: #3D7FFF;
  --primary-700: #5A8FFF;
  --primary-soft: rgba(61,127,255,.1);

  --ink: #E9EEF8;
  --ink2: #93A1B8;
  --ink3: #56657D;
  --text-primary: #E9EEF8;
  --text-secondary: #93A1B8;
  --text-tertiary: #56657D;
  --text-quaternary: #475569;

  --border: rgba(148,178,255,.13);
  --border-soft: rgba(148,178,255,.1);
  --border-strong: rgba(148,178,255,.24);
  --border2: rgba(148,178,255,.24);

  --success: #34D399;
  --success-light: rgba(52,211,153,.12);
  --success-text: #34D399;
  --warning: #FBBF24;
  --warning-light: rgba(251,191,36,.12);
  --warning-text: #FBBF24;
  --danger: #F87171;
  --danger-light: rgba(248,113,113,.12);
  --danger-text: #F87171;
  --info: #60A5FA;
  --info-light: rgba(96,165,250,.12);
  --info-text: #60A5FA;
  --ok: #34D399;

  --env-dev-bg: rgba(96,165,250,.16);     --env-dev-fg: #93C5FD;
  --env-prod-bg: rgba(52,211,153,.16);    --env-prod-fg: #6EE7B7;
  --env-test-bg: rgba(251,191,36,.16);    --env-test-fg: #FCD34D;
  --env-staging-bg: rgba(167,139,250,.16);--env-staging-fg: #D8B4FE;

  --header-bg: color-mix(in srgb, var(--bg) 82%, transparent);

  --shadow-xs: 0 1px 2px rgba(0,0,0,.3);
  --shadow-sm: 0 1px 3px rgba(0,0,0,.4);
  --shadow-md: 0 6px 20px -10px rgba(0,0,0,.5);
  --shadow-lg: 0 16px 44px -16px rgba(0,0,0,.6);
  --shadow-xl: 0 24px 70px -16px rgba(0,0,0,.7);
  --shadow-focus: 0 0 0 3px rgba(61,127,255,.3);
  --shadow-primary: 0 4px 14px -4px var(--glow);
}

[data-theme="dark"] body::after {
  background:
    radial-gradient(640px 320px at 12% -6%, rgba(61,127,255,.14), transparent 65%),
    radial-gradient(560px 320px at 95% 108%, rgba(34,211,238,.09), transparent 65%);
}
[data-theme="dark"] .panel { box-shadow: none; backdrop-filter: blur(10px); }
[data-theme="dark"] .stat-card { box-shadow: none; backdrop-filter: blur(10px); }
[data-theme="dark"] .sw::after { background: var(--ink3); box-shadow: none; }
[data-theme="dark"] .search-input,
[data-theme="dark"] .form-input,
[data-theme="dark"] .form-select,
[data-theme="dark"] .form-textarea { background: var(--bg2); }
[data-theme="dark"] .seg-btn.on,
[data-theme="dark"] .view-btn.active { background: var(--panel2); }
[data-theme="dark"] ::-webkit-scrollbar-thumb { background: rgba(148,178,255,.18); background-clip: content-box; }
[data-theme="dark"] ::-webkit-scrollbar-thumb:hover { background: rgba(148,178,255,.3); background-clip: content-box; }
[data-theme="dark"] ::selection { background: rgba(61,127,255,.3); }
```

- [ ] **Step 2: 类型检查 + 构建 + 单测全绿**

Run: `npm run type-check && npm run build && npm run test:unit`
Expected: 三者均通过（纯 CSS 改动不应破坏类型/构建/既有行为测试）。

- [ ] **Step 3: 渲染清单（人工）**

`npm run dev` 打开 dashboard：
- [ ] 背景出现 40px 蓝色网格 + 顶部蓝/青辉光。
- [ ] 既有页面无样式塌陷（按钮/输入/表格仍可用，颜色变为 v3 蓝）。
- [ ] 顶部主题钮切换亮/暗，暗色下背景变深、面板半透明。

- [ ] **Step 4: 提交**
```bash
git add src/dashboard/styles/tokens.css
git commit -m "feat(ui): rewrite dashboard tokens to v3 Light Lab system"
```

---

## Task 2: 时钟工具（TDD）

**Files:**
- Create: `src/shared/utils/clock.ts`
- Test: `tests/unit/utils/clock.test.ts`

**Interfaces:**
- Produces: `formatClockHHMMSS(date: Date): string` — 形如 `09:05:03`，两位补零。StatusBar（Task 8）消费它。

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/utils/clock.test.ts`：
```ts
import { describe, it, expect } from 'vitest';
import { formatClockHHMMSS } from '../../../src/shared/utils/clock';

describe('formatClockHHMMSS', () => {
  it('pads hours, minutes, seconds to two digits', () => {
    expect(formatClockHHMMSS(new Date(2026, 0, 1, 9, 5, 3))).toBe('09:05:03');
  });
  it('formats midnight and end-of-day', () => {
    expect(formatClockHHMMSS(new Date(2026, 0, 1, 0, 0, 0))).toBe('00:00:00');
    expect(formatClockHHMMSS(new Date(2026, 0, 1, 23, 59, 59))).toBe('23:59:59');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/unit/utils/clock.test.ts`
Expected: FAIL — `Cannot find module '../../../src/shared/utils/clock'`.

- [ ] **Step 3: 实现**

创建 `src/shared/utils/clock.ts`：
```ts
/**
 * 把 Date 格式化为 HH:MM:SS（24 小时制，两位补零）。
 * 用于状态栏实时时钟。
 */
export function formatClockHHMMSS(date: Date): string {
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/unit/utils/clock.test.ts`
Expected: PASS（2 passed）。

- [ ] **Step 5: 提交**
```bash
git add src/shared/utils/clock.ts tests/unit/utils/clock.test.ts
git commit -m "feat(utils): add formatClockHHMMSS clock formatter"
```

---

## Task 3: dock 路径工具（TDD）

**Files:**
- Create: `src/dashboard/utils/dockPath.ts`
- Test: `tests/unit/utils/dockPath.test.ts`

**Interfaces:**
- Produces:
  - `dockPathFor(routePath: string): string` — 例如 `/systems` → `dock://systems`；未知路由 → `dock://app`。
  - `subtitleFor(routePath: string, stats: { systems: number; servers: number; middlewares: number; projects: number }): string` — 返回 v3 风格副标题。
- NavTabs（Task 10）消费二者。

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/utils/dockPath.test.ts`：
```ts
import { describe, it, expect } from 'vitest';
import { dockPathFor, subtitleFor } from '../../../src/dashboard/utils/dockPath';

describe('dockPathFor', () => {
  it('maps known routes to dock:// paths', () => {
    expect(dockPathFor('/systems')).toBe('dock://systems');
    expect(dockPathFor('/servers')).toBe('dock://servers');
    expect(dockPathFor('/middlewares')).toBe('dock://middleware');
    expect(dockPathFor('/configs')).toBe('dock://configs');
    expect(dockPathFor('/settings')).toBe('dock://settings');
  });
  it('falls back to dock://app for unknown routes', () => {
    expect(dockPathFor('/nope')).toBe('dock://app');
    expect(dockPathFor('')).toBe('dock://app');
  });
});

describe('subtitleFor', () => {
  const stats = { systems: 3, servers: 2, middlewares: 1, projects: 4 };
  it('returns systems subtitle with counts', () => {
    expect(subtitleFor('/systems', stats)).toBe('共 3 个系统');
  });
  it('returns servers subtitle', () => {
    expect(subtitleFor('/servers', stats)).toBe('共 2 台服务器');
  });
  it('returns a generic subtitle for unknown routes', () => {
    expect(subtitleFor('/settings', stats)).toBe('外观 · 安全 · 快捷键 · 关于');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/unit/utils/dockPath.test.ts`
Expected: FAIL — 模块找不到。

- [ ] **Step 3: 实现**

创建 `src/dashboard/utils/dockPath.ts`：
```ts
export interface DockStats {
  systems: number;
  servers: number;
  middlewares: number;
  projects: number;
}

const PATH_MAP: Record<string, string> = {
  '/systems': 'dock://systems',
  '/servers': 'dock://servers',
  '/middlewares': 'dock://middleware',
  '/configs': 'dock://configs',
  '/tags': 'dock://tags',
  '/import-export': 'dock://io',
  '/settings': 'dock://settings',
};

export function dockPathFor(routePath: string): string {
  return PATH_MAP[routePath] ?? 'dock://app';
}

export function subtitleFor(routePath: string, s: DockStats): string {
  switch (routePath) {
    case '/systems': return `共 ${s.systems} 个系统`;
    case '/servers': return `共 ${s.servers} 台服务器`;
    case '/middlewares': return `共 ${s.middlewares} 个实例`;
    case '/configs': return `${s.projects} 个项目`;
    case '/import-export': return 'JSON 备份 · 本地存储';
    case '/settings': return '外观 · 安全 · 快捷键 · 关于';
    default: return '';
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/unit/utils/dockPath.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**
```bash
git add src/dashboard/utils/dockPath.ts tests/unit/utils/dockPath.test.ts
git commit -m "feat(dashboard): add dockPath/subtitle helpers for header breadcrumb"
```

---

## Task 4: 环境徽章发光点（Tag.vue）

**Files:**
- Modify: `src/dashboard/components/common/Tag.vue`（仅 `<style>`）

**Interfaces:**
- Consumes: tokens.css 的 `--env-*-fg/--env-*-bg`（Task 1）。
- Produces: `.tag-env-*` 前置发光圆点；EnvBadge（委托 Tag）与所有用 Tag 的 env 变体自动获得 v3 发光点外观。

- [ ] **Step 1: 在 `Tag.vue` 的 `<style>` 末尾追加（不替换既有规则）发光点样式**

在 `src/dashboard/components/common/Tag.vue` 的 `<style scoped>` 块内，最后一行 `}` 之后追加：
```css
/* v3 环境徽章发光圆点 */
.tag[class*="tag-env-"]::before {
  content: '';
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 6px currentColor;
  flex: none;
}
```

- [ ] **Step 2: 类型检查 + 构建 + 单测**

Run: `npm run type-check && npm run build && npm run test:unit`
Expected: 全绿。

- [ ] **Step 3: 渲染清单**

`npm run dev` → 系统列表：
- [ ] 环境"生产"徽章左侧出现绿色发光小圆点；"开发"蓝、"测试"琥珀、"预发"紫。
- [ ] 圆点带柔和辉光（`box-shadow`）。

- [ ] **Step 4: 提交**
```bash
git add src/dashboard/components/common/Tag.vue
git commit -m "feat(ui): add glowing dot to environment badges"
```

---

## Task 5: Modal 弹簧动画 + Toast v3 风格

**Files:**
- Modify: `src/dashboard/components/common/Modal.vue`（`<style>` 的 transition 段）
- Modify: `src/dashboard/components/common/ToastContainer.vue`（`<style>`）

**Interfaces:**
- Consumes: tokens.css 阴影/辉光变量。
- Produces: Modal spring 入退场（`cubic-bezier(.3,1.3,.45,1)`）；Toast 入场 `toastIn`、右下角带辉光。

- [ ] **Step 1: 替换 `Modal.vue` 的 transition 样式**

在 `src/dashboard/components/common/Modal.vue` 中，找到 `.modal-enter-active` 到 `.modal-leave-to .modal-box { ... }` 整段（约 182–198 行），替换为：
```css
.modal-enter-active { transition: opacity .18s ease; }
.modal-leave-active { transition: opacity .16s ease; }
.modal-enter-active .modal-box { transition: transform .3s cubic-bezier(.3,1.3,.45,1), opacity .3s ease; }
.modal-leave-active .modal-box { transition: transform .16s ease, opacity .16s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .modal-box { transform: translateY(16px) scale(.95); opacity: 0; }
.modal-leave-to .modal-box { transform: translateY(8px) scale(.97); opacity: 0; }
```

并把 `.modal-overlay` 的 `background` 改为 `rgba(15,23,38,.35)`，`backdrop-filter: blur(3px)`；把 `.modal-box` 的 `box-shadow` 改为 `var(--shadow-xl), 0 0 40px -16px var(--glow)`，`border-radius: var(--radius-2xl)`，`border-color: var(--border)`。

- [ ] **Step 2: 替换 `ToastContainer.vue` 的 `.toast` 与 keyframes**

在 `src/dashboard/components/common/ToastContainer.vue` 的 `<style>` 中，把 `.toast` 的 `box-shadow` 改为 `var(--shadow-lg), 0 0 24px -10px var(--glow)`，`border-radius: var(--radius-lg)`；并把 `@keyframes slideIn` 整段替换为：
```css
@keyframes slideIn {
  from { transform: translateY(14px) scale(.95); opacity: 0; }
  to { transform: translateY(0) scale(1); opacity: 1; }
}
```
同时把 `.toast` 的 `animation` 改为 `slideIn .3s cubic-bezier(.3,1.2,.4,1)`。

- [ ] **Step 3: 类型检查 + 构建 + 单测**

Run: `npm run type-check && npm run build && npm run test:unit`
Expected: 全绿。

- [ ] **Step 4: 渲染清单**

- [ ] 任意删除/新增操作弹出 Toast：从下方带轻微缩放上浮、带蓝色辉光。
- [ ] 打开系统表单 Modal：弹窗带轻微过冲的弹簧入场（scale .95→1）、遮罩半透明模糊、关闭回缩。

- [ ] **Step 5: 提交**
```bash
git add src/dashboard/components/common/Modal.vue src/dashboard/components/common/ToastContainer.vue
git commit -m "feat(ui): v3 spring modal and toast animations"
```

---

## Task 6: 状态栏 StatusBar.vue（含实时时钟）

**Files:**
- Create: `src/dashboard/components/layout/StatusBar.vue`

**Interfaces:**
- Consumes: `formatClockHHMMSS`（Task 2）；各 store 的 `list.length`（systems/servers/middlewares/configs）。
- Produces: `<StatusBar />` 组件，App.vue（Task 8）挂载。Props：无；内部读取 store 计数与时钟。

- [ ] **Step 1: 创建组件**

创建 `src/dashboard/components/layout/StatusBar.vue`：
```vue
<template>
  <footer class="statusbar">
    <span class="sb-item"><span class="pulse-dot"></span>本地已同步</span>
    <span class="sb-item sb-stats">{{ statsText }}</span>
    <div class="sb-spacer"></div>
    <span class="sb-item">chrome.storage.local</span>
    <span class="sb-item sb-clock t2">{{ clock }}</span>
    <span class="sb-item sb-ver">Dock v3.0.0</span>
  </footer>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { formatClockHHMMSS } from '@shared/utils/clock';
import { useSystemStore } from '@shared/stores/systemStore';
import { useServerStore } from '@shared/stores/serverStore';
import { useMiddlewareStore } from '@shared/stores/middlewareStore';
import { useConfigStore } from '@shared/stores/configStore';

const systemStore = useSystemStore();
const serverStore = useServerStore();
const middlewareStore = useMiddlewareStore();
const configStore = useConfigStore();

const clock = ref('--:--:--');
let timer: number | undefined;

function tick() {
  clock.value = formatClockHHMMSS(new Date());
}

const statsText = computed(() => {
  const s = systemStore.list?.length ?? 0;
  const sv = serverStore.list?.length ?? 0;
  const mw = middlewareStore.list?.length ?? 0;
  const pj = configStore.projects?.length ?? 0;
  return `系统 ${s} · 服务器 ${sv} · 中间件 ${mw} · 项目 ${pj}`;
});

onMounted(() => {
  tick();
  timer = window.setInterval(tick, 1000);
});
onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer);
});
</script>

<style scoped>
.statusbar {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  height: var(--statusbar-h);
  z-index: var(--z-sticky);
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 0 24px;
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg) 86%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--ink3);
}
.sb-item { display: inline-flex; align-items: center; gap: 6px; }
.sb-stats { color: var(--ink3); }
.sb-spacer { flex: 1; }
.sb-clock { color: var(--ink2); }
.sb-ver { color: var(--accent); }
.pulse-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--ok); box-shadow: 0 0 8px var(--ok);
  animation: pulse 2.4s infinite;
}
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
</style>
```

> **接口契约（供 Task 8 实现者）**：`StatusBar` 无 props、无 emits，直接在 App.vue 末尾 `<StatusBar />` 即可。它自行从 store 取计数；若某 store 的 `list`/`projects` 字段名不同，用可选链 `?.length ?? 0` 兜底（已写），不会报错。

- [ ] **Step 2: 校验 store 字段名**

Run: `npm run type-check`
Expected: 通过。若报错指出某 store 无 `list`/`projects` 字段，改为该 store 实际暴露的数组字段名（用 Grep 确认：`rg "list|projects" src/shared/stores/{server,middleware,config}Store.ts`）。

- [ ] **Step 3: 构建 + 单测**

Run: `npm run build && npm run test:unit`
Expected: 全绿。

- [ ] **Step 4: 提交**
```bash
git add src/dashboard/components/layout/StatusBar.vue
git commit -m "feat(dashboard): add StatusBar with live clock and asset stats"
```

---

## Task 7: 合并顶栏 PageHeader（v3 顶行）

**Files:**
- Modify: `src/dashboard/components/layout/PageHeader.vue`

**Interfaces:**
- Consumes: prefStore（theme）；tokens.css。
- Produces: 单行顶栏：`D` logo + "Dock" + "控制台"徽章 + 右侧主题钮 + 头像。移除独立"设置"齿轮（设置入口在 Tab）。

- [ ] **Step 1: 整体替换 `PageHeader.vue`**

```vue
<template>
  <div class="page-header">
    <div class="brand">
      <span class="brand-logo">D</span>
      <span class="brand-name">Dock</span>
      <span class="brand-tag">控制台</span>
    </div>
    <div class="header-actions">
      <button class="icon-btn" @click="toggleTheme" :title="isDark ? '切换到亮色' : '切换到暗色'">
        <i :class="isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon'"></i>
      </button>
      <div class="avatar" title="admin">A</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { usePrefStore } from '@shared/stores/prefStore';

const prefStore = usePrefStore();
const isDark = computed(() => prefStore.theme === 'dark');

function toggleTheme() {
  prefStore.theme = isDark.value ? 'light' : 'dark';
}
</script>

<style scoped>
.page-header {
  height: var(--header-h);
  display: flex;
  align-items: center;
  gap: var(--gap-md);
  padding: 0 var(--page-pad);
  flex-shrink: 0;
}
.brand { display: flex; align-items: center; gap: 10px; }
.brand-logo {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--accent), #1D4ED8);
  color: #fff; font-weight: var(--font-bold); font-size: var(--text-md);
  box-shadow: 0 4px 14px -4px var(--glow);
}
.brand-name { font-size: var(--text-md); font-weight: var(--font-bold); color: var(--ink); letter-spacing: -.3px; }
.brand-tag {
  display: inline-flex; align-items: center; height: 20px; padding: 0 8px;
  font-size: 10.5px; font-weight: var(--font-medium); color: var(--accent);
  background: var(--primary-50); border-radius: 6px;
  box-shadow: inset 0 0 0 1px rgba(46,107,240,.18);
}
.header-actions { margin-left: auto; display: flex; align-items: center; gap: var(--gap-xs); }
.icon-btn {
  width: 36px; height: 36px; border-radius: var(--radius-md);
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent; border: none; color: var(--ink3); cursor: pointer;
  transition: var(--transition-fast);
}
.icon-btn:hover { background: var(--panel2); color: var(--ink); }
.icon-btn i { font-size: var(--text-sm); }
.avatar {
  width: 32px; height: 32px; border-radius: var(--radius-pill);
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #F59E0B, #EA580C);
  color: #fff; font-size: var(--text-xs); font-weight: var(--font-bold);
  margin-left: var(--gap-xs); cursor: pointer;
  box-shadow: 0 0 0 2px var(--bg), 0 4px 10px -2px rgba(245,158,11,.4);
}
</style>
```

- [ ] **Step 2: 类型检查 + 构建 + 单测**

Run: `npm run type-check && npm run build && npm run test:unit`
Expected: 全绿。

- [ ] **Step 3: 渲染清单**

- [ ] 顶栏单行：渐变 D logo + "Dock" + "控制台"徽章；右侧月亮/太阳主题钮 + 橙色头像。
- [ ] 不再有独立"齿轮"按钮。

- [ ] **Step 4: 提交**
```bash
git add src/dashboard/components/layout/PageHeader.vue
git commit -m "feat(ui): v3 merged header top row (logo, theme, avatar)"
```

---

## Task 8: App.vue 外壳重组（合并 header + 全宽 + 状态栏）

**Files:**
- Modify: `src/dashboard/App.vue`

**Interfaces:**
- Consumes: PageHeader（Task 7）、NavTabs（Task 9）、StatusBar（Task 6）。
- Produces: sticky 合并 header（含 PageHeader 顶行 + NavTabs 下行）+ 全宽 main + 底部 StatusBar；主区域底部留出状态栏高度。

- [ ] **Step 1: 整体替换 `src/dashboard/App.vue` 的 `<template>` 与 `<style>`**

`<template>` 改为：
```vue
<template>
  <div class="app-shell">
    <header class="app-header">
      <PageHeader />
      <NavTabs />
    </header>
    <main class="content-area">
      <div class="view-container">
        <router-view />
      </div>
    </main>
    <StatusBar />
    <ToastContainer />
    <DialogHost />
  </div>
</template>
```

`<script setup>` 中在现有 import 之后追加：
```ts
import StatusBar from './components/layout/StatusBar.vue';
```

`<style scoped>` 改为：
```css
.app-shell { height: 100vh; overflow: hidden; display: flex; flex-direction: column; position: relative; z-index: 1; }
.app-header {
  position: sticky; top: 0; z-index: var(--z-sticky);
  border-bottom: 1px solid var(--border);
  background: var(--header-bg);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  flex-shrink: 0;
}
.content-area { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.view-container { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
```

> 注意：保留 `applyTheme` / `prefStore.load()` / `cryptoStore.checkStatus()` 既有 onMounted 逻辑不动。

- [ ] **Step 2: 类型检查 + 构建 + 单测**

Run: `npm run type-check && npm run build && npm run test:unit`
Expected: 全绿。

- [ ] **Step 3: 渲染清单**

- [ ] 顶栏与 Tab 合并为同一 sticky header；下方为内容；最底部出现状态栏（实时时钟每秒跳动）。
- [ ] 内容区不被状态栏遮挡（底部留白 ≈ 状态栏高度）。

- [ ] **Step 4: 提交**
```bash
git add src/dashboard/App.vue
git commit -m "feat(dashboard): merge header+tabs, full-width main, mount StatusBar"
```

---

## Task 9: NavTabs 滑动发光指示条 + dock 面包屑

**Files:**
- Modify: `src/dashboard/components/layout/NavTabs.vue`

**Interfaces:**
- Consumes: `dockPathFor`/`subtitleFor`（Task 3）；vue-router `useRoute`；各 store 计数。
- Produces: Tab 行 + `#tab-ink` 滑动发光指示条（路由/resize 时重算）+ 右侧 `dock://path` 与副标题。

- [ ] **Step 1: 整体替换 `src/dashboard/components/layout/NavTabs.vue`**

```vue
<template>
  <div class="tabs-row">
    <nav ref="navEl" class="tabs-bar">
      <router-link
        v-for="tab in tabs"
        :key="tab.path"
        :ref="(el) => setTabRef(tab.path, el)"
        :to="tab.path"
        class="tab"
        :class="{ active: isActive(tab.path) }"
        @click="onTabClick(tab.path)"
      >
        <i :class="tab.icon"></i>
        <span>{{ tab.label }}</span>
      </router-link>
      <span ref="inkEl" class="tab-ink"></span>
    </nav>
    <div class="tabs-meta">
      <span class="mono path">{{ currentPath }}</span>
      <span class="sub t3">{{ currentSub }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { dockPathFor, subtitleFor, type DockStats } from '../../utils/dockPath';
import { useSystemStore } from '@shared/stores/systemStore';
import { useServerStore } from '@shared/stores/serverStore';
import { useMiddlewareStore } from '@shared/stores/middlewareStore';
import { useConfigStore } from '@shared/stores/configStore';

const route = useRoute();
const tabs = [
  { path: '/systems', label: '系统', icon: 'fa-solid fa-layer-group' },
  { path: '/servers', label: '服务器', icon: 'fa-solid fa-server' },
  { path: '/middlewares', label: '中间件', icon: 'fa-solid fa-cubes' },
  { path: '/configs', label: '配置', icon: 'fa-solid fa-sliders' },
  { path: '/tags', label: '标签', icon: 'fa-solid fa-tags' },
  { path: '/import-export', label: '导入 / 导出', icon: 'fa-solid fa-arrow-right-arrow-left' },
  { path: '/settings', label: '设置', icon: 'fa-solid fa-gear' },
];

const navEl = ref<HTMLElement | null>(null);
const inkEl = ref<HTMLElement | null>(null);
const tabEls: Record<string, Element | ComponentPublicInstance | null> = {};
function setTabRef(path: string, el: unknown) { tabEls[path] = (el as Element) ?? null; }

function isActive(path: string): boolean { return route.path === path; }

const systemStore = useSystemStore();
const serverStore = useServerStore();
const middlewareStore = useMiddlewareStore();
const configStore = useConfigStore();

const stats = computed<DockStats>(() => ({
  systems: systemStore.list?.length ?? 0,
  servers: serverStore.list?.length ?? 0,
  middlewares: middlewareStore.list?.length ?? 0,
  projects: configStore.projects?.length ?? 0,
}));

const currentPath = computed(() => dockPathFor(route.path));
const currentSub = computed(() => subtitleFor(route.path, stats.value));

function moveInk() {
  const activeKey = tabs.find((t) => t.path === route.path)?.path ?? tabs[0].path;
  const el = tabEls[activeKey] as HTMLElement | null;
  if (!el || !inkEl.value) return;
  inkEl.value.style.left = `${el.offsetLeft + 12}px`;
  inkEl.value.style.width = `${Math.max(el.offsetWidth - 24, 0)}px`;
}

function onTabClick(path: string) {
  try { localStorage.setItem('dock-v3-tab', path); } catch { /* ignore */ }
  nextTick(moveInk);
}

let ro: ResizeObserver | undefined;
onMounted(() => {
  nextTick(moveInk);
  if (navEl.value && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => moveInk());
    ro.observe(navEl.value);
  }
  window.addEventListener('resize', moveInk);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', moveInk);
  ro?.disconnect();
});
</script>

<script lang="ts">
import type { ComponentPublicInstance } from 'vue';
export default {};
</script>

<style scoped>
.tabs-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 0 var(--page-pad);
}
.tabs-bar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 2px;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 0;
}
.tabs-bar::-webkit-scrollbar { display: none; }

.tab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 10px 14px;
  font-size: var(--text-sm); font-weight: var(--font-medium);
  color: var(--ink3); cursor: pointer;
  transition: color .18s; text-decoration: none; white-space: nowrap;
}
.tab:hover { color: var(--ink); }
.tab.active { color: var(--accent); }
.tab i { font-size: var(--text-xs); }

.tab-ink {
  position: absolute; bottom: -1px;
  height: 2px; border-radius: 2px;
  background: var(--accent);
  box-shadow: 0 0 12px var(--glow), 0 0 4px var(--glow);
  transition: left .32s cubic-bezier(.3,1.1,.4,1), width .32s cubic-bezier(.3,1.1,.4,1);
  pointer-events: none;
}

.tabs-meta {
  display: none;
  align-items: center;
  gap: 12px;
  padding-bottom: 8px;
  font-size: 10.5px;
}
.tabs-meta .path { color: var(--accent); font-family: var(--font-mono); }
.tabs-meta .sub { font-family: var(--font-mono); }
@media (min-width: 1024px) { .tabs-meta { display: inline-flex; } }
</style>
```

- [ ] **Step 2: 类型检查 + 构建 + 单测**

Run: `npm run type-check && npm run build && npm run test:unit`
Expected: 全绿。

- [ ] **Step 3: 渲染清单**

- [ ] Tab 切换时底部发光蓝条平滑滑动到当前 Tab 下方。
- [ ] 缩放窗口时指示条重新对齐。
- [ ] 右侧（宽屏）显示 `dock://systems` 与副标题。

- [ ] **Step 4: 提交**
```bash
git add src/dashboard/components/layout/NavTabs.vue
git commit -m "feat(ui): sliding glowing tab indicator + dock breadcrumb"
```

---

## Task 10: SystemView 视图 v3 化 + viewMode 持久化

**Files:**
- Modify: `src/dashboard/views/SystemView.vue`

**Interfaces:**
- Consumes: tokens.css（`.stat-card/.chip/.view-btn/.env`）、EnvBadge、SystemForm。
- Produces: 卡片视图用 `.stat-card`；viewMode 从 localStorage 恢复/持久化；v3 空状态。

- [ ] **Step 1: 在 `<script setup>` 中替换 viewMode 初始化与切换**

把 `const viewMode = ref<'table' | 'card'>('table');` 替换为：
```ts
const VIEW_KEY = 'dock-v3-system-view';
const viewMode = ref<'table' | 'card'>(
  (typeof localStorage !== 'undefined' && (localStorage.getItem(VIEW_KEY) as 'table' | 'card')) || 'table',
);
watch(viewMode, (v) => { try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ } });
```
并在 import 行追加 `import { ref, computed, onMounted, watch } from 'vue';`（若未含 `watch`）。

- [ ] **Step 2: 把卡片视图的 `.sys-card` 类叠加 v3 风格**

在 `<template>` 中，把 `<div ... class="sys-card" @click="onOpen(s)">` 改为 `class="sys-card stat-card"`（追加 `stat-card`，保留 `sys-card` 用于布局）。把 `.card-icon` 的 style 改为带彩色辉光：在 `iconStyle` 返回对象里追加 `boxShadow: '0 5px 14px -4px ' + colorOf(s)`，其中 `colorOf` 取 `s.iconColor` 或调色板首色；为简化，把 `iconStyle` 改为：
```ts
function iconStyle(s: System) {
  const bg = s.iconColor || iconPalettes[Math.abs(s.name.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0)) % iconPalettes.length];
  const solid = s.iconColor || '#2E6BF0';
  return { background: bg, boxShadow: `0 5px 14px -4px ${solid}66` };
}
```

- [ ] **Step 3: 调整 `<style>` 中表格/卡片配色到 v3**

在 `SystemView.vue` `<style scoped>` 内：
- `.data-table thead th` 的 `background` 改为 `var(--panel2)`，`color` 改为 `var(--ink3)`，加 `text-transform: uppercase; letter-spacing: .08em; font-size: 10.5px;`。
- `.table-wrap` 的 `background` 改为 `var(--panel)`，`border-radius: var(--radius-xl)`，去掉 `box-shadow` 或改 `var(--shadow-xs)`。
- `.sys-name` 的 `color` 改为 `var(--ink)`；`.sys-icon` 加 `box-shadow` 由 inline style 提供（Task Step 2）。
- `.url-text` 的 `color` 改为 `var(--ink2)`。
- `.sys-card`（保留布局）：去掉其自带 `box-shadow/hover transform`（交给 `.stat-card`），即删除 `.sys-card:hover { ... transform ... }` 与 `.sys-card { box-shadow: ... }`，仅保留 `display:flex; flex-direction:column; gap; padding; cursor:pointer`。`.card-name` color → `var(--ink)`；`.card-url` color → `var(--ink3)`（mono）。
- 空状态 `.empty-state i` color → `var(--ink3)`；文案保持。

- [ ] **Step 4: 类型检查 + 构建 + 单测**

Run: `npm run type-check && npm run build && npm run test:unit`
Expected: 全绿。

- [ ] **Step 5: 渲染清单**

- [ ] 列表视图：表头灰底大写、行 hover 浅蓝；环境徽章带发光点。
- [ ] 切到卡片视图：卡片 hover 上浮 + 顶部蓝青渐变高光条；刷新页面后仍保持上次视图。
- [ ] 空状态居中。

- [ ] **Step 6: 提交**
```bash
git add src/dashboard/views/SystemView.vue
git commit -m "feat(ui): v3 system view (stat-card grid, persisted view mode, empty state)"
```

---

## Task 11: 服务器 ServerView + ServerCard v3 化

**Files:**
- Modify: `src/dashboard/views/ServerView.vue`
- Modify: `src/dashboard/components/server/ServerCard.vue`

**Interfaces:**
- Consumes: tokens.css、EnvBadge、ServerForm。
- Produces: 卡片 = `.stat-card` + 在线呼吸点 + 琥珀服务器图标 + 详情 dl + 复制 IP/SSH + 末位虚线"添加"卡。

- [ ] **Step 1: ServerCard 模板与样式 v3 化**

打开 `src/dashboard/components/server/ServerCard.vue`，在根元素 class 追加 `stat-card`；图标容器用固定琥珀色 `background:#F59E0B; box-shadow:0 5px 14px -4px #F59E0B`；状态点用 v3 `animate-ping` 双层结构：
```html
<span class="status-dot" :class="online ? 'on' : 'off'">
  <span class="ping"></span>
</span>
```
增加"复制 IP / 复制 SSH"两个 `.btn-g`（或 `.btn-default`）按钮，调用 `useClipboard` 或 `navigator.clipboard.writeText`。底部详情用 `<dl>` 列出 账号/端口/更新。

- [ ] **Step 2: ServerView 末位添加卡**

在 `ServerView.vue` 的网格末尾追加一张虚线卡（与中间件一致）：
```html
<button class="add-card" @click="onCreate">
  <i class="fa-solid fa-plus"></i>
  <span>添加服务器</span>
  <span class="hint">快速创建新的服务器连接</span>
</button>
```
并在该视图 `<style>` 增加：
```css
.status-dot { position: relative; width: 6px; height: 6px; border-radius: 50%; }
.status-dot.on { background: var(--ok); box-shadow: 0 0 8px var(--ok); }
.status-dot.on .ping { position: absolute; inset: 0; border-radius: 50%; background: var(--ok); animation: ping 1.6s cubic-bezier(0,0,.2,1) infinite; opacity: .6; }
.status-dot.off { background: var(--ink3); }
@keyframes ping { 75%,100% { transform: scale(2.2); opacity: 0; } }
.add-card {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  min-height: 220px; border-radius: var(--radius-xl);
  border: 2px dashed var(--border-strong); background: transparent; color: var(--ink3);
  cursor: pointer; transition: var(--transition-fast);
}
.add-card:hover { border-color: var(--accent); color: var(--accent); }
.add-card .hint { font-size: 11px; }
```

- [ ] **Step 3: 类型检查 + 构建 + 单测**

Run: `npm run type-check && npm run build && npm run test:unit`
Expected: 全绿。

- [ ] **Step 4: 渲染清单**

- [ ] 服务器卡：左上在线呼吸绿点、琥珀服务器图标、底部"复制 IP/复制 SSH"按钮。
- [ ] 网格末位出现虚线"添加服务器"卡。

- [ ] **Step 5: 提交**
```bash
git add src/dashboard/views/ServerView.vue src/dashboard/components/server/ServerCard.vue
git commit -m "feat(ui): v3 server cards with status pulse and copy actions"
```

---

## Task 12: 中间件 MiddlewareView v3 化（MW_TYPES 配色）

**Files:**
- Modify: `src/dashboard/views/MiddlewareView.vue`
- Modify: `src/dashboard/components/middleware/MiddlewareForm.vue`（仅 `<style>` 若有硬编码颜色）

**Interfaces:**
- Consumes: tokens.css、middleware types（已有 `middlewareSchemas`）。
- Produces: 卡片 = `.stat-card` + 按 MW_TYPES 配色图标 + 类型版本徽章 + 连接地址 mono + 复制按钮 + 末位"添加中间件"卡。

- [ ] **Step 1: 定义 MW_TYPES 配色表并应用到卡片**

在 `MiddlewareView.vue` `<script setup>` 顶部加：
```ts
const MW_TYPES: Record<string, { icon: string; color: string }> = {
  Redis: { icon: 'fa-solid fa-bolt', color: '#DC382D' },
  MySQL: { icon: 'fa-solid fa-database', color: '#00758F' },
  PostgreSQL: { icon: 'fa-solid fa-database', color: '#336791' },
  MongoDB: { icon: 'fa-solid fa-leaf', color: '#47A248' },
  Elasticsearch: { icon: 'fa-solid fa-magnifying-glass', color: '#B7791F' },
  RabbitMQ: { icon: 'fa-solid fa-message', color: '#FF6600' },
  Kafka: { icon: 'fa-solid fa-stream', color: '#4B5563' },
  Nginx: { icon: 'fa-solid fa-server', color: '#009639' },
  MinIO: { icon: 'fa-solid fa-cube', color: '#C72E49' },
};
function mwMeta(type: string) { return MW_TYPES[type] || { icon: 'fa-solid fa-cube', color: '#2E6BF0' }; }
```
卡片根元素加 `stat-card`；图标用 `:style="{ background: mwMeta(m.type).color, boxShadow: '0 5px 14px -4px ' + mwMeta(m.type).color }"` 与 `<i :class="mwMeta(m.type).icon">`。类型徽章用 `.chip`（mono）；连接地址 `host:port` 用 `.mono t3`；末尾"复制连接地址"按钮。

- [ ] **Step 2: 末位添加卡**

在网格末尾追加与 Task 11 相同结构的 `.add-card`（文案"添加中间件"，副文案 `Redis · MySQL · MongoDB · ES`）。复用 Task 11 的 `.add-card` 样式（若 ServerView 已定义，可提升到 tokens.css 的 `.add-card`，或在本视图重复声明）。

- [ ] **Step 3: 类型检查 + 构建 + 单测**

Run: `npm run type-check && npm run build && npm run test:unit`
Expected: 全绿。

- [ ] **Step 4: 渲染清单**

- [ ] Redis 卡图标红、MySQL 青等；卡顶 hover 高光条；复制连接地址可用。
- [ ] 末位虚线"添加中间件"卡。

- [ ] **Step 5: 提交**
```bash
git add src/dashboard/views/MiddlewareView.vue src/dashboard/components/middleware/MiddlewareForm.vue
git commit -m "feat(ui): v3 middleware cards with MW_TYPES colors"
```

---

## Task 13: ConfigView v3 化（项目列表 + 配置 chip + finput）

**Files:**
- Modify: `src/dashboard/views/ConfigView.vue`

**Interfaces:**
- Consumes: tokens.css（`.panel/.chip/.finput`）、configStore。
- Produces: 左侧项目列表（选中态 accent 软底 + 发光描边）+ 右侧配置 chip 切换 + 字段表（finput 行内编辑）+ "已自动保存"提示。

- [ ] **Step 1: 套用 v3 结构类**

`ConfigView` 当前已是内联编辑模式。仅需在 `<style>` 内：
- 项目项选中态改为 `background: var(--primary-50); color: var(--accent); box-shadow: inset 0 0 0 1px rgba(46,107,240,.25)`；非选中 `color: var(--ink2)`。
- 项目列表容器与右侧详情容器用 `.panel`（已在 tokens 定义）。
- 配置 chip 选中态：`border-color: rgba(46,107,240,.4); background: var(--primary-50); color: var(--accent)`；未选中 `border-color: var(--border); background: var(--panel); color: var(--ink2)`。
- 字段输入用 `.finput`（tokens 已定义），保留现有 onblur/回车保存逻辑。
- "已自动保存"提示气泡：`.save-hint { color: var(--ok); opacity:0; transition: opacity .3s } .show { opacity:1 }`。

- [ ] **Step 2: 类型检查 + 构建 + 单测**

Run: `npm run type-check && npm run build && npm run test:unit`
Expected: 全绿。

- [ ] **Step 3: 渲染清单**

- [ ] 左侧项目选中态蓝底发光描边；右侧配置 chip 切换、字段失焦自动保存并闪现"已自动保存"。

- [ ] **Step 4: 提交**
```bash
git add src/dashboard/views/ConfigView.vue
git commit -m "feat(ui): v3 config view (project list, config chips, finput)"
```

---

## Task 14: ImportExportView + SettingsView v3 化

**Files:**
- Modify: `src/dashboard/views/ImportExportView.vue`
- Modify: `src/dashboard/views/SettingsView.vue`

**Interfaces:**
- Consumes: tokens.css（`.panel/.btn-*/.sw/.seg-btn/.kbd`）、prefStore、importExportService。
- Produces: 导入导出双卡 + 拖拽 drop-zone（dragover 高亮）+ 底部琥珀安全警示条；设置页分段主题/自动锁定/主密码开关/快捷键 kbd/关于卡。

- [ ] **Step 1: ImportExportView**

- 导出/导入两列用 `.panel p-6`；导出范围勾选用 `.form-check`（`accent-color: var(--accent)` 已在 tokens）。
- 拖拽区 `.drop-zone`：默认 `border:2px dashed var(--border-strong)`；dragover 时 JS 切 class → `border-color: var(--accent); color: var(--accent)`（沿用现有 dragover 处理或新增）。
- 底部警示条：`border-color: rgba(180,83,9,.28); background: rgba(251,191,36,.07); color: var(--warn)`，左侧 `fa-triangle-exclamation`。

- [ ] **Step 2: SettingsView**

- 主题分段用 `.seg-group > .seg-btn`（`data-theme` light/dark；点击写 `prefStore.theme`；若需要"跟随系统"则扩展 prefStore，**本期不扩展**，仅 浅色/深色 两个 seg-btn，绑定 `prefStore.theme`）。
- 自动锁定用 `.form-select`，绑定 `prefStore.autoLockMinutes`。
- 主密码开关用 `.sw`（`@click` 切换本地 ref 状态 `on`），仅视觉演示（真实主密码逻辑在 cryptoStore，**本期不接线**，避免改动业务逻辑）。
- 快捷键列表用 `.kbd` 展示 Ctrl+K / Esc / ↑↓ / Enter。
- 关于卡：D logo + "Dock for Chrome" + `mono v3.0.0 · Manifest V3`。

- [ ] **Step 3: 类型检查 + 构建 + 单测**

Run: `npm run type-check && npm run build && npm run test:unit`
Expected: 全绿。

- [ ] **Step 4: 渲染清单**

- [ ] 导入导出双卡 + 琥珀警示条；拖文件进 drop-zone 边框变蓝。
- [ ] 设置页：主题分段、自动锁定下拉、主密码开关、快捷键键位、关于卡。

- [ ] **Step 5: 提交**
```bash
git add src/dashboard/views/ImportExportView.vue src/dashboard/views/SettingsView.vue
git commit -m "feat(ui): v3 import/export and settings views"
```

---

## Task 15: TagView + OnboardingView + 表单组件配色扫尾

**Files:**
- Modify: `src/dashboard/views/TagView.vue`、`src/dashboard/views/OnboardingView.vue`
- Modify: `src/dashboard/components/system/{SystemForm,AccountFormModal,AccountList}.vue`、`src/dashboard/components/server/ServerForm.vue`、`src/dashboard/components/middleware/MiddlewareForm.vue`

**Interfaces:**
- Consumes: tokens.css（这些组件大多已用 `.btn-*/.form-input/.mtab`，令牌替换后自动跟随；本任务只清理残留硬编码颜色）。
- Produces: 所有视图与表单在亮/暗下配色一致，无 #4F7CFF 等旧硬编码残留。

- [ ] **Step 1: 搜索旧硬编码颜色**

Run: `rg -n "#4F7CFF|#3D6DF7|#2E5FF3|#FAFBFD|#111827|#374151|#6B7280|#EEF2F6" src/dashboard`
对每一处命中：若在 `<style>` 中，替换为对应令牌变量（`var(--accent)` / `var(--ink)` / `var(--ink2)` / `var(--ink3)` / `var(--bg)` / `var(--border)`）；若在 `<script>` 的调色板数组（如 SystemView 已在 Task 10 处理），跳过。

- [ ] **Step 2: TagView / OnboardingView 视觉对齐**

确保二者根容器用 `.panel`/`.stat-card`，按钮用 `.btn-primary/.btn-default`，输入用 `.form-input/.search-input`，标签预览用 EnvBadge/Tag。

- [ ] **Step 3: 类型检查 + 构建 + 单测 + lint**

Run: `npm run type-check && npm run build && npm run test:unit && npm run lint`
Expected: 全绿（lint 可有既有 warning，不新增 error）。

- [ ] **Step 4: 渲染清单**

- [ ] 标签页、引导页、所有表单弹窗在亮/暗下配色统一；无突兀的旧蓝。

- [ ] **Step 5: 提交**
```bash
git add src/dashboard
git commit -m "feat(ui): align tags/onboarding/forms to v3 tokens"
```

---

## Task 16: popup 令牌 + 背景 + 毛玻璃（popup.css 重写）

**Files:**
- Modify (整体替换): `src/popup/styles/popup.css`

**Interfaces:**
- Produces: popup 专属令牌（镜像 dashboard tokens.css 的变量名与值）+ popup 背景网格/辉光 + `.popup-root` 毛玻璃。供 popup 组件消费。

- [ ] **Step 1: 用以下完整内容替换 `src/popup/styles/popup.css`**

```css
:root {
  --font-sans: "Amazon Ember", "Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif;
  --font-mono: "JetBrains Mono", "SF Mono", Monaco, Consolas, monospace;

  --text-xs: 12px; --text-sm: 13px; --text-base: 14px; --text-md: 15px; --text-lg: 16px; --text-xl: 18px;
  --font-normal: 400; --font-medium: 500; --font-semibold: 600; --font-bold: 700;
  --leading-tight: 1.3; --leading-normal: 1.6;

  --bg: #EDF1F8; --bg2: #E4EAF4;
  --panel: #FFFFFF; --panel2: #F4F7FC;
  --solid: #FFFFFF; --card-bg: #FFFFFF;
  --surface: #FFFFFF; --surface-secondary: #F4F7FC;
  --surface-hover: rgba(46,107,240,.04); --surface-active: rgba(46,107,240,.06);

  --accent: #2E6BF0; --accent2: #0891B2; --glow: rgba(46,107,240,.25);
  --primary: #2E6BF0; --primary-hover: #1D4ED8; --primary-active: #1D4ED8;
  --primary-50: rgba(46,107,240,.08); --primary-100: rgba(46,107,240,.16);

  --ink: #0F1726; --ink2: #4E5D75; --ink3: #8593A9;
  --text-primary: #0F1726; --text-secondary: #4E5D75; --text-tertiary: #8593A9; --text-quaternary: #AEB8C9;

  --border: #DDE5F0; --border-soft: #ECF1F7; --border-strong: #C6D2E4; --border2: #C6D2E4;
  --grid-line: rgba(46,107,240,.05);

  --success: #059669; --success-light: rgba(5,150,105,.1);
  --warning: #B45309; --warning-light: rgba(180,83,9,.1);
  --danger: #DC2626; --danger-light: rgba(220,38,38,.08);
  --info: #2563EB; --info-light: rgba(37,99,235,.1);
  --ok: #059669;

  --env-dev-bg: rgba(37,99,235,.08);     --env-dev-fg: #2563EB;
  --env-prod-bg: rgba(5,150,105,.08);    --env-prod-fg: #059669;
  --env-test-bg: rgba(180,83,9,.08);     --env-test-fg: #B45309;
  --env-staging-bg: rgba(124,58,237,.07);--env-staging-fg: #7C3AED;

  --radius-xs: 6px; --radius-sm: 8px; --radius-md: 10px; --radius-lg: 12px; --radius-xl: 14px; --radius-pill: 9999px;
  --shadow-xs: 0 1px 2px rgba(15,23,38,.03);
  --shadow-sm: 0 1px 3px rgba(15,23,38,.04);
  --shadow-md: 0 6px 20px -10px rgba(15,23,38,.14);
  --shadow-lg: 0 20px 56px -14px rgba(15,23,38,.28);
  --shadow-focus: 0 0 0 3px rgba(46,107,240,.16);
  --shadow-primary: 0 3px 10px -3px var(--glow);
  --transition-fast: all .15s cubic-bezier(.4,0,.2,1);
  --transition: all .2s cubic-bezier(.4,0,.2,1);
  --gap-xs: 4px; --gap-sm: 8px; --gap-md: 12px; --gap-lg: 16px;
  --control-h: 38px;
  --z-toast: 9000; --z-modal: 10000;
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  color: var(--ink);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
button { font-family: inherit; }
input, select, textarea { font-family: inherit; }
.mono { font-family: var(--font-mono); }

::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-thumb { background: #C4CEDE; border-radius: 8px; }
::selection { background: var(--primary-100); color: var(--ink); }

/* 深色 */
[data-theme="dark"] {
  --bg: #060A11; --bg2: #0A0F19;
  --panel: rgba(148,178,255,.05); --panel2: rgba(148,178,255,.09);
  --solid: #0C1322; --card-bg: #0C1322;
  --surface: #0C1322; --surface-secondary: rgba(148,178,255,.09);
  --surface-hover: rgba(148,178,255,.08);
  --accent: #3D7FFF; --accent2: #22D3EE; --glow: rgba(61,127,255,.4);
  --primary: #3D7FFF; --primary-hover: #5A8FFF; --primary-50: rgba(61,127,255,.12); --primary-100: rgba(61,127,255,.2);
  --ink: #E9EEF8; --ink2: #93A1B8; --ink3: #56657D;
  --text-primary: #E9EEF8; --text-secondary: #93A1B8; --text-tertiary: #56657D;
  --border: rgba(148,178,255,.13); --border-soft: rgba(148,178,255,.1); --border-strong: rgba(148,178,255,.24);
  --env-dev-bg: rgba(96,165,250,.16); --env-dev-fg: #93C5FD;
  --env-prod-bg: rgba(52,211,153,.16); --env-prod-fg: #6EE7B7;
  --env-test-bg: rgba(251,191,36,.16); --env-test-fg: #FCD34D;
  --env-staging-bg: rgba(167,139,250,.16); --env-staging-fg: #D8B4FE;
}
[data-theme="dark"] ::-webkit-scrollbar-thumb { background: rgba(148,178,255,.18); }
```

- [ ] **Step 2: 类型检查 + 构建 + 单测**

Run: `npm run type-check && npm run build && npm run test:unit`
Expected: 全绿。

- [ ] **Step 3: 提交**
```bash
git add src/popup/styles/popup.css
git commit -m "feat(ui): rewrite popup tokens to v3 (light + dark)"
```

---

## Task 17: popup 组件 v3 化（App + SearchBox + FavoriteGrid + QuickAdd）

**Files:**
- Modify: `src/popup/App.vue`、`src/popup/components/{SearchBox,FavoriteGrid,QuickAdd}.vue`
- Modify: `popup.html`（尺寸 378×560 + 字体）

**Interfaces:**
- Consumes: popup.css（Task 16）。
- Produces: 378×560 毛玻璃弹窗；header D logo + 计数 + 新增/面板；搜索框 Ctrl+K；列表项彩色图标 + 星标 + mono URL + hover 操作 + 环境徽章；底部同步点 + 管理控制台链接；spring 入场。

- [ ] **Step 1: popup.html 尺寸与字体**

把 `popup.html` 的 `<style>` 中 `html, body { ... width: 360px; height: 600px; ... }` 改为 `width: 378px; height: 560px;`；把 Google Fonts `<link>` 的 family 改为 `Noto+Sans+SC:wght@400;500;700;900&family=JetBrains+Mono:wght@400;500;700`（移除 Inter）。

- [ ] **Step 2: App.vue 根尺寸 + 毛玻璃 + spring 入场**

把 `src/popup/App.vue` `.popup-root` 的 `width/height` 改为 `378px / 560px`，追加：
```css
.popup-root {
  position: relative;
  background: rgba(255,255,255,.96);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  animation: popOpen .34s cubic-bezier(.25,1.35,.45,1) both;
  transform-origin: top right;
}
@keyframes popOpen { from { opacity: 0; transform: translateY(-10px) scale(.9); } }
[data-theme="dark"] .popup-root { background: rgba(12,19,34,.9); }
```
header 左侧加 D logo（同 PageHeader 样式）；"新增"用 `.hdr-btn.primary`（accent + glow）；计数用 `.header-count`。

- [ ] **Step 3: SearchBox v3 化**

`SearchBox.vue`：搜索框 `fa-terminal` 图标 + 右侧 `Ctrl K` 键位（`.kbd`），focus 时容器 `border-color: var(--accent); box-shadow: var(--shadow-focus); background:#fff`。沿用现有搜索逻辑。

- [ ] **Step 4: FavoriteGrid 列表项 v3 化**

`FavoriteGrid.vue`：列表项 class `popup-item`，结构 = 彩色图标（按系统 `iconColor` 或 hash 调色板，带 `box-shadow:0 4px 12px -3px <color>`）+ 名称 + 星标 + mono URL + hover 显出操作（复制账号/打开）+ 环境徽章；分组"常用/全部系统"。`.popup-item` 样式：
```css
.popup-item { position: relative; display: flex; align-items: center; gap: 12px; border-radius: 12px; padding: 9px 12px; cursor: pointer; transition: background .12s; border: 1px solid transparent; }
.popup-item:hover { background: var(--panel2); }
.popup-item.active { background: var(--primary-50); border-color: rgba(46,107,240,.3); box-shadow: 0 2px 12px -4px var(--glow); }
```
（沿用既有键盘选择逻辑；若组件已用别的类名，迁移到上述结构。）

- [ ] **Step 5: QuickAdd 表单套 v3 输入/按钮**

`QuickAdd.vue`：输入用 `.form-input`/`.form-select`，保存用 `.btn-primary`（glow），关闭用 `.btn-default`。

- [ ] **Step 6: 类型检查 + 构建 + 单测**

Run: `npm run type-check && npm run build && npm run test:unit`
Expected: 全绿。

- [ ] **Step 7: 渲染清单**

- [ ] 点击扩展图标弹出 378×560 毛玻璃窗，spring 入场；搜索框 Ctrl+K 聚焦；列表项 hover 显出操作；底部"本地已同步"呼吸点。

- [ ] **Step 8: 提交**
```bash
git add src/popup popup.html
git commit -m "feat(ui): v3 popup (glass, 378x560, list items, spring open)"
```

---

## Task 18: dashboard.html 字体 + 终验

**Files:**
- Modify: `dashboard.html`

**Interfaces:** —
- Produces: dashboard 入口加载 Noto Sans SC + JetBrains Mono（移除 Inter），与令牌字体栈一致。

- [ ] **Step 1: 更新 dashboard.html 字体**

把 `dashboard.html` 中 Google Fonts `<link>` 的 family 改为 `Noto+Sans+SC:wght@400;500;700;900&family=JetBrains+Mono:wght@400;500;700`（移除 Inter）。保留 Font Awesome CDN。

- [ ] **Step 2: 全量验证**

Run: `npm run type-check && npm run build && npm run test:unit && npm run lint`
Expected: 全绿；`dist/` 产出 dashboard.html / popup.html。

- [ ] **Step 3: 全量渲染清单（人工，亮+暗各过一遍）**

- [ ] 背景：40px 网格 + 顶部蓝/青辉光（暗色：深底 + 蓝/青辉光）。
- [ ] 顶栏：D logo + Dock + 控制台徽章；主题钮 + 头像；无独立齿轮。
- [ ] Tab：滑动发光蓝条；右侧 dock:// 路径 + 副标题。
- [ ] 状态栏：呼吸点 + 统计 + 实时时钟 + Dock v3.0.0。
- [ ] 系统页：表头大写灰底、行 hover；卡片 hover 上浮 + 顶部高光条；环境徽章发光点；视图切换持久。
- [ ] 服务器页：在线呼吸点 + 琥珀图标 + 复制 IP/SSH + 末位添加卡。
- [ ] 中间件页：MW_TYPES 配色图标 + 复制连接 + 末位添加卡。
- [ ] 配置页：项目选中蓝底发光 + 配置 chip + finput 自动保存提示。
- [ ] 导入导出页：双卡 + drop-zone dragover 变蓝 + 琥珀警示。
- [ ] 设置页：主题分段 + 自动锁定 + 主密码开关 + 快捷键 + 关于卡。
- [ ] 标签 / 引导页：配色统一。
- [ ] Modal：弹簧入场；Toast：辉光上浮。
- [ ] popup：378×560 毛玻璃 spring；Ctrl+K；列表项 hover 操作；底部同步点。

- [ ] **Step 4: 提交**
```bash
git add dashboard.html
git commit -m "feat(ui): v3 fonts in dashboard entry; finalize v3 redesign"
```

---

## Self-Review（计划作者自检，已完成）

**1. Spec 覆盖**：spec §3 令牌 → Task 1/16；§4 外壳 → Task 6/7/8/9；§5 公共组件 → Task 1(类)/4/5；§6 逐视图 → Task 10–15；§7 popup → Task 16/17；§8 动画 → Task 1(keyframes)/5；§9 边界 → Global Constraints + 各任务仅改 UI；§10 风险 → Task 9 指示条 ResizeObserver、Task 2 时钟、Task 17 popup 尺寸、Task 1/16 暗色、各任务 build+test 门禁；§11 验收 → Task 18。
**2. 占位符扫描**：无 TBD/TODO；视觉任务以"完整 CSS 块 + 渲染清单"为交付，逻辑任务有完整测试与实现代码。
**3. 类型一致**：`formatClockHHMMSS(date:Date):string`（Task 2 定义 ↔ Task 6 使用一致）；`dockPathFor/subtitleFor/DockStats`（Task 3 ↔ Task 9 一致）；`StatusBar` 无 props（Task 6 ↔ Task 8 挂载一致）；`viewMode` localStorage 键 `dock-v3-system-view`（Task 10 内部自洽）；MW_TYPES 键名（Task 12）与现有 middleware 类型字段无冲突。
