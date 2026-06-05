# PRD-01：项目初始化与基础架构

## 版本信息

| 字段 | 内容 |
|------|------|
| PRD编号 | PRD-01 |
| 版本 | v1.0 |
| 创建日期 | 2026-06-05 |
| 依赖 | 无 |

## 1. 需求概述

搭建整个项目的基础框架，包括 monorepo 结构、前后端脚手架、基础配置文件、工作区目录划分、沙箱安全框架、基础配置管理系统。这是所有后续 PRD 的基石。

## 2. 功能需求

### 2.1 Monorepo 根配置

- 使用 pnpm workspace 管理 monorepo
- 根目录 `package.json` 包含 workspace 脚本：`dev`、`build`、`lint`
- 根 `tsconfig.base.json` 作为共享 TypeScript 配置

**验收标准：**
- `pnpm install` 在根目录执行成功，安装所有子包依赖
- `pnpm dev` 能同时启动前后端

### 2.2 后端脚手架

- Express + TypeScript 项目，入口 `server/src/index.ts`
- 监听端口：默认 3000，可通过环境变量 `PORT` 配置
- 基础中间件：cors、body-parser、morgan（请求日志）
- REST API 前缀：`/api/v1`
- 健康检查端点：`GET /api/v1/health`

**验收标准：**
- `pnpm dev:server` 启动后端，`curl localhost:3000/api/v1/health` 返回 `{ status: "ok" }`

### 2.3 前端脚手架

- Vite + React + TypeScript 项目
- 路由：React Router（hash 路由，本地文件无需 history 模式）
- 状态管理：Zustand
- 样式方案：Tailwind CSS (轻量，适合组件化)
- API 客户端：Axios 封装，统一处理错误与 Loading 状态
- Vite 开发代理：`/api` 转发到后端 3000 端口

**验收标准：**
- `pnpm dev:client` 启动前端，浏览器打开 `localhost:5173` 可见空白工作台页面

### 2.4 工作区目录

创建沙箱工作区目录结构：

```
workspace/
├── originals/       # 原始上传txt文件
├── chapters/        # 拆分后的章节 .txt
├── knowledge/       # 知识库 JSON
│   ├── characters/
│   ├── techniques/
│   ├── locations/
│   ├── worldbuilding/
│   ├── weapons/
│   ├── alchemy/
│   └── plot/
├── settings/        # 待落地设定(隔离区)
├── drafts/          # 草稿/大纲
└── .workspace.lock  # 工作区锁文件
```

**验收标准：**
- 项目启动时自动检测并创建缺失的工作区目录
- `.workspace.lock` 记录工作区版本，兼容性检查

### 2.5 配置管理系统

#### 2.5.1 预设模型配置 (`server/src/config/default.ts`)

```typescript
interface ModelPreset {
  name: string;           // 预设名称
  provider: 'claude' | 'openai' | 'ollama';
  modelId: string;        // 如 claude-opus-4-8
  apiKeyEnv: string;      // 环境变量名，如 ANTHROPIC_API_KEY
  baseUrl?: string;       // 自定义API地址
  defaultFor: string[];   // 默认用于哪些功能: ['extract', 'write', 'brainstorm']
}
```

预设功能类别：
- `extract` — 知识提取
- `write` — AI撰写
- `polish` — AI润色
- `brainstorm` — 头脑风暴
- `chat` — 普通对话

#### 2.5.2 用户配置 (`workspace/user-config.json`)

- 用户可覆盖预设中的模型选择、API Key
- 支持添加自定义 Provider
- 修改后通过 API 热更新

**验收标准：**
- 后端启动时加载预设配置
- 用户可通过 API 修改配置并持久化
- 不同功能可绑定不同模型

### 2.6 沙箱安全框架

- 文件操作工具 `server/src/utils/file.ts`：封装所有文件读写
- 所有文件操作路径必须解析为绝对方路径，并验证其位于 `workspace/` 目录下
- 拒绝 `../` 路径穿越
- 允许的操作：读、写、追加写、删除、列表

**验收标准：**
- 尝试读取 `../../etc/passwd` 路径返回 403 Forbidden
- 所有合法 workspace 内路径操作正常执行

### 2.7 日志系统

- 使用 winston 或 pino 日志库
- 日志级别：debug / info / warn / error
- 输出目标：控制台 + 文件 (`workspace/logs/`)
- 统一格式：`[时间] [级别] [模块] 消息`

**验收标准：**
- 日志同时输出到控制台和文件
- 日志文件按日滚动

## 3. 接口定义

### 3.1 配置相关

```
GET    /api/v1/config            获取当前配置
PUT    /api/v1/config            更新用户配置
GET    /api/v1/config/presets    获取所有预设模型
```

### 3.2 工作区相关

```
GET    /api/v1/workspace/status  工作区状态（目录结构、文件统计）
POST   /api/v1/workspace/init    初始化/重建工作区目录
```

### 3.3 系统相关

```
GET    /api/v1/health            健康检查
GET    /api/v1/system/info       系统信息（版本、运行时间）
```

## 4. 非功能需求

- TypeScript strict 模式开启
- ESLint + Prettier 统一代码风格
- 各子包独立 tsconfig，继承根 tsconfig.base.json
- pnpm-lock.yaml 纳入版本管理

## 5. 文件清单

| 文件 | 说明 |
|------|------|
| `package.json` | Monorepo根配置 |
| `pnpm-workspace.yaml` | pnpm工作空间配置 |
| `tsconfig.base.json` | 共享TS配置 |
| `.eslintrc.cjs` | ESLint配置 |
| `.prettierrc` | Prettier配置 |
| `server/package.json` | 后端包配置 |
| `server/tsconfig.json` | 后端TS配置 |
| `server/src/index.ts` | 后端入口 |
| `server/src/config/default.ts` | 预设模型配置 |
| `server/src/utils/file.ts` | 沙箱文件工具 |
| `server/src/utils/logger.ts` | 日志工具 |
| `server/src/sandbox/index.ts` | 沙箱管理器 |
| `client/package.json` | 前端包配置 |
| `client/vite.config.ts` | Vite配置 |
| `client/src/main.tsx` | 前端入口 |
| `client/src/App.tsx` | 根组件 |
| `client/src/router.tsx` | 路由 |
| `client/src/stores/app.ts` | 全局状态 |
| `client/src/services/api.ts` | API封装 |
| `scripts/requirements.txt` | Python依赖 |

## 6. 验收流程

1. 克隆仓库后执行 `pnpm install && pnpm dev`
2. 浏览器访问 `localhost:5173` 能看到应用
3. `localhost:3000/api/v1/health` 返回正常
4. workspace 目录自动创建
5. 修改配置后 API 返回更新后的配置
6. 尝试路径穿越被拒绝
