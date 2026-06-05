# PRD-07：功能安全性与配置管理

## 版本信息

| 字段 | 内容 |
|------|------|
| PRD编号 | PRD-07 |
| 版本 | v1.0 |
| 创建日期 | 2026-06-05 |
| 依赖 | PRD-01~06（全部前置 PRD） |

## 1. 需求概述

作为收尾 PRD，完善全项目的功能安全性（沙箱管理、API 管理）和配置管理（模型配置、上下文管理）。核心目标：确保所有文件操作严格限制在工作区内；支持不同功能使用不同模型并能灵活配置；合理管理大模型上下文避免溢出。

## 2. 功能需求

### 2.1 沙箱安全管理

#### 2.1.1 文件操作沙箱

**原则：** 所有服务端文件操作（读、写、追加写、删除、列表、搜索）必须通过统一的沙箱文件工具 (`server/src/utils/file.ts`)，任何绕过沙箱工具的文件操作均不被允许。

**沙箱核心实现 (`server/src/sandbox/index.ts`)：**

```typescript
class SandboxManager {
  private workspaceRoot: string;  // 绝对方路径，如 /path/to/workspace/

  /**
   * 验证一个路径是否安全（在工作区内）
   * 解析所有 .. 和符号链接后再检查
   */
  validatePath(targetPath: string): string {
    const resolved = path.resolve(this.workspaceRoot, targetPath);
    // 核心检查：解析后的路径必须在 workspaceRoot 之下
    if (!resolved.startsWith(this.workspaceRoot + path.sep)
        && resolved !== this.workspaceRoot) {
      throw new ForbiddenError(`路径 ${targetPath} 超出工作区范围`);
    }
    return resolved;
  }

  // 所有文件操作包装
  readFile(relativePath: string): Promise<string>
  writeFile(relativePath: string, content: string): Promise<void>
  appendFile(relativePath: string, content: string): Promise<void>
  deleteFile(relativePath: string): Promise<void>
  listDir(relativePath: string): Promise<string[]>
  fileExists(relativePath: string): Promise<boolean>
}
```

**安全策略 (`server/src/sandbox/policies.ts`)：**

| 操作 | 限制 |
|------|------|
| 读 | 仅限 workspace 目录及子目录 |
| 写/追加写 | 仅限 workspace 目录及子目录，禁止覆盖 `.lock` 和 `_meta.json` 等系统文件 |
| 删除 | 仅限 workspace 目录及子目录，系统文件需二次确认 |
| 文件类型 | 上传仅允许 `.txt`、`.md`、`.json` |
| 路径穿越 | 拒绝包含 `..` 且解析后超出 workspace 的路径 |
| 符号链接 | 解析符号链接后再进行路径验证 |

**验收标准：**

- [ ] 尝试 `readFile('../../etc/passwd')` 返回 403 错误
- [ ] 尝试 `writeFile('../outside/file.txt', 'data')` 返回 403 错误
- [ ] 所有合法 workspace 内路径操作正常执行
- [ ] 系统文件被保护不可通过 API 删除

#### 2.1.2 API 权限与速率限制

**速率限制：**
- 全局：每个 IP 每分钟最多 120 次请求
- AI 相关端点：每分钟最多 10 次（避免 API 费用失控）
- 文件上传：每分钟最多 5 次
- 使用 `express-rate-limit` 中间件实现

**请求大小限制：**
- JSON body 最大 10MB
- 文件上传最大 50MB（单文件）
- AI 操作输入文本最大 50000 字符

**验收标准：**
- 短时间内连续发送 AI 请求，第 11 次收到 429 响应
- 超过大小限制的请求被拒绝

#### 2.1.3 输入校验

- 所有 API 输入参数使用 Zod schema 校验
- 拒绝包含可执行脚本的输入（如 `<script>`、`eval()` 等，适用于可能渲染到前端的字段）
- 文件名参数禁止包含路径分隔符

**验收标准：**
- 非法参数格式返回 400 及明确错误信息
- XSS 风险输入被拒绝或转义

### 2.2 模型配置管理

#### 2.2.1 配置模型

```typescript
interface SystemConfig {
  models: {
    default: string;              // 全局默认模型
    presets: ModelPreset[];       // 预设模型列表
    userOverrides?: Record<string, string>;  // 用户覆盖：功能 -> 模型ID
  };
  context: ContextConfig;
  rateLimit: RateLimitConfig;
}

interface ModelPreset {
  id: string;                    // 唯一标识
  name: string;                  // 显示名称
  provider: 'claude' | 'openai' | 'ollama';
  modelId: string;               // API 模型ID
  apiKeyEnv: string;             // 环境变量名
  baseUrl?: string;              // 自定义API地址 (如 ollama 本地)
  description: string;           // 模型描述
}

interface ContextConfig {
  maxInputTokens: number;        // 默认 100K
  maxOutputTokens: number;       // 默认 4096
  knowledgeContextBudget: number; // 知识库上下文预算(token数)
}
```

