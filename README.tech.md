# AI 写文助手 — 技术文档

> 面向开发者与 AI 的项目架构、技术栈与修改指引

---

## 项目概述

**AI 写文助手**（writing-assistant）是一个 pnpm monorepo 项目，为长篇小说作者提供本地化 AI 辅助写作工具。采用前后端分离架构，前端 React SPA 通过 REST + WebSocket 与 Express 后端通信，后端整合 Claude Agent SDK 实现 AI 知识提取、写作生成与头脑风暴等功能。

---

## 项目结构

```
writing-assistant/
├── .env.example                  # 环境变量模板（API Key 配置）
├── .eslintrc.cjs                 # ESLint 共享配置（TypeScript + React Hooks）
├── .prettierrc                   # Prettier 格式化规则
├── .gitignore                    # 忽略 node_modules、dist、workspace/*
├── pnpm-workspace.yaml           # pnpm monorepo 工作区定义（server, client）
├── tsconfig.base.json            # 共享 TypeScript 配置（ES2022, strict）
├── package.json                  # monorepo 根：dev/build/lint/format 脚本
├── pnpm-lock.yaml                # 锁定文件（已纳入版本控制）
│
├── doc/                          # 项目文档与 PRD
│   ├── project-plan.md           # 项目总览与数据流
│   ├── prd-01~08.md              # 8 个模块的 PRD
│   └── codeReview/               # 验收报告（每个 PRD 对应一个）
│
├── client/                       # 前端：React 19 + Vite 6 + TypeScript
│   ├── index.html                # HTML 入口
│   ├── vite.config.ts            # Vite 配置（代理 /api → :3000, /ws → ws://:3000）
│   ├── tsconfig.json             # TypeScript 配置（ESNext, bundler, react-jsx）
│   ├── tailwind.config.js        # Tailwind 设计令牌（品牌色、字体、阴影、动画）
│   ├── postcss.config.js         # PostCSS（Tailwind + Autoprefixer）
│   ├── package.json              # 前端依赖
│   └── src/
│       ├── main.tsx              # React 入口（React.StrictMode + RouterProvider）
│       ├── router.tsx            # HashRouter 路由表（9 条路由）
│       ├── App.tsx               # 根布局：顶栏导航 + <Outlet />
│       ├── pages/                # 页面组件（10 个）
│       ├── components/           # 功能组件（6 个子目录）
│       │   ├── ui/               # 基础 UI：Button, Card, Modal, Drawer, Input, Badge, PageShell
│       │   ├── chapter/          # 章节：Uploader, List, Editor, AnomalyBadge, MergeModal
│       │   ├── writing/          # 写文：WritingLayout, OutlineEditor, AiToolbar, Sidebar, DraftManager, PriorKnowledgePanel
│       │   ├── editor/           # 编辑器：TipTapEditor（含浮动菜单）, DiffView
│       │   ├── knowledge/        # 知识：List, Detail, ConflictResolver, ExtractTask, TrashPanel, VersionTimeline
│       │   ├── graph/            # 图谱：GraphCanvas, GraphFilter, NodeDetail
│       │   ├── brainstorm/       # 头脑风暴：ChatWindow, SessionList, ConclusionPanel
│       │   ├── settings/         # 设定：SettingEditor, ReferencePanel, MigrateDialog
│       │   ├── config/           # 配置：ModelList, FunctionMapping, ApiKeyInput
│       │   └── home/             # 首页：WelcomeBanner, StatCards, QuickEntries, TodoPanel, RecentChanges
│       ├── hooks/                # Zustand 状态管理（8 个领域 store，按功能命名 useXxx）
│       ├── services/             # API 客户端（Axios 实例 + 各领域 API 函数）
│       ├── stores/               # 全局 store（app.ts：健康状态、侧边栏）
│       └── styles/               # 全局 CSS（Tailwind 基础 + 自定义工具类）
│
├── server/                       # 后端：Node.js + Express 5 + TypeScript
│   ├── tsconfig.json             # TypeScript 配置（node16）
│   ├── package.json              # 后端依赖
│   └── src/
│       ├── index.ts              # 服务入口：Express 初始化、中间件挂载、WebSocket 附加
│       ├── routes/               # API 路由层（薄处理，验证输入 → 调用服务 → 返回 JSON）
│       │   ├── api.ts            # 系统路由：/health, /system/info, /workspace/status
│       │   ├── chapters.ts       # 章节上传/拆分/合并/确认
│       │   ├── extract.ts        # 知识提取任务启动/状态/取消
│       │   ├── skills.ts         # 提取技能 CRUD
│       │   ├── knowledge.ts      # 冲突解决
│       │   ├── knowledge-management.ts  # 知识条目 CRUD/搜索/图谱/导入导出
│       │   ├── writing.ts        # 写作操作：RAG检索/生成/续写/润色/扩写/缩写/改写/伏笔检查
│       │   ├── settings.ts       # 设定文件 CRUD/引用/迁移
│       │   ├── brainstorm.ts     # 头脑风暴会话/消息/结论提取
│       │   └── config.ts         # 模型配置/功能映射/连接测试/上下文统计
│       ├── agents/               # AI 智能体层
│       │   ├── index.ts          # ExtractionManager：提取任务生命周期 + WebSocket 广播
│       │   ├── client.ts         # AI 客户端抽象：Claude/OpenAI/Ollama 多提供商，指数退避重试
│       │   ├── extractor.ts      # 知识提取引擎：逐章遍历，每章并发运行启用技能
│       │   ├── writer.ts         # 写作智能体：7 种操作，工具调用结构化输出
│       │   ├── brainstorm.ts     # 头脑风暴智能体：多轮对话、上下文截断、结论提取
│       │   └── skills/           # 技能系统
│       │       ├── types.ts      # Skill 接口定义
│       │       ├── registry.ts   # 技能注册表（内置 + 磁盘加载自定义技能）
│       │       └── builtins/     # 7 个内置技能：character, technique, location, worldbuilding, weapon, alchemy, plot
│       ├── services/             # 业务逻辑层
│       │   ├── splitter.ts       # Python 章节拆分编排（child_process.spawn）
│       │   ├── chunker.ts        # 长文本智能分块（段落边界 + 500 字符重叠）
│       │   ├── knowledge.ts      # 知识合并引擎（名称相似度 + Levenshtein、冲突检测）
│       │   ├── knowledge-management.ts  # 知识 CRUD、软删除、版本管理
│       │   ├── rag.ts            # RAG 检索（命名实体 + n-gram + FTS5 加权合并）
│       │   ├── writing.ts        # 写作业务编排（检索 → AI 生成 → diff 计算）
│       │   ├── settings.ts       # 设定文件管理（Markdown 前端内容解析、迁移）
│       │   ├── brainstorm-sessions.ts  # 会话 .md 持久化、对话历史管理
│       │   ├── config.ts         # 配置持久化（user-config.json）、Key 屏蔽
│       │   ├── graph.ts          # 图谱数据构建（遍历 relations → 节点/边）
│       │   └── export-import.ts  # ZIP 导出/导入（archiver + unzipper）
│       ├── db/                   # 数据库层
│       │   └── knowledge.ts      # sql.js (WASM) SQLite：FTS5 全文搜索、索引同步
│       ├── sandbox/              # 安全沙箱
│       │   ├── index.ts          # SandboxManager：工作区初始化、版本锁定、目录创建
│       │   └── policies.ts       # 安全策略：系统文件保护、扩展名白名单、文件名验证
│       ├── utils/                # 工具层
│       │   ├── file.ts           # 安全文件操作（路径解析 + symlink 跟随 + 边界检查）
│       │   ├── logger.ts         # Winston 日志（按日轮转、30天保留、API Key 脱敏）
│       │   ├── context.ts        # 上下文管理（知识截断、对话历史截断、摘要生成）
│       │   ├── tokenizer.ts      # Token 估算（TokenBudget 类、中日韩字符启发式）
│       │   └── mutex.ts          # Promise 互斥锁 + TaskQueue（按功能类型的并发控制）
│       ├── middleware/            # Express 中间件
│       │   ├── rateLimit.ts      # 三层限流：全局(120/min)、AI(10/min)、上传(5/min)
│       │   ├── upload.ts         # Multer 配置：仅 .txt、50MB 限制、内存存储
│       │   └── validate.ts       # Zod 验证 + XSS 清洗（16 种模式）
│       └── ws/                   # WebSocket
│           └── handler.ts        # 提取任务进度广播、心跳、房间订阅
│
├── scripts/                      # Python 脚本
│   ├── text_splitter.py          # 章节拆分（正则匹配、编号生成）
│   └── split_validator.py        # 异常检测（不一致性检查）
│
└── workspace/                    # 🏠 用户数据目录（运行时生成）
    ├── .workspace.lock           # 工作区版本锁
    ├── originals/                # 原始上传文件
    ├── chapters/                 # 拆分后章节 + _meta.json
    ├── knowledge/                # 知识 JSON + _index.db + _skills/ + _trash/
    ├── settings/                 # 设定 .md 文件
    ├── drafts/                   # 写作草稿 JSON
    └── logs/                     # 应用日志（按日轮转）
```

