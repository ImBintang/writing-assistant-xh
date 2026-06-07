# AI Writing Assistant — Technical Documentation

> Project architecture, tech stack, and modification guide for developers and AI

---

## Project Overview

**AI Writing Assistant** (writing-assistant) is a pnpm monorepo providing a locally-running AI-assisted novel writing tool. It uses a frontend-backend separated architecture: a React SPA communicates with an Express backend via REST + WebSocket, while the backend integrates the Claude Agent SDK for AI-powered knowledge extraction, writing generation, and brainstorming.

---

## Project Structure

```
writing-assistant/
├── .env.example                  # Environment variable template (API keys)
├── .eslintrc.cjs                 # Shared ESLint config (TypeScript + React Hooks)
├── .prettierrc                   # Prettier formatting rules
├── .gitignore                    # Ignores node_modules, dist, workspace/*
├── pnpm-workspace.yaml           # pnpm monorepo workspace definition (server, client)
├── tsconfig.base.json            # Shared TS config (ES2022, strict)
├── package.json                  # Monorepo root: dev/build/lint/format scripts
├── pnpm-lock.yaml                # Lock file (committed to VCS)
│
├── doc/                          # Project docs & PRDs
│   ├── project-plan.md           # Project overview & data flow
│   ├── prd-01~08.md              # 8 module PRDs
│   └── codeReview/               # Acceptance reports (one per PRD)
│
├── client/                       # Frontend: React 19 + Vite 6 + TypeScript
│   ├── index.html                # HTML entry point
│   ├── vite.config.ts            # Vite config (proxies /api → :3000, /ws → ws://:3000)
│   ├── tsconfig.json             # TS config (ESNext, bundler, react-jsx)
│   ├── tailwind.config.js        # Tailwind design tokens (brand colors, fonts, shadows, animations)
│   ├── postcss.config.js         # PostCSS (Tailwind + Autoprefixer)
│   ├── package.json              # Frontend dependencies
│   └── src/
│       ├── main.tsx              # React entry (StrictMode + RouterProvider)
│       ├── router.tsx            # HashRouter route table (9 routes)
│       ├── App.tsx               # Root layout: sticky nav header + <Outlet />
│       ├── pages/                # Page components (10)
│       ├── components/           # Feature components (6 subdirectories)
│       │   ├── ui/               # UI primitives: Button, Card, Modal, Drawer, Input, Badge, PageShell
│       │   ├── chapter/          # Chapter: Uploader, List, Editor, AnomalyBadge, MergeModal
│       │   ├── writing/          # Writing: WritingLayout, OutlineEditor, AiToolbar, Sidebar, DraftManager, PriorKnowledgePanel
│       │   ├── editor/           # Editor: TipTapEditor (floating menu), DiffView
│       │   ├── knowledge/        # Knowledge: List, Detail, ConflictResolver, ExtractTask, TrashPanel, VersionTimeline
│       │   ├── graph/            # Graph: GraphCanvas, GraphFilter, NodeDetail
│       │   ├── brainstorm/       # Brainstorm: ChatWindow, SessionList, ConclusionPanel
│       │   ├── settings/         # Settings: SettingEditor, ReferencePanel, MigrateDialog
│       │   ├── config/           # Config: ModelList, FunctionMapping, ApiKeyInput
│       │   └── home/             # Home: WelcomeBanner, StatCards, QuickEntries, TodoPanel, RecentChanges
│       ├── hooks/                # Zustand state management (8 domain stores, named useXxx)
│       ├── services/             # API client (Axios instance + per-domain API functions)
│       ├── stores/               # Global store (app.ts: health status, sidebar)
│       └── styles/               # Global CSS (Tailwind base + custom utilities)
│
├── server/                       # Backend: Node.js + Express 5 + TypeScript
│   ├── tsconfig.json             # TS config (node16)
│   ├── package.json              # Backend dependencies
│   └── src/
│       ├── index.ts              # Server entry: Express init, middleware, WebSocket attachment
│       ├── routes/               # API route layer (thin: validate → service → respond)
│       │   ├── api.ts            # System: /health, /system/info, /workspace/*
│       │   ├── chapters.ts       # Chapter upload/split/merge/confirm
│       │   ├── extract.ts        # Extraction task start/status/cancel
│       │   ├── skills.ts         # Skill CRUD + AI-assisted prompt generation
│       │   ├── knowledge.ts      # Conflict resolution
│       │   ├── knowledge-management.ts  # Entry CRUD/search/graph/import-export
│       │   ├── writing.ts        # Writing ops: RAG → generate/continue/polish/expand/shorten/rewrite/foreshadowing
│       │   ├── settings.ts       # Setting file CRUD/reference/migration
│       │   ├── brainstorm.ts     # Brainstorm sessions/messages/conclusion extraction
│       │   └── config.ts         # Model presets/function mapping/connection test/context stats
│       ├── agents/               # AI agent layer
│       │   ├── index.ts          # ExtractionManager: task lifecycle + WebSocket broadcast
│       │   ├── client.ts         # AI client abstraction: Claude/OpenAI/Ollama multi-provider, exponential backoff
│       │   ├── extractor.ts      # Knowledge extraction engine: per-chapter, concurrent skills
│       │   ├── writer.ts         # Writing agent: 7 operations, tool-call structured output
│       │   ├── brainstorm.ts     # Brainstorm agent: multi-turn, context truncation, conclusion extraction
│       │   └── skills/           # Skill system
│       │       ├── types.ts      # Skill interface definition
│       │       ├── registry.ts   # Skill registry (builtins + disk-loaded customs)
│       │       └── builtins/     # 7 built-in skills: character, technique, location, worldbuilding, weapon, alchemy, plot
│       ├── services/             # Business logic layer
│       │   ├── splitter.ts       # Python chapter splitter orchestration (child_process.spawn)
│       │   ├── chunker.ts        # Intelligent text chunking (paragraph boundaries + 500-char overlap)
│       │   ├── knowledge.ts      # Knowledge merge engine (name similarity + Levenshtein, conflict detection)
│       │   ├── knowledge-management.ts  # Entry CRUD, soft delete, version history
│       │   ├── rag.ts            # RAG retrieval (named entity + n-gram + FTS5 weighted merge)
│       │   ├── writing.ts        # Writing orchestration (retrieve → AI generate → diff compute)
│       │   ├── settings.ts       # Setting file management (Markdown frontmatter parsing, migration)
│       │   ├── brainstorm-sessions.ts  # Session .md persistence, conversation history
│       │   ├── config.ts         # Config persistence (user-config.json), key masking
│       │   ├── graph.ts          # Graph data builder (traverse relations → nodes/edges)
│       │   └── export-import.ts  # ZIP export/import (archiver + unzipper)
│       ├── db/                   # Database layer
│       │   └── knowledge.ts      # sql.js (WASM) SQLite: FTS5 full-text search, index sync
│       ├── sandbox/              # Security sandbox
│       │   ├── index.ts          # SandboxManager: workspace init, version lock, directory creation
│       │   └── policies.ts       # Security policies: system file protection, extension whitelist, name validation
│       ├── utils/                # Utilities
│       │   ├── file.ts           # Secure file ops (path resolve + symlink follow + boundary check)
│       │   ├── logger.ts         # Winston logger (daily rotation, 30-day retention, API key redaction)
│       │   ├── context.ts        # Context management (knowledge truncation, conversation truncation, summarization)
│       │   ├── tokenizer.ts      # Token estimation (TokenBudget class, CJK character heuristics)
│       │   └── mutex.ts          # Promise mutex + TaskQueue (per-function concurrency control)
│       ├── middleware/            # Express middleware
│       │   ├── rateLimit.ts      # 3-tier rate limiting: global(120/min), AI(10/min), upload(5/min)
│       │   ├── upload.ts         # Multer config: .txt only, 50MB limit, memory storage
│       │   └── validate.ts       # Zod validation + XSS sanitization (16 patterns)
│       └── ws/                   # WebSocket
│           └── handler.ts        # Extraction progress broadcast, heartbeat, room subscription
│
├── scripts/                      # Python scripts
│   ├── text_splitter.py          # Chapter splitting (regex matching, numbering)
│   └── split_validator.py        # Anomaly detection (inconsistency checking)
│
└── workspace/                    # 🏠 User data directory (generated at runtime)
    ├── .workspace.lock           # Workspace version lock
    ├── originals/                # Original uploaded files
    ├── chapters/                 # Split chapters + _meta.json
    ├── knowledge/                # Knowledge JSON + _index.db + _skills/ + _trash/
    ├── settings/                 # Setting .md files
    ├── drafts/                   # Writing draft JSON files
    └── logs/                     # Application logs (daily rotation)
```