#### 2.2.2 预设配置 (`server/src/config/default.ts`)

内置预设：

```typescript
const defaultPresets: ModelPreset[] = [
  {
    id: 'claude-opus',
    name: 'Claude Opus 4.8',
    provider: 'claude',
    modelId: 'claude-opus-4-8',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    description: '最强能力，适合知识提取和复杂写作',
  },
  {
    id: 'claude-sonnet',
    name: 'Claude Sonnet 4.6',
    provider: 'claude',
    modelId: 'claude-sonnet-4-6',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    description: '平衡性能与成本，适合日常写作和润色',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    modelId: 'gpt-4o',
    apiKeyEnv: 'OPENAI_API_KEY',
    description: 'OpenAI 旗舰模型',
  },
  {
    id: 'ollama-local',
    name: 'Ollama 本地模型',
    provider: 'ollama',
    modelId: 'llama3.1:70b',
    apiKeyEnv: 'OLLAMA_API_KEY',
    baseUrl: 'http://localhost:11434',
    description: '本地运行，完全离线',
  },
];
```

#### 2.2.3 功能-模型绑定

```typescript
// 预设的功能-模型映射
const defaultFunctionMapping: Record<string, string> = {
  extract: 'claude-opus',       // 知识提取用最强模型
  write: 'claude-opus',         // 撰写用最强模型
  polish: 'claude-sonnet',      // 润色用中等模型（成本优化）
  brainstorm: 'claude-sonnet',  // 头脑风暴用中等模型
  chat: 'claude-sonnet',        // 普通对话
  skill_generate: 'claude-sonnet', // Skill生成
};
```

用户可覆盖任何映射，修改保存在 `workspace/user-config.json`。

#### 2.2.4 配置管理 API

```
GET    /api/v1/config                   获取完整配置（脱敏，隐藏 API Key）
PUT    /api/v1/config                   更新配置
  Request: Partial<SystemConfig>
GET    /api/v1/config/models            获取模型列表（含预设 + 自定义）
POST   /api/v1/config/models            添加自定义模型
DELETE /api/v1/config/models/:id        删除自定义模型
PUT    /api/v1/config/function-mapping  更新功能-模型映射
```

#### 2.2.5 前端配置页面

- 模型列表展示：预设 + 自定义，显示名称、提供商、描述
- 功能-模型下拉选择器（一个表格，行=功能，列=模型下拉框）
- API Key 输入区（密码框，仅存储到环境变量或配置文件）
- "测试连接"按钮：发送测试请求验证 API 可用
- 添加自定义模型表单

**验收标准：**
- 切换写文功能使用的模型后，实际 API 调用使用新模型
- 测试连接失败时显示明确错误信息
- API Key 保存后不在前端显示明文

### 2.3 上下文管理

#### 2.3.1 问题分析

大模型上下文窗口有限，而以下场景可能超出限制：
- 长章节（>10万字）+ 大量知识条目作为先验知识
- 多轮头脑风暴对话历史积累
- 全知提取时一次性处理大量内容

#### 2.3.2 策略

**知识提取：**
- 每个 Skill 独立调用，各自上下文隔离
- 单次输入章节内容限制在 50K token 以内
- 超过上限时：将章节按自然段落分割，分批提取后合并结果

**写文 Agent：**
- 先验知识按相关度排序后截断（默认 30K token 预算，可配置）
- 使用摘要替代详细属性列表
- 上一章仅取结尾 300 字（而非全文）
- 长知识条目属性过多时只传关键属性

**头脑风暴：**
- 对话历史保留最近 20 轮
- 更早对话自动总结为摘要（"之前讨论了...得出的结论是..."）
- 摘要由轻量模型（如 Sonnet）异步生成

**上下文预算监控：**
```typescript
interface TokenBudget {
  maxInput: number;        // 最大输入 token
  reserved: number;        // 预留给 system prompt 的 token
  available(): number;     // 可用 token
  estimate(text: string): number;  // 估算文本 token 数
}
```

#### 2.3.3 实现

- 使用 `tiktoken` 或模型特定的 tokenizer 估算 token 数
- 所有 Agent 调用前检查输入是否超限
- 超限时自动执行截断策略，并记录日志警告
- 前端可选显示当前上下文使用情况（token 指示器）