---

## 技术栈详情

### 前端

| 技术 | 版本 | 用途 | 关键文件 |
|------|------|------|---------|
| React | ^19.0 | UI 框架 | `client/src/main.tsx` |
| Vite | ^6.0 | 构建工具 | `client/vite.config.ts` |
| TypeScript | ^5.7 | 类型系统 | `client/tsconfig.json` |
| Tailwind CSS | ^3.4 | 原子化 CSS | `client/tailwind.config.js` |
| React Router | ^7.0 | Hash 路由 | `client/src/router.tsx` |
| Zustand | ^5.0 | 状态管理 | `client/src/hooks/use*.ts`, `client/src/stores/app.ts` |
| TipTap | ^3.26 | 富文本编辑器 | `client/src/components/editor/TipTapEditor.tsx` |
| Cytoscape.js | ^3.34 | 知识图谱可视化 | `client/src/components/graph/GraphCanvas.tsx` |
| Axios | ^1.7 | HTTP 客户端 | `client/src/services/api.ts` |

### 后端

| 技术 | 版本 | 用途 | 关键文件 |
|------|------|------|---------|
| Express | ^4.21 | HTTP 框架 | `server/src/index.ts` |
| TypeScript | ^5.7 | 类型系统 | `server/tsconfig.json` |
| Claude SDK | ^0.101 | AI 客户端 | `server/src/agents/client.ts` |
| sql.js | ^1.14 | SQLite (WASM) | `server/src/db/knowledge.ts` |
| Zod | ^3.24 | 输入验证 | `server/src/types/knowledge.ts`, `server/src/middleware/validate.ts` |
| Winston | ^3.17 | 日志系统 | `server/src/utils/logger.ts` |
| ws | ^8.21 | WebSocket | `server/src/ws/handler.ts` |
| Multer | ^2.1 | 文件上传 | `server/src/middleware/upload.ts` |
| diff | ^9.0 | 文本差异计算 | `server/src/services/writing.ts` |
| archiver + unzipper | — | ZIP 导入导出 | `server/src/services/export-import.ts` |