---

## Tech Stack Details

### Frontend

| Technology | Version | Purpose | Key File |
|------------|---------|---------|----------|
| React | ^19.0 | UI framework | [main.tsx](client/src/main.tsx) |
| Vite | ^6.0 | Build tool | [vite.config.ts](client/vite.config.ts) |
| TypeScript | ^5.7 | Type system | [tsconfig.json](client/tsconfig.json) |
| Tailwind CSS | ^3.4 | Utility-first CSS | [tailwind.config.js](client/tailwind.config.js) |
| React Router | ^7.0 | Hash routing | [router.tsx](client/src/router.tsx) |
| Zustand | ^5.0 | State management | [useWriting.ts](client/src/hooks/useWriting.ts), [app.ts](client/src/stores/app.ts) |
| TipTap | ^3.26 | Rich text editor | [TipTapEditor.tsx](client/src/components/editor/TipTapEditor.tsx) |
| Cytoscape.js | ^3.34 | Graph visualization | [GraphCanvas.tsx](client/src/components/graph/GraphCanvas.tsx) |
| Axios | ^1.7 | HTTP client | [api.ts](client/src/services/api.ts) |

### Backend

| Technology | Version | Purpose | Key File |
|------------|---------|---------|----------|
| Express | ^4.21 | HTTP framework | [index.ts](server/src/index.ts) |
| TypeScript | ^5.7 | Type system | [tsconfig.json](server/tsconfig.json) |
| Claude SDK | ^0.101 | AI client | [client.ts](server/src/agents/client.ts) |
| sql.js | ^1.14 | SQLite (WASM) | [knowledge.ts](server/src/db/knowledge.ts) |
| Zod | ^3.24 | Input validation | [knowledge.ts](server/src/types/knowledge.ts), [validate.ts](server/src/middleware/validate.ts) |
| Winston | ^3.17 | Logging | [logger.ts](server/src/utils/logger.ts) |
| ws | ^8.21 | WebSocket | [handler.ts](server/src/ws/handler.ts) |
| Multer | ^2.1 | File upload | [upload.ts](server/src/middleware/upload.ts) |
| diff | ^9.0 | Text diff computation | [writing.ts](server/src/services/writing.ts) |
| archiver + unzipper | — | ZIP import/export | [export-import.ts](server/src/services/export-import.ts) |