**验收标准：**
- 输入 20 万字章节+大量知识条目，Agent 调用不报 token 超限
- 日志中可见截断记录
- 前端可查看上下文使用情况

### 2.4 API Key 安全管理

- API Key 优先从环境变量读取
- 支持从配置文件 `workspace/user-config.json` 读取（文件权限 600）
- 前端永远不返回完整 API Key（只返回前4位+后4位，中间用 `****` 替代）
- 日志中过滤 API Key（避免泄露）

**验收标准：**
- 配置 API 返回的 apiKey 字段为脱敏格式
- 日志文件中搜索不到 API Key 明文

### 2.5 并发与单线程管理

- 同一时间只允许一个 AI 提取任务运行（防止同时大量调用 API）
- 写文、头脑风暴等用户触发操作可以并行（不同功能独立）
- 使用简单的内存锁（Promise-based mutex）
- 任务队列：同一功能的任务排队执行

**验收标准：**
- 同时触发两个提取任务，第二个排队等待
- 提取任务运行中，仍可正常使用写文功能

## 3. 接口定义汇总

### 3.1 配置管理
```
GET    /api/v1/config                      获取配置
PUT    /api/v1/config                      更新配置
GET    /api/v1/config/models               模型列表
POST   /api/v1/config/models               添加自定义模型
DELETE /api/v1/config/models/:id           删除模型
PUT    /api/v1/config/function-mapping     更新功能映射
POST   /api/v1/config/models/:id/test      测试连接
```

### 3.2 系统信息
```
GET    /api/v1/system/info                 系统信息
GET    /api/v1/system/context-usage        当前上下文使用情况
POST   /api/v1/system/validate-path        手动验证路径安全性 (调试用)
```

## 4. 非功能需求

- 所有安全策略在代码中强制执行，不存在可通过配置绕过的后门
- 错误信息不泄露服务器路径、用户名等敏感信息（生产模式）
- 沙箱策略以单元测试覆盖（构造恶意路径验证拒绝）
- 速率限制日志记录，方便排查

## 5. 文件清单

| 文件 | 说明 |
|------|------|
| `server/src/sandbox/index.ts` | 沙箱管理器 |
| `server/src/sandbox/policies.ts` | 安全策略定义 |
| `server/src/config/default.ts` | 预设模型配置 |
| `server/src/services/config.ts` | 配置管理服务 |
| `server/src/utils/file.ts` | 沙箱文件工具 |
| `server/src/utils/context.ts` | 上下文管理工具 |
| `server/src/utils/tokenizer.ts` | Token估算工具 |
| `server/src/middleware/rateLimit.ts` | 速率限制中间件 |
| `server/src/middleware/validate.ts` | 输入校验中间件 |
| `server/src/routes/config.ts` | 配置路由 |
| `client/src/pages/Config.tsx` | 配置页面 |
| `client/src/components/config/ModelList.tsx` | 模型列表组件 |
| `client/src/components/config/FunctionMapping.tsx` | 功能绑定组件 |
| `client/src/components/config/ApiKeyInput.tsx` | API Key输入组件 |

## 6. 集成检查清单（全部 PRD）

完成 PRD-01 至 PRD-07 后，进行全项目集成验证：

- [ ] 安装依赖：`pnpm install` 全部成功
- [ ] 后端启动：`pnpm dev:server` 正常监听端口
- [ ] 前端启动：`pnpm dev:client` 正常打开页面
- [ ] 健康检查：`/api/v1/health` 返回 200
- [ ] 上传 txt → 正确拆分 → 异常检测报告
- [ ] 选择章节 → 选择分类 → 启动知识提取 → 提取完成
- [ ] 查看知识库 → 搜索/浏览/编辑条目
- [ ] 知识图谱正确展示节点和关联
- [ ] 写文窗口：输入大纲 → 检索知识 → AI撰写 → 选中文本润色
- [ ] 构思窗口：创建设定 → 引用知识库 → 隔离验证 → 迁移到知识库
- [ ] 头脑风暴：创建会话 → 多轮对话 → 提取结论 → 转为设定
- [ ] 路径穿越测试 → 403 拒绝
- [ ] 多模型切换测试 → API 调用使用正确模型
- [ ] 速率限制测试 → 超限返回 429
- [ ] API Key 脱敏 → 配置接口返回脱敏值

## 7. 验收流程

1. 执行全部集成检查清单
2. 使用一个完整的示例小说进行端到端测试（上传 → 拆分 → 提取 → 写文）
3. 安全测试：尝试各种路径穿越、大文件上传、恶意输入
4. 配置测试：切换模型、修改映射、测试连接