---

## 架构设计

### 分层架构

```
┌─────────────────────────────────────────────┐
│  浏览器 (React SPA, Hash Router)             │
├─────────────────────────────────────────────┤
│  Pages ──▶ Components ──▶ UI Primitives      │
│    │                                          │
│    ▼                                          │
│  Hooks/Stores (Zustand)                       │
│    │                                          │
│    ▼                                          │
│  Services (Axios → /api/v1/*)                 │
├─────────────────────────────────────────────┤
│  HTTP / WebSocket ──▶ Vite Proxy ──▶ :3000   │
├─────────────────────────────────────────────┤
│  Express Server                              │
├─────────────────────────────────────────────┤
│  Middleware (RateLimit → CORS → Morgan)       │
│    │                                          │
│    ▼                                          │
│  Routes (validate → service → respond)        │
│    │                                          │
│    ▼                                          │
│  Services (business logic)                    │
│    │                                          │
│    ▼                                          │
│  Agents (AI client → extractor/writer/...)    │
│    │               │                          │
│    ▼               ▼                          │
│  Utils (file, log, context, tokenizer)        │
│    │               │                          │
│    ▼               ▼                          │
│  DB (sql.js FTS5)  Sandbox (file ops)        │
├─────────────────────────────────────────────┤
│  文件系统 (workspace/)                        │
└─────────────────────────────────────────────┘
```

