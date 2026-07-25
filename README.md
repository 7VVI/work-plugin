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
- 弹窗搜索，一键直达
- 标签分类，高效检索

### 账号管理
- 保存各系统的账号密码
- 自动识别登录页并填充凭据
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
- 多环境筛选（生产/开发/测试/预发）
- 拖拽排序、双击重命名、一键复制所有字段
- 支持 Markdown 格式导入导出

### 安全
- 主密码 (PBKDF2 + AES-GCM) 加密
- 自动锁定（空闲超时）
- 本地 IndexedDB 存储，数据不上传

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
| 测试 | Vitest + @vue/test-utils |

## 项目结构

```
src/
├── background/       # Service Worker（快捷键、右键菜单、消息通信）
├── content/          # Content Script（自动填充、页面检测）
├── dashboard/        # 管理面板（Vue SPA）
│   ├── components/   # 公共/布局/业务组件
│   ├── views/        # 路由视图
│   └── styles/       # 设计令牌 & 全局样式
├── popup/            # 弹窗（快速搜索 & 收藏）
└── shared/           # 跨模块共享
    ├── crypto/       # 加密模块
    ├── db/           # Dexie 数据库 & 仓库
    ├── services/     # 业务服务层
    ├── stores/       # Pinia 状态
    ├── types/        # TypeScript 类型
    └── utils/        # 工具函数
```

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器（HMR）
npm run dev

# 类型检查
npm run type-check

# 构建生产版本
npm run build

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

## License

MIT
