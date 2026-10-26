# Dock - 内部系统助手

> Chrome 扩展：一站式管理内部系统、账号、服务器、中间件和配置信息。

## 界面预览

### 系统管理

![系统管理](./images/system-dock.png)

### 服务器管理

![服务器管理](./images/ssh-dock.png)

### 中间件管理

![中间件管理](./images/middle-dock.png)

### 配置中心

![配置中心](./images/config-dock.png)

### 导入导出

![导入导出](./images/Snipaste_2026-07-25_10-06-26.png)

### 系统设置

![系统设置](./images/systemconfig-dock.png)

## 功能特性

### 系统管理
- 快速收录内部系统链接，支持分组管理
- 弹窗搜索，一键直达；支持按系统名称/URL 和分组名称检索，直接命中优先，分组命中随后展示
- 标签分类，高效检索

### 账号管理
- 保存各系统的账号密码；新录入账号密码默认明文显示，保存后重新打开自动掩码
- 自动识别登录页并填充凭据：按域名/IP + 端口 + 路径（含 `#/` 路由）精确匹配，同一地址下的多个服务不会互相串用密码
- 系统有多个账号时优先填充默认账号，不再弹出账号选择；仅在没有默认账号或多个系统并列匹配时才弹出选择器
- 每个系统保证只有一个默认账号，编辑或导入时会自动校正
- AES-256 加密存储，主密码保护

### 服务器管理
- 记录服务器 IP、端口、SSH 凭据等
- 按环境（生产/开发/测试/预发）筛选
- 一键复制连接信息

### 中间件管理
- 支持 Redis、MySQL、PostgreSQL、MongoDB、Elasticsearch、RabbitMQ、Kafka、Nginx、MinIO 等
- 环境标签 + 卡片式展示
- 连接信息一键复制

### 配置中心
- 树形分组 → 配置 → 字段三级结构
- 支持拖拽调整分组顺序，配置可在分组内排序或直接拖到其他分组；拖到折叠分组标题上停留片刻会自动展开该分组
- 环境筛选状态下暂停拖拽，切回「全部」即可排序或跨组移动
- 多环境筛选（生产/开发/测试/预发）
- 拖拽排序、双击重命名、一键复制所有字段
- 支持 Markdown 格式导入导出

### 安全
- 主密码 (PBKDF2 + AES-GCM) 加密
- 自动锁定（空闲超时）
- 默认仅本地 IndexedDB 存储；开启云端同步后经 HTTPS 上传（内网 IP 可 HTTP），由服务端 AES-256-GCM 加密落盘

### 云端同步（可选）
- 后台面板配置云端地址与 API Token，自动检测云端健康，保存后自动上传全部资产与配置
- 云端提供与插件管理面板一致的 Web 界面，支持完整增删改与自动回写
- 从云端恢复按 `updatedAt` 安全合并：新增/更新较新数据，不删除本地记录
- 账号/服务器/中间件密码与配置字段随快照同步；服务端加密密钥由环境变量提供
- 单个 Docker 镜像部署（Node 22 + Fastify + SQLite），Web 登录密钥与会话有效期可配置

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Vue 3 + TypeScript |
| 状态管理 | Pinia |
| 本地数据库 | Dexie (IndexedDB) |
| 构建工具 | Vite + @crxjs/vite-plugin |
| 路由 | Vue Router 4 |
| 拖拽排序 | vue-draggable-plus |
| 加密 | Web Crypto API (PBKDF2 / AES-GCM) |
| 云端服务 | Node 22 + Fastify + SQLite (better-sqlite3) |
| 云端面板 | Vue 3（复用管理面板）+ 内存 IndexedDB |
| 部署 | Docker 多阶段镜像 |
| 测试 | Vitest + @vue/test-utils |

## 项目结构

```
src/
├── background/       # Service Worker（快捷键、右键菜单、消息通信、云端健康检查）
├── content/          # Content Script（自动填充、页面检测）
├── dashboard/        # 管理面板（Vue SPA）
│   ├── components/   # 公共/布局/业务组件
│   ├── views/        # 路由视图
│   └── styles/       # 设计令牌 & 全局样式
├── popup/            # 弹窗（快速搜索 & 收藏）
├── web/              # 云端 Web 面板入口（复用 dashboard）
└── shared/           # 跨模块共享
    ├── crypto/       # 加密模块
    ├── db/           # Dexie 数据库 & 仓库
    ├── services/     # 业务服务层
    ├── sync/         # 云端同步（快照/恢复/调度）
    ├── stores/       # Pinia 状态
    ├── types/        # TypeScript 类型
    └── utils/        # 工具函数

shared/protocol/      # 扩展与服务端共用的同步协议
server/               # 云端 Node/Fastify 服务与 SQLite
```

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器（HMR，输出到 dist-dev/，不会覆盖生产构建 dist/）
npm run dev

# 类型检查
npm run type-check

# 构建生产版本
npm run build

# 构建云端 Web 面板
npm run build:web