### 数据流

```
原始 .txt → [Python 拆分] → 章节文件 → [Agent + Skill] → 知识 JSON
                                                              ↓
                                                   [SQLite FTS5 索引]
                                                              ↓
作者大纲 → [RAG 检索知识库] ← [Agent 撰写] → 草稿 → [Agent 润色] → 完成
```

---

## 后端架构详解

### 路由 → 服务 → 智能体 调用链

后端的核心调用模式：**Route（验证+响应）→ Service（编排）→ Agent（AI 调用）→ Utils/DB（底层操作）**

#### 示例：写作生成流程

```
POST /api/v1/writing/generate
  → routes/writing.ts: validateBody(schema) → writingService.generate()
    → services/writing.ts: ragService.retrieve() → agentWriter.generate()
      → agents/writer.ts: buildSystemPrompt() → aiClient.chat()
        → agents/client.ts: anthropic.messages.create() [with tool_use]
      → agents/writer.ts: parseToolCallResult() → return { body, changes }
    → services/writing.ts: diffWords(original, body) → return { body, diff }
  → routes/writing.ts: res.json({ body, diff })
```

### 路由文件职责

| 路由文件 | 限流层 | 关键端点 |
|---------|--------|---------|
| `routes/api.ts` | globalLimiter | GET /health, GET /system/info, GET|POST /workspace/* |
| `routes/chapters.ts` | uploadLimiter | POST /upload, POST /split, POST /merge, POST /confirm |
| `routes/extract.ts` | aiLimiter | POST /start, GET /:taskId/status, POST /:taskId/cancel |
| `routes/skills.ts` | aiLimiter | CRUD /, POST /:id/generate (AI 辅助生成技能提示词) |
| `routes/writing.ts` | aiLimiter | POST /retrieve, /generate, /continue, /polish, /expand, /shorten, /rewrite, /check-foreshadowing |
| `routes/brainstorm.ts` | aiLimiter | CRUD /sessions, POST /:id/message, /:id/extract, /:id/convert |
| `routes/knowledge.ts` | globalLimiter | GET /conflicts, PUT /conflicts/:id, POST /conflicts/batch |
| `routes/knowledge-management.ts` | globalLimiter | CRUD /entries, /search, /graph, /trash, /export, /import |
| `routes/settings.ts` | globalLimiter | CRUD /, POST /migrate, POST /migrate/confirm |
| `routes/config.ts` | adminLimiter | CRUD /models, GET|PUT /function-mapping, POST /:id/test |

### AI 智能体系统

**多提供商 AI 客户端** (`agents/client.ts`)：
- 支持 Claude (Anthropic SDK)、OpenAI (Chat Completions)、Ollama (本地)
- 指数退避重试（最多 3 次）
- 模型解析：功能映射 → 用户自定义预设 → 默认模型

**知识提取** (`agents/extractor.ts`)：
- 逐章遍历所有已确认章节
- 每章并发运行所有启用的技能（通过 `Promise.all`）
- 技能通过 `tools` 参数调用 AI 的结构化输出

**写作智能体** (`agents/writer.ts`)：
- 7 种操作模式：generate、continue、polish、expand、shorten、rewrite、checkForeshadowing
- 每种操作有不同的系统提示词和工具定义
- 使用 Anthropic tool_use 实现结构化输出

**头脑风暴智能体** (`agents/brainstorm.ts`)：
- 多轮对话管理
- 知识库上下文增强（RAG 检索后注入）
- 对话历史截断（保留置顶消息）
- 结论提取（结构化输出）

**技能系统** (`agents/skills/`)：
```
Skill 接口 = {
  id, name, category, description,
  systemPrompt, userPromptTemplate,
  resultSchema (JSON Schema), enabled
}
```
- 7 个内置技能（builtins/）：character, technique, location, worldbuilding, weapon, alchemy, plot
- 自定义技能存储在 `workspace/knowledge/_skills/*.json`
- 启动时 `registry.ts` 从磁盘加载自定义技能并合并

---

## 前端架构详解

### 页面 → 组件 → Store → Service 数据流

```
Pages (page shell)
  ├── 读取 Zustand store 的状态
  ├── 渲染 Components
  │     ├── 用户交互触发 store action
  │     │     └── store action 调用 service API 函数
  │     │           └── Axios 发送 HTTP 请求到后端
  │     │                 └── 响应返回 → store 更新状态 → React 重新渲染
  │     └── 展示 UI 状态
  └── 管理页面级生命周期
```

### 路由表

| 路径 | 页面组件 | 加载方式 | 主要数据 Store |
|------|---------|---------|---------------|
| `/` | HomePage | 直接导入 | useAppStore |
| `/chapters` | ChaptersPage | lazy | useChapters |
| `/knowledge` | KnowledgePage | lazy | useKnowledge + WebSocket |
| `/knowledge-management` | KnowledgeManagementPage | lazy | useKnowledgeManagement |
| `/graph` | GraphPage | lazy | useKnowledgeManagement |
| `/writing` | WritingPage | lazy | useWriting |
| `/settings` | SettingsPage | lazy | useSettings |
| `/brainstorm` | BrainstormPage | lazy | useBrainstorm |
| `/config` | ConfigPage | lazy | useConfig |

### Zustand Store 模式

每个领域 store 遵循统一模式：

```typescript
// 以 useWriting 为例 (client/src/hooks/useWriting.ts)
const useWriting = create<WritingState>((set, get) => ({
  // 状态
  mode: 'outline',
  outline: '',
  body: '',
  isLoading: false,

  // 操作
  setMode: (mode) => set({ mode }),
  generate: async () => {
    set({ isLoading: true });
    const result = await writingService.generate(get().outline);
    set({ body: result.body, diff: result.diff, isLoading: false });
  },
}));
```

### API 客户端

`client/src/services/api.ts` 是 Axios 单例：
- `baseURL: '/'` → 请求由 Vite 代理转发到 `localhost:3000`
- 30 秒超时
- 响应拦截器：分类处理 400/403/404/429/500 错误并记录日志
- 请求拦截器：预留给未来认证 Token

---

## 数据库设计

采用 **SQLite + JSON 双存储** 机制：

### JSON 文件存储（主存储）
- 每个知识条目一个 JSON 文件，路径为 `workspace/knowledge/{category}/{id}.json`
- 包含完整数据：attributes、description、relations、source、versionHistory、conflicts
- 支持手动编辑、版本回溯

### SQLite 搜索索引（加速查询）
- 使用 **sql.js**（纯 WASM 实现，无需原生编译）
- 数据库文件：`workspace/knowledge/_index.db`
- FTS5 全文搜索：`knowledge_fts` 虚拟表覆盖 name + aliases
- 自动同步触发器：条目更新时同步重建 FTS 索引
- 回退机制：FTS5 不可用时使用 SQL `LIKE` 查询 + category/name 索引

### 数据变更日志
- `workspace/knowledge/_changes.json` 记录最近变更
- 首页「最近变更」和知识库「变更横幅」均从此读取

---

## 安全设计

### 沙箱隔离 (`server/src/sandbox/`)
- **边界检查**：`validatePathAsync()` 解析所有 `..` 段 → `fs.realpath` 跟随符号链接 → 检查结果路径前缀是否为工作区根目录
- **系统文件保护**：`.workspace.lock`、`_meta.json`、`user-config.json` 不可通过常规 API 修改
- **文件名验证**：禁止路径分隔符、`..`、空字节

### 速率限制 (`server/src/middleware/rateLimit.ts`)
| 限流器 | 限制 | 适用范围 |
|--------|------|---------|
| globalLimiter | 120 req/min | 所有路由 |
| aiLimiter | 10 req/min | extract, writing, brainstorm |
| uploadLimiter | 5 req/min | chapters |

### 输入验证 (`server/src/middleware/validate.ts`)
- **Zod 模式**：所有请求体类型定义和验证在 `server/src/types/knowledge.ts`
- **XSS 清洗**：`sanitizeMiddleware()` 移除 `<script>`、内联事件、`eval()` 等 16 种攻击模式
- **文本长度限制**：50000 字符

### API Key 安全
- Key 仅存于 `.env` → 启动后 `dotenv` 加载到 `process.env` → 仅内存中存在
- **日志脱敏** (`server/src/utils/logger.ts`)：`sanitizeLogMessage()` 检测 5 类 Key 格式并替换为 `[REDACTED]`
- **前端屏蔽** (`server/src/services/config.ts`)：`sanitizeConfigForResponse()` 返回 `sk-a***xxxx` 掩码
- **健康检查排除**：`/api/v1/health` 不打印日志，不影响日志轮转

---

## AI 修改指引

> 以下是按功能模块整理的**文件路径对照表**。当你需要修改某个功能时，从对应路径入手。

### 章节管理
| 修改目标 | 后端文件 | 前端文件 |
|---------|---------|---------|
| 上传处理逻辑 | `server/src/routes/chapters.ts` (POST /upload) | `client/src/components/chapter/Uploader.tsx` |
| 拆分规则 | `server/src/services/splitter.ts` → `scripts/text_splitter.py` | — |
| 拆分异常检测 | `server/src/services/splitter.ts` → `scripts/split_validator.py` | `client/src/components/chapter/AnomalyDetail.tsx` |
| 章节列表 | `server/src/routes/chapters.ts` (GET /, GET /:id) | `client/src/components/chapter/ChapterList.tsx` |
| 章节编辑 | `server/src/routes/chapters.ts` (PUT /:id) | `client/src/components/chapter/ChapterEditor.tsx` |
| 合并/确认 | `server/src/routes/chapters.ts` (POST /merge, /confirm) | `client/src/components/chapter/MergeModal.tsx, ConfirmDialog.tsx` |
| Store | — | `client/src/hooks/useChapters.ts` |
| API 函数 | — | `client/src/services/chapters.ts` |

### 知识提取
| 修改目标 | 后端文件 | 前端文件 |
|---------|---------|---------|
| 提取任务管理 | `server/src/agents/index.ts` (ExtractionManager) | `client/src/components/knowledge/ExtractTask.tsx` |
| 提取引擎 | `server/src/agents/extractor.ts` (runExtractionTask) | — |
| AI 客户端调用 | `server/src/agents/client.ts` (chat, chatWithTools) | — |
| 合并逻辑 | `server/src/services/knowledge.ts` (mergeEntries, detectConflicts) | — |
| 技能定义 | `server/src/agents/skills/types.ts` | `client/src/components/skill/SkillEditor.tsx` |
| 内置技能 | `server/src/agents/skills/builtins/*.ts` | — |
| 技能注册表 | `server/src/agents/skills/registry.ts` | — |
| 冲突解决 | `server/src/routes/knowledge.ts` (conflicts) | `client/src/components/knowledge/ConflictResolver.tsx` |
| WebSocket 进度 | `server/src/ws/handler.ts` | `client/src/hooks/useExtractionWebSocket.ts` |
| Store | — | `client/src/hooks/useKnowledge.ts` |
| API 函数 | — | `client/src/services/knowledge.ts` |

### 知识库管理
| 修改目标 | 后端文件 | 前端文件 |
|---------|---------|---------|
| CRUD 操作 | `server/src/services/knowledge-management.ts` | `client/src/components/knowledge/KnowledgeList.tsx, KnowledgeDetail.tsx` |
| 搜索 | `server/src/db/knowledge.ts` (FTS5) + `server/src/services/knowledge-management.ts` | `client/src/pages/KnowledgeManagement.tsx` |
| 版本历史 | `server/src/services/knowledge-management.ts` (getVersionHistory) | `client/src/components/knowledge/VersionTimeline.tsx` |
| 回收站 | `server/src/services/knowledge-management.ts` (软删除/恢复) | `client/src/components/knowledge/TrashPanel.tsx` |
| 导出导入 | `server/src/services/export-import.ts` | `client/src/pages/KnowledgeManagement.tsx` |
| Store | — | `client/src/hooks/useKnowledgeManagement.ts` |
| API 函数 | — | `client/src/services/knowledge-management.ts` |

### 知识图谱
| 修改目标 | 后端文件 | 前端文件 |
|---------|---------|---------|
| 图谱数据 | `server/src/services/graph.ts` (buildGraphData, expandNode) | — |
| 图谱路由 | `server/src/routes/knowledge-management.ts` (GET /graph/*) | — |
| 可视化渲染 | — | `client/src/components/graph/GraphCanvas.tsx` |
| 筛选 | — | `client/src/components/graph/GraphFilter.tsx` |
| 节点详情 | — | `client/src/components/graph/NodeDetail.tsx` |

### 写文窗口
| 修改目标 | 后端文件 | 前端文件 |
|---------|---------|---------|
| RAG 检索 | `server/src/services/rag.ts` (检索管道) | — |
| 写作生成 | `server/src/agents/writer.ts` (generate, continue, polish...) | — |
| 写作业务编排 | `server/src/services/writing.ts` (检索→生成→diff) | — |
| 大纲编辑器 | — | `client/src/components/writing/OutlineEditor.tsx` |
| 正文编辑器 | — | `client/src/components/editor/TipTapEditor.tsx` |
| AI 操作工具栏 | — | `client/src/components/writing/AiToolbar.tsx` |
| 浮动菜单 | — | `client/src/components/editor/TipTapEditor.tsx` (BubbleMenu) |
| Diff 展示 | `server/src/services/writing.ts` (diffWords) | `client/src/components/editor/DiffView.tsx` |
| 先验知识面板 | — | `client/src/components/writing/PriorKnowledgePanel.tsx` |
| 写作助手侧边栏 | — | `client/src/components/writing/WritingSidebar.tsx` |
| 草稿管理 | `server/src/routes/writing.ts` (Drafts CRUD) | `client/src/components/writing/DraftManager.tsx` |
| 主布局 | — | `client/src/components/writing/WritingLayout.tsx` |
| Store | — | `client/src/hooks/useWriting.ts` |
| API 函数 | — | `client/src/services/writing.ts` |

### 设定构思
| 修改目标 | 后端文件 | 前端文件 |
|---------|---------|---------|
| 设定 CRUD | `server/src/services/settings.ts` | `client/src/components/settings/SettingEditor.tsx` |
| 知识引用 | `server/src/services/settings.ts` (addReference) | `client/src/components/settings/ReferencePanel.tsx` |
| 迁移 | `server/src/services/settings.ts` (migrate) | `client/src/components/settings/MigrateDialog.tsx` |
| Store | — | `client/src/hooks/useSettings.ts` |
| API 函数 | — | `client/src/services/settings.ts` |

### 头脑风暴
| 修改目标 | 后端文件 | 前端文件 |
|---------|---------|---------|
| 会话管理 | `server/src/services/brainstorm-sessions.ts` | `client/src/components/brainstorm/SessionList.tsx` |
| 消息发送 | `server/src/agents/brainstorm.ts` (sendMessage) | `client/src/components/brainstorm/ChatWindow.tsx` |
| 结论提取 | `server/src/agents/brainstorm.ts` (extractConclusions) | `client/src/components/brainstorm/ConclusionPanel.tsx` |
| Store | — | `client/src/hooks/useBrainstorm.ts` |
| API 函数 | — | `client/src/services/brainstorm.ts` |

### 系统配置
| 修改目标 | 后端文件 | 前端文件 |
|---------|---------|---------|
| 配置管理 | `server/src/services/config.ts` | — |
| 默认配置 | `server/src/config/default.ts` | — |
| 模型预设 | `server/src/services/config.ts` | `client/src/components/config/ModelList.tsx` |
| 功能映射 | `server/src/services/config.ts` | `client/src/components/config/FunctionMapping.tsx` |
| API Key 显示 | `server/src/services/config.ts` (sanitizeConfigForResponse) | `client/src/components/config/ApiKeyInput.tsx` |
| Store | — | `client/src/hooks/useConfig.ts` |
| API 函数 | — | `client/src/services/config.ts` |

### 通用/基础
| 修改目标 | 文件 |
|---------|------|
| 全局样式/主题 | `client/tailwind.config.js`, `client/src/styles/index.css` |
| UI 基础组件 | `client/src/components/ui/*.tsx` |
| 路由 | `client/src/router.tsx`, `client/src/App.tsx` |
| 全局 Store | `client/src/stores/app.ts` |
| 日志系统 | `server/src/utils/logger.ts` |
| 文件安全 | `server/src/utils/file.ts`, `server/src/sandbox/policies.ts` |
| 中间件 | `server/src/middleware/*.ts` |
| 数据库 | `server/src/db/knowledge.ts` |
| 上下文管理 | `server/src/utils/context.ts` |
| Token 估算 | `server/src/utils/tokenizer.ts` |

---

## 开发命令

```bash
# 安装依赖
pnpm install

# 启动开发环境（前后端同时启动）
pnpm dev

# 单独启动后端（端口 3000）
pnpm dev:server

# 单独启动前端（端口 5173）
pnpm dev:client

# 构建生产版本
pnpm build

# 代码检查
pnpm lint

# 代码格式化
pnpm format
```

---

## 扩展指南

### 添加新的知识分类

1. 在 `server/src/agents/skills/builtins/` 创建新技能文件
2. 在 `server/src/agents/skills/registry.ts` 注册
3. 在 `server/src/sandbox/index.ts` 的 `WORKSPACE_DIRS` 添加新分类目录
4. 在 `server/src/services/knowledge.ts` 的合并逻辑中添加新分类
5. 在前端知识库组件中添加对应的 UI 展示

### 添加新的写作操作

1. 在 `server/src/agents/writer.ts` 添加新的操作函数和系统提示词
2. 在 `server/src/services/writing.ts` 编排新操作的业务逻辑
3. 在 `server/src/routes/writing.ts` 添加新端点
4. 在 `client/src/services/writing.ts` 添加 API 函数
5. 在 `client/src/components/writing/AiToolbar.tsx` 或 `client/src/components/editor/TipTapEditor.tsx` 添加入口按钮

### 添加新的 AI 模型提供商

1. 在 `server/src/agents/client.ts` 添加新的 provider 分支（参考现有的 Claude/OpenAI 实现）
2. 在 `server/src/services/config.ts` 的模型解析逻辑中注册
3. 在 `server/src/config/default.ts` 添加默认预设
4. 在 `client/src/components/config/ModelList.tsx` 确保 UI 支持新提供商

### 添加自定义提取技能（运行时）

无需修改代码 — 在知识提取页面通过 UI 创建新技能，系统会自动：
1. 保存到 `workspace/knowledge/_skills/{id}.json`
2. 通过 `registry.ts` 加载到提取流程
3. AI 辅助生成技能提示词（调用 `POST /api/v1/skills/:id/generate`）

---

## 版本

- 项目版本：v0.1.0
- 文档更新：2026-06-07