---

## Architecture

### Layered Architecture

```
┌─────────────────────────────────────────────┐
│  Browser (React SPA, Hash Router)            │
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
│  Filesystem (workspace/)                      │
└─────────────────────────────────────────────┘
```

### Data Flow

```
Raw .txt → [Python Split] → Chapter Files → [Agent + Skill] → Knowledge JSON
                                                                    ↓
                                                         [SQLite FTS5 Index]
                                                                    ↓
Author Outline → [RAG Retrieve KB] ← [Agent Write] → Draft → [Agent Polish] → Done
```

---

## Backend Architecture

### Route → Service → Agent Call Chain

Core invocation pattern: **Route (validate + respond) → Service (orchestrate) → Agent (AI call) → Utils/DB (low-level ops)**

#### Example: Writing Generation Flow

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

### Route File Responsibilities

| Route File | Rate Limit Tier | Key Endpoints |
|------------|----------------|---------------|
| `routes/api.ts` | globalLimiter | GET /health, GET /system/info, GET\|POST /workspace/* |
| `routes/chapters.ts` | uploadLimiter | POST /upload, POST /split, POST /merge, POST /confirm |
| `routes/extract.ts` | aiLimiter | POST /start, GET /:taskId/status, POST /:taskId/cancel |
| `routes/skills.ts` | aiLimiter | CRUD /, POST /:id/generate (AI-assisted prompt gen) |
| `routes/writing.ts` | aiLimiter | POST /retrieve, /generate, /continue, /polish, /expand, /shorten, /rewrite, /check-foreshadowing |
| `routes/brainstorm.ts` | aiLimiter | CRUD /sessions, POST /:id/message, /:id/extract, /:id/convert |
| `routes/knowledge.ts` | globalLimiter | GET /conflicts, PUT /conflicts/:id, POST /conflicts/batch |
| `routes/knowledge-management.ts` | globalLimiter | CRUD /entries, /search, /graph, /trash, /export, /import |
| `routes/settings.ts` | globalLimiter | CRUD /, POST /migrate, POST /migrate/confirm |
| `routes/config.ts` | adminLimiter | CRUD /models, GET\|PUT /function-mapping, POST /:id/test |

### AI Agent System

**Multi-Provider AI Client** ([client.ts](server/src/agents/client.ts)):
- Supports Claude (Anthropic SDK), OpenAI (Chat Completions), Ollama (local)
- Exponential backoff retry (max 3 attempts)
- Model resolution: function mapping → user custom presets → default model

**Knowledge Extraction** ([extractor.ts](server/src/agents/extractor.ts)):
- Iterates through all confirmed chapters sequentially
- Runs all enabled skills concurrently per chapter (via `Promise.all`)
- Skills invoke AI's structured output via the `tools` parameter

**Writing Agent** ([writer.ts](server/src/agents/writer.ts)):
- 7 operation modes: generate, continue, polish, expand, shorten, rewrite, checkForeshadowing
- Each operation has a distinct system prompt and tool definitions
- Uses Anthropic tool_use for structured output

**Brainstorm Agent** ([brainstorm.ts](server/src/agents/brainstorm.ts)):
- Multi-turn conversation management
- Knowledge base context augmentation (RAG retrieval injection)
- Conversation history truncation (preserves pinned messages)
- Conclusion extraction (structured output)

**Skill System** ([skills/](server/src/agents/skills/)):
```
Skill interface = {
  id, name, category, description,
  systemPrompt, userPromptTemplate,
  resultSchema (JSON Schema), enabled
}
```
- 7 built-in skills ([builtins/](server/src/agents/skills/builtins/)): character, technique, location, worldbuilding, weapon, alchemy, plot
- Custom skills stored at `workspace/knowledge/_skills/*.json`
- `registry.ts` loads custom skills from disk at startup and merges them in

---

## Frontend Architecture

### Page → Component → Store → Service Data Flow

```
Pages (page shell)
  ├── Read Zustand store state
  ├── Render Components
  │     ├── User interaction triggers store action
  │     │     └── Store action calls service API function
  │     │           └── Axios sends HTTP request to backend
  │     │                 └── Response returns → store updates → React re-renders
  │     └── Show UI state
  └── Manage page lifecycle
```

### Route Table

| Path | Page Component | Load Method | Primary Data Store |
|------|---------------|-------------|-------------------|
| `/` | HomePage | Direct import | useAppStore |
| `/chapters` | ChaptersPage | lazy | useChapters |
| `/knowledge` | KnowledgePage | lazy | useKnowledge + WebSocket |
| `/knowledge-management` | KnowledgeManagementPage | lazy | useKnowledgeManagement |
| `/graph` | GraphPage | lazy | useKnowledgeManagement |
| `/writing` | WritingPage | lazy | useWriting |
| `/settings` | SettingsPage | lazy | useSettings |
| `/brainstorm` | BrainstormPage | lazy | useBrainstorm |
| `/config` | ConfigPage | lazy | useConfig |

### Zustand Store Pattern

All domain stores follow a consistent pattern:

```typescript
// Example: useWriting (client/src/hooks/useWriting.ts)
const useWriting = create<WritingState>((set, get) => ({
  // State
  mode: 'outline',
  outline: '',
  body: '',
  isLoading: false,

  // Actions
  setMode: (mode) => set({ mode }),
  generate: async () => {
    set({ isLoading: true });
    const result = await writingService.generate(get().outline);
    set({ body: result.body, diff: result.diff, isLoading: false });
  },
}));
```

### API Client

[api.ts](client/src/services/api.ts) is the Axios singleton:
- `baseURL: '/'` → requests forwarded by Vite proxy to `localhost:3000`
- 30-second timeout
- Response interceptor: categorized handling of 400/403/404/429/500 errors with logging
- Request interceptor: placeholder for future auth tokens

---

## Database Design

**SQLite + JSON dual storage** mechanism:

### JSON File Storage (Primary)
- One JSON file per knowledge entry at `workspace/knowledge/{category}/{id}.json`
- Contains full data: attributes, description, relations, source, versionHistory, conflicts
- Supports manual editing and version rollback

### SQLite Search Index (Acceleration)
- Uses **sql.js** (pure WASM — no native compilation required)
- Database file: `workspace/knowledge/_index.db`
- FTS5 full-text search: `knowledge_fts` virtual table covering name + aliases
- Auto-sync triggers: FTS index rebuilt on entry updates
- Fallback: `LIKE` queries with category/name indexes when FTS5 is unavailable

### Change Log
- `workspace/knowledge/_changes.json` records recent changes
- Powers the "Recent Changes" timeline on the Home page and knowledge base change banners

---

## Security Design

### Sandbox Isolation ([sandbox/](server/src/sandbox/))
- **Boundary checking**: `validatePathAsync()` resolves all `..` segments → `fs.realpath` follows symlinks → checks result prefix against workspace root
- **System file protection**: `.workspace.lock`, `_meta.json`, `user-config.json` cannot be modified via regular API calls
- **Filename validation**: blocks path separators, `..`, null bytes

### Rate Limiting ([rateLimit.ts](server/src/middleware/rateLimit.ts))
| Limiter | Limit | Applies To |
|---------|-------|------------|
| globalLimiter | 120 req/min | All routes |
| aiLimiter | 10 req/min | extract, writing, brainstorm |
| uploadLimiter | 5 req/min | chapters |

### Input Validation ([validate.ts](server/src/middleware/validate.ts))
- **Zod schemas**: All request body types defined and validated in [server/src/types/knowledge.ts](server/src/types/knowledge.ts)
- **XSS sanitization**: `sanitizeMiddleware()` strips `<script>`, inline events, `eval()`, and 13 other attack patterns
- **Text length limit**: 50,000 characters

### API Key Security
- Keys exist only in `.env` → loaded by `dotenv` into `process.env` at startup → memory only
- **Log redaction** ([logger.ts](server/src/utils/logger.ts)): `sanitizeLogMessage()` detects 5 key format patterns and replaces with `[REDACTED]`
- **Frontend masking** ([config.ts](server/src/services/config.ts)): `sanitizeConfigForResponse()` returns `sk-a***xxxx` masks
- **Health check excluded**: `/api/v1/health` bypasses logging to avoid log rotation noise

---

## AI Modification Guide

> File path reference organized by feature module. When modifying a feature, start from the corresponding paths below.

### Chapter Management
| Modification Target | Backend Files | Frontend Files |
|--------------------|--------------|----------------|
| Upload handling | [routes/chapters.ts](server/src/routes/chapters.ts) (POST /upload) | [chapter/Uploader.tsx](client/src/components/chapter/Uploader.tsx) |
| Split rules | [services/splitter.ts](server/src/services/splitter.ts) → [text_splitter.py](scripts/text_splitter.py) | — |
| Anomaly detection | [services/splitter.ts](server/src/services/splitter.ts) → [split_validator.py](scripts/split_validator.py) | [chapter/AnomalyDetail.tsx](client/src/components/chapter/AnomalyDetail.tsx) |
| Chapter list | [routes/chapters.ts](server/src/routes/chapters.ts) (GET /, GET /:id) | [chapter/ChapterList.tsx](client/src/components/chapter/ChapterList.tsx) |
| Chapter editing | [routes/chapters.ts](server/src/routes/chapters.ts) (PUT /:id) | [chapter/ChapterEditor.tsx](client/src/components/chapter/ChapterEditor.tsx) |
| Merge/confirm | [routes/chapters.ts](server/src/routes/chapters.ts) (POST /merge, /confirm) | [chapter/MergeModal.tsx](client/src/components/chapter/MergeModal.tsx), [ConfirmDialog.tsx](client/src/components/chapter/ConfirmDialog.tsx) |
| Store | — | [hooks/useChapters.ts](client/src/hooks/useChapters.ts) |
| API functions | — | [services/chapters.ts](client/src/services/chapters.ts) |

### Knowledge Extraction
| Modification Target | Backend Files | Frontend Files |
|--------------------|--------------|----------------|
| Task management | [agents/index.ts](server/src/agents/index.ts) (ExtractionManager) | [knowledge/ExtractTask.tsx](client/src/components/knowledge/ExtractTask.tsx) |
| Extraction engine | [agents/extractor.ts](server/src/agents/extractor.ts) (runExtractionTask) | — |
| AI client calls | [agents/client.ts](server/src/agents/client.ts) (chat, chatWithTools) | — |
| Merge logic | [services/knowledge.ts](server/src/services/knowledge.ts) (mergeEntries, detectConflicts) | — |
| Skill definitions | [agents/skills/types.ts](server/src/agents/skills/types.ts) | [skill/SkillEditor.tsx](client/src/components/skill/SkillEditor.tsx) |
| Built-in skills | [agents/skills/builtins/*.ts](server/src/agents/skills/builtins/) | — |
| Skill registry | [agents/skills/registry.ts](server/src/agents/skills/registry.ts) | — |
| Conflict resolution | [routes/knowledge.ts](server/src/routes/knowledge.ts) (conflicts) | [knowledge/ConflictResolver.tsx](client/src/components/knowledge/ConflictResolver.tsx) |
| WebSocket progress | [ws/handler.ts](server/src/ws/handler.ts) | [hooks/useExtractionWebSocket.ts](client/src/hooks/useExtractionWebSocket.ts) |
| Store | — | [hooks/useKnowledge.ts](client/src/hooks/useKnowledge.ts) |
| API functions | — | [services/knowledge.ts](client/src/services/knowledge.ts) |

### Knowledge Base Management
| Modification Target | Backend Files | Frontend Files |
|--------------------|--------------|----------------|
| CRUD operations | [services/knowledge-management.ts](server/src/services/knowledge-management.ts) | [knowledge/KnowledgeList.tsx](client/src/components/knowledge/KnowledgeList.tsx), [KnowledgeDetail.tsx](client/src/components/knowledge/KnowledgeDetail.tsx) |
| Search | [db/knowledge.ts](server/src/db/knowledge.ts) (FTS5) + [services/knowledge-management.ts](server/src/services/knowledge-management.ts) | [pages/KnowledgeManagement.tsx](client/src/pages/KnowledgeManagement.tsx) |
| Version history | [services/knowledge-management.ts](server/src/services/knowledge-management.ts) (getVersionHistory) | [knowledge/VersionTimeline.tsx](client/src/components/knowledge/VersionTimeline.tsx) |
| Trash | [services/knowledge-management.ts](server/src/services/knowledge-management.ts) (soft delete/restore) | [knowledge/TrashPanel.tsx](client/src/components/knowledge/TrashPanel.tsx) |
| Export/import | [services/export-import.ts](server/src/services/export-import.ts) | [pages/KnowledgeManagement.tsx](client/src/pages/KnowledgeManagement.tsx) |
| Store | — | [hooks/useKnowledgeManagement.ts](client/src/hooks/useKnowledgeManagement.ts) |
| API functions | — | [services/knowledge-management.ts](client/src/services/knowledge-management.ts) |

### Knowledge Graph
| Modification Target | Backend Files | Frontend Files |
|--------------------|--------------|----------------|
| Graph data | [services/graph.ts](server/src/services/graph.ts) (buildGraphData, expandNode) | — |
| Graph routes | [routes/knowledge-management.ts](server/src/routes/knowledge-management.ts) (GET /graph/*) | — |
| Rendering | — | [graph/GraphCanvas.tsx](client/src/components/graph/GraphCanvas.tsx) |
| Filtering | — | [graph/GraphFilter.tsx](client/src/components/graph/GraphFilter.tsx) |
| Node details | — | [graph/NodeDetail.tsx](client/src/components/graph/NodeDetail.tsx) |

### Writing Window
| Modification Target | Backend Files | Frontend Files |
|--------------------|--------------|----------------|
| RAG retrieval | [services/rag.ts](server/src/services/rag.ts) (retrieval pipeline) | — |
| Writing generation | [agents/writer.ts](server/src/agents/writer.ts) (generate, continue, polish...) | — |
| Writing orchestration | [services/writing.ts](server/src/services/writing.ts) (retrieve → generate → diff) | — |
| Outline editor | — | [writing/OutlineEditor.tsx](client/src/components/writing/OutlineEditor.tsx) |
| Body editor | — | [editor/TipTapEditor.tsx](client/src/components/editor/TipTapEditor.tsx) |
| AI toolbar | — | [writing/AiToolbar.tsx](client/src/components/writing/AiToolbar.tsx) |
| Floating menu | — | [editor/TipTapEditor.tsx](client/src/components/editor/TipTapEditor.tsx) (BubbleMenu) |
| Diff display | [services/writing.ts](server/src/services/writing.ts) (diffWords) | [editor/DiffView.tsx](client/src/components/editor/DiffView.tsx) |
| Prior knowledge panel | — | [writing/PriorKnowledgePanel.tsx](client/src/components/writing/PriorKnowledgePanel.tsx) |
| Writing sidebar | — | [writing/WritingSidebar.tsx](client/src/components/writing/WritingSidebar.tsx) |
| Draft management | [routes/writing.ts](server/src/routes/writing.ts) (Drafts CRUD) | [writing/DraftManager.tsx](client/src/components/writing/DraftManager.tsx) |
| Main layout | — | [writing/WritingLayout.tsx](client/src/components/writing/WritingLayout.tsx) |
| Store | — | [hooks/useWriting.ts](client/src/hooks/useWriting.ts) |
| API functions | — | [services/writing.ts](client/src/services/writing.ts) |

### Setting Conception
| Modification Target | Backend Files | Frontend Files |
|--------------------|--------------|----------------|
| Setting CRUD | [services/settings.ts](server/src/services/settings.ts) | [settings/SettingEditor.tsx](client/src/components/settings/SettingEditor.tsx) |
| Knowledge reference | [services/settings.ts](server/src/services/settings.ts) (addReference) | [settings/ReferencePanel.tsx](client/src/components/settings/ReferencePanel.tsx) |
| Migration | [services/settings.ts](server/src/services/settings.ts) (migrate) | [settings/MigrateDialog.tsx](client/src/components/settings/MigrateDialog.tsx) |
| Store | — | [hooks/useSettings.ts](client/src/hooks/useSettings.ts) |
| API functions | — | [services/settings.ts](client/src/services/settings.ts) |

### Brainstorming
| Modification Target | Backend Files | Frontend Files |
|--------------------|--------------|----------------|
| Session management | [services/brainstorm-sessions.ts](server/src/services/brainstorm-sessions.ts) | [brainstorm/SessionList.tsx](client/src/components/brainstorm/SessionList.tsx) |
| Message sending | [agents/brainstorm.ts](server/src/agents/brainstorm.ts) (sendMessage) | [brainstorm/ChatWindow.tsx](client/src/components/brainstorm/ChatWindow.tsx) |
| Conclusion extraction | [agents/brainstorm.ts](server/src/agents/brainstorm.ts) (extractConclusions) | [brainstorm/ConclusionPanel.tsx](client/src/components/brainstorm/ConclusionPanel.tsx) |
| Store | — | [hooks/useBrainstorm.ts](client/src/hooks/useBrainstorm.ts) |
| API functions | — | [services/brainstorm.ts](client/src/services/brainstorm.ts) |

### System Configuration
| Modification Target | Backend Files | Frontend Files |
|--------------------|--------------|----------------|
| Config management | [services/config.ts](server/src/services/config.ts) | — |
| Default config | [config/default.ts](server/src/config/default.ts) | — |
| Model presets | [services/config.ts](server/src/services/config.ts) | [config/ModelList.tsx](client/src/components/config/ModelList.tsx) |
| Function mapping | [services/config.ts](server/src/services/config.ts) | [config/FunctionMapping.tsx](client/src/components/config/FunctionMapping.tsx) |
| API key display | [services/config.ts](server/src/services/config.ts) (sanitizeConfigForResponse) | [config/ApiKeyInput.tsx](client/src/components/config/ApiKeyInput.tsx) |
| Store | — | [hooks/useConfig.ts](client/src/hooks/useConfig.ts) |
| API functions | — | [services/config.ts](client/src/services/config.ts) |

### Common / Base
| Modification Target | Files |
|--------------------|-------|
| Global styles / theme | [tailwind.config.js](client/tailwind.config.js), [styles/index.css](client/src/styles/index.css) |
| UI primitives | [components/ui/*.tsx](client/src/components/ui/) |
| Routing | [router.tsx](client/src/router.tsx), [App.tsx](client/src/App.tsx) |
| Global store | [stores/app.ts](client/src/stores/app.ts) |
| Logging system | [utils/logger.ts](server/src/utils/logger.ts) |
| File security | [utils/file.ts](server/src/utils/file.ts), [sandbox/policies.ts](server/src/sandbox/policies.ts) |
| Middleware | [middleware/*.ts](server/src/middleware/) |
| Database | [db/knowledge.ts](server/src/db/knowledge.ts) |
| Context management | [utils/context.ts](server/src/utils/context.ts) |
| Token estimation | [utils/tokenizer.ts](server/src/utils/tokenizer.ts) |

---

## Development Commands

```bash
# Install dependencies
pnpm install

# Start dev environment (both server + client)
pnpm dev

# Start backend only (port 3000)
pnpm dev:server

# Start frontend only (port 5173)
pnpm dev:client

# Production build
pnpm build

# Lint
pnpm lint

# Format
pnpm format
```

---

## Extension Guide

### Adding a New Knowledge Category

1. Create a new skill file in [server/src/agents/skills/builtins/](server/src/agents/skills/builtins/)
2. Register in [server/src/agents/skills/registry.ts](server/src/agents/skills/registry.ts)
3. Add the category directory to `WORKSPACE_DIRS` in [server/src/sandbox/index.ts](server/src/sandbox/index.ts)
4. Add the category to merge logic in [server/src/services/knowledge.ts](server/src/services/knowledge.ts)
5. Add corresponding UI display in frontend knowledge components

### Adding a New Writing Operation

1. Add a new operation function and system prompt in [server/src/agents/writer.ts](server/src/agents/writer.ts)
2. Orchestrate the new operation's business logic in [server/src/services/writing.ts](server/src/services/writing.ts)
3. Add a new endpoint in [server/src/routes/writing.ts](server/src/routes/writing.ts)
4. Add the API function in [client/src/services/writing.ts](client/src/services/writing.ts)
5. Add the entry button in [AiToolbar.tsx](client/src/components/writing/AiToolbar.tsx) or [TipTapEditor.tsx](client/src/components/editor/TipTapEditor.tsx) (floating menu)

### Adding a New AI Model Provider

1. Add a new provider branch in [server/src/agents/client.ts](server/src/agents/client.ts) (reference existing Claude/OpenAI implementations)
2. Register in the model resolution logic in [server/src/services/config.ts](server/src/services/config.ts)
3. Add a default preset in [server/src/config/default.ts](server/src/config/default.ts)
4. Ensure the UI supports the new provider in [ModelList.tsx](client/src/components/config/ModelList.tsx)

### Adding a Custom Extraction Skill (Runtime)

No code changes needed — create a new skill via the UI on the Knowledge Extraction page. The system will automatically:
1. Save to `workspace/knowledge/_skills/{id}.json`
2. Load via `registry.ts` into the extraction pipeline
3. AI-assisted prompt generation via `POST /api/v1/skills/:id/generate`

---

## Version

- Project Version: v0.1.0
- Docs Updated: 2026-06-07