# 云端服务（独立依赖）
npm --prefix server install
npm --prefix server run type-check
npm --prefix server test
npm --prefix server run build

# 运行测试
npm test

# 代码检查
npm run lint
```

## 安装到 Chrome

1. 执行 `npm run build`
2. 打开 `chrome://extensions/`
3. 开启「开发者模式」
4. 点击「加载已解压的扩展程序」，选择项目 `dist/` 目录

## 云端同步与部署

### 安全模型

- **服务端加密，不是端到端加密**：扩展在保险库解锁时通过 HTTPS 上传明文快照；服务端使用 `DOCK_DATA_KEY` 派生的 AES-256-GCM 密钥加密落盘，Web 面板登录后在内存中解密。
- **两个独立密钥**：`DOCK_ADMIN_SECRET` 只用于 Web 面板登录，`DOCK_API_TOKEN` 只用于扩展同步。修改管理员密钥会自动吊销所有 Web 会话。
- **会话有效期**：登录会话默认 30 天，可在 Web 面板「设置 → 服务端访问」调整（1–3650 天），修改后立即裁剪已有会话。
- **主密码**：扩展启用主密码时，上传/恢复要求保险库已解锁；Token 也用主密钥加密后保存在 `chrome.storage.local`。
- **传输与落盘**：域名必须使用 HTTPS；IP 地址（含内网 IP:端口）允许 HTTP，但会明文传输，仅建议内网使用；生产部署请用 Caddy/Nginx/Traefik 终止 TLS。

### Docker 部署

```bash
cp .env.example .env
# 编辑 DOCK_ADMIN_SECRET / DOCK_API_TOKEN / DOCK_DATA_KEY / DOCK_PUBLIC_ORIGIN
docker compose up -d --build
```

- 镜像默认监听 `8080`，SQLite 数据在 `/data/dock.sqlite`，使用命名卷 `dock-data` 持久化。
- 访问 `https://你的域名/`，输入 `DOCK_ADMIN_SECRET` 进入与插件一致的云端管理面板。
- 反向代理需转发到容器 `8080`；保持 `DOCK_COOKIE_SECURE=true`，并设置 `DOCK_PUBLIC_ORIGIN=https://你的域名`。
- 本地 HTTP 调试可设置 `DOCK_COOKIE_SECURE=false`、`DOCK_PUBLIC_ORIGIN=http://localhost:8080`；使用内网 IP 时填 `http://192.168.1.10:8080` 即可。

### 扩展配置

1. 后台面板 → 设置 → 云端同步。
2. 填写云端地址（如 `https://dock.example.com` 或 `http://192.168.1.10:8080`）和 `DOCK_API_TOKEN`，测试连接后保存。
3. 打开「启用云端持久化」开关会立即保存配置并触发首次同步；修改地址/Token 后可点「保存配置」再同步，状态栏会显示云端状态。
4. 「从云端恢复」会按 `updatedAt` 合并云端较新数据，本地较新的记录保留，不删除本地数据；关闭持久化时也可用。
5. 关闭持久化后本地改动（包括清空）不会上传；重新开启后的首次同步不发送删除墓碑，也不会从旧基线推断删除。删除只有在持久化开启时才会同步到云端。
6. 「覆盖云端」仅在持久化开启时可用：以本地数据为准全量上传，删除云端独有记录，用于修复两端数据不一致。

### 备份与密钥轮换

- 备份：停止容器后复制 `/data/dock.sqlite`（包含 WAL 时一并复制），或在运行中用 SQLite `VACUUM INTO`。
- 轮换数据密钥：设置新的 `DOCK_DATA_KEY`，同时把旧值放入 `DOCK_DATA_KEY_OLD` 启动一次；服务会用新密钥重加密并退出旧密钥状态。两项都不匹配时容器会拒绝启动，避免覆盖数据。
- 修改 `DOCK_ADMIN_SECRET` 或 `DOCK_API_TOKEN` 后重启容器即可生效。

### 已知限制

- Web 面板使用内存 IndexedDB：刷新会重新从云端加载，关闭标签会丢弃尚未推送的编辑（有 2 秒防抖和 `pagehide` 尽力推送）。
- 自动同步在打开的后台面板中执行；弹窗新增的数据会先记为待同步，下次打开后台面板时上传。
- 冲突按整条记录 `updatedAt` 后写胜出；同一记录不同字段的并发编辑可能丢失较旧的一次。
- 单进程 SQLite，不支持多副本水平扩展。
- 云端 API Token 使用主密码加密保存在本地；修改或关闭主密码后需要重新输入 Token。

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+K` | 打开弹窗 |
| `Ctrl+Shift+L` | 自动填充当前页面凭据 |
| `Ctrl+K` | 弹窗中聚焦搜索 |
| `Esc` | 关闭弹窗 |

## 数据导入导出

- 支持 Markdown 格式导入/导出所有数据（系统、服务器、中间件、配置）
- 支持 JSON 格式完整备份与恢复
- 云端同步支持按 `updatedAt` 差异化恢复，本地较新的记录不会被覆盖

## License

MIT
