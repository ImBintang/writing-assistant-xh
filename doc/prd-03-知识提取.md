# PRD-03：知识提取系统

## 版本信息

| 字段 | 内容 |
|------|------|
| PRD编号 | PRD-03 |
| 版本 | v1.0 |
| 创建日期 | 2026-06-05 |
| 依赖 | PRD-02（正文拆解与异常检测） |

## 1. 需求概述

以章节为单位，通过 Claude Agent SDK 驱动分类 Skill 进行知识提取与归档。支持用户扩展分类需求并接入 AI 编写新 Skill。提取完成后将知识条目合并入知识库，处理新词条新增和已有词条合并，高冲突情况请求作者介入裁决。

## 2. 功能需求

### 2.1 Agent 调度框架

#### 2.1.1 Agent 管理器 (`server/src/agents/index.ts`)

```typescript
interface AgentConfig {
  model: ModelConfig;       // 使用的模型配置
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
  skills: Skill[];          // 挂载的Skill列表
}

interface Skill {
  id: string;
  name: string;             // 如 "人物提取"
  category: string;         // 如 "character"
  description: string;
  promptTemplate: string;   // Skill的prompt模板
  outputSchema: object;      // 输出JSON Schema
}
```

#### 2.1.2 提取流程

1. 用户选择要提取的章节（支持多选、全选）
2. 用户选择要启用的知识分类（可多选、全选）
3. 后端按章节遍历，对每个章节：
   a. 读取章节内容
   b. 并发调用已启用的 Skill Agent（每个 Skill 一个独立的 Agent 子任务）
   c. 收集各 Skill 提取的知识条目
4. 汇总所有章节的提取结果
5. 进入知识合并阶段

**验收标准：**
- 选择第1章和"人物""功法"两个分类，Agent 能正确提取
- 提取结果以结构化 JSON 返回，符合 Schema

### 2.2 分类 Skill 定义

#### 2.2.1 内置 Skill

| Skill | category | 提取内容 |
|-------|----------|---------|
| 人物提取 | character | 姓名、别名、性别、年龄、外貌、性格、身份、关系、首次出场 |
| 功法提取 | technique | 名称、类型、等级、效果、修炼条件、所属角色 |
| 地图提取 | location | 地名、类型、地理位置、所属势力、环境描述、首次提及 |
| 世界观提取 | worldbuilding | 规则名称、规则类型、规则描述、涉及角色/势力、时间线 |
| 武器提取 | weapon | 名称、类型、品级、特性、持有者、来历 |
| 丹药提取 | alchemy | 名称、类型、品级、效果、配方、炼制条件 |
| 情节提取 | plot | 事件名称、事件类型、参与角色、发生地点、因果链、伏笔标记 |

每个 Skill 的 prompt 包含：
- 明确的提取指令
- 输出 JSON Schema 约束
- 示例输出格式
- "不确定则不输出"的原则（减少幻觉）

**验收标准：**
- 每个内置 Skill 都能独立运行并返回符合 Schema 的结果
- 输出为空时不编造内容

#### 2.2.2 自定义 Skill

- 用户可在前端创建新 Skill：
  - 输入 Skill 名称
  - 选择/新建分类
  - 编写 Skill 描述和提取要求
  - （可选）由 AI 辅助生成 Skill Prompt
- 自定义 Skill 存储在 `workspace/knowledge/_skills/` 下
- 与内置 Skill 同等参与提取流程

**验收标准：**
- 创建自定义"灵兽"Skill，能像内置 Skill 一样工作
- 自定义 Skill 可编辑、删除、启用/禁用

### 2.3 知识合并

每章节提取完成后，将新知识与已有知识库进行合并。

#### 2.3.1 合并规则

| 情况 | 处理方式 |
|------|---------|
| 新词条（名称+分类均未匹配到已有条目） | 自动新建条目 |
| 同一分类下名称相似（相似度 > 0.8） | 视为同一条目，进行属性合并 |
| 同名同分类，属性一致 | 更新来源信息，版本号+1 |
| 同名同分类，属性有补充 | 合并新属性，来源信息追加 |
| 同名同分类，属性有明显冲突 | 标记为冲突，请求作者介入 |

#### 2.3.2 冲突检测

冲突判断标准：
- 同一属性被赋予不同值（如人物性别从"男"变为"女"）
- 属性值矛盾（如人物状态从"已死亡"变为"存活"）
- 数值属性变化超过阈值（如年龄跳跃 > 3岁，排除正常成长）

#### 2.3.3 冲突解决界面

- 前端展示冲突详情（字段对比视图）
- 选项：接受新版 / 保留旧版 / 手动编辑
- 裁决结果记录在条目 `conflicts` 数组中
- 支持批量裁决（选择全部接受新版等）

**验收标准：**
- 新增一个不存在的人物，知识库自动创建该条目
- 更新已有人物并补充新属性，自动合并
- 人物性别修改产生冲突，前端弹出裁决请求

### 2.4 知识条目索引（SQLite）

同步维护 SQLite 索引以支持高效查询：

```sql
CREATE TABLE knowledge_index (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  aliases TEXT,              -- JSON array
  chapters TEXT NOT NULL,    -- JSON array: [1, 3, 5]
  updated_at TEXT NOT NULL,
  version INTEGER DEFAULT 1
);

CREATE INDEX idx_knowledge_category ON knowledge_index(category);
CREATE INDEX idx_knowledge_name ON knowledge_index(name);
CREATE FULLTEXT INDEX idx_knowledge_fts ON knowledge_index(name, aliases);
```

**验收标准：**
- JSON 文件变更后 SQLite 索引同步更新
- 全文搜索能查到别名匹配的条目

## 3. 接口定义

### 3.1 知识提取

```
POST   /api/v1/extract/start         启动提取任务
  Request: {
    chapterIds: string[],
    categories: string[],
    customSkills?: string[]
  }
  Response: { taskId: string }

GET    /api/v1/extract/:taskId/status 查询任务状态与进度
  Response: {
    status: "running" | "completed" | "failed",
    progress: { total: 42, completed: 5, currentChapter: "第六章" },
    results?: KnowledgeEntry[]
  }

POST   /api/v1/extract/:taskId/cancel 取消提取任务
```

### 3.2 技能管理

```
GET    /api/v1/skills                 获取所有Skill（内置+自定义）
POST   /api/v1/skills                 创建自定义Skill
PUT    /api/v1/skills/:id             更新自定义Skill
DELETE /api/v1/skills/:id             删除自定义Skill
POST   /api/v1/skills/:id/generate    由AI辅助生成Skill Prompt
```

### 3.3 知识合并

```
GET    /api/v1/knowledge/conflicts    获取所有待解决冲突
PUT    /api/v1/knowledge/conflicts/:id 裁决单个冲突
  Request: { resolution: "accept_new" | "keep_old" | "manual", manualValue?: any }
POST   /api/v1/knowledge/conflicts/batch 批量裁决
```

## 4. 数据结构

### 知识条目

```typescript
interface KnowledgeEntry {
  id: string;
  category: string;
  name: string;
  aliases: string[];
  attributes: Record<string, any>;
  description: string;
  relations: Relation[];       // 与其他条目的关系
  source: SourceInfo[];
  version: number;
  createdAt: string;
  updatedAt: string;
  conflicts?: ConflictRecord[];
}

interface SourceInfo {
  chapter: number;
  chapterTitle: string;
  excerpt: string;             // 原文摘录
  extractedAt: string;
}

interface ConflictRecord {
  field: string;
  oldValue: any;
  newValue: any;
  sourceChapter: number;
  detectedAt: string;
  resolved: boolean;
  resolution?: string;
}
```

## 5. 非功能需求

- 单章节知识提取应在 30 秒内完成（取决于 API 响应速度）
- Agent 调用支持失败重试（最多 3 次）
- 大量章节提取时支持进度推送（WebSocket）
- 合并阶段的相似度计算在服务端完成（使用字符串编辑距离）

## 6. 文件清单

| 文件 | 说明 |
|------|------|
| `server/src/agents/index.ts` | Agent管理器 |
| `server/src/agents/extractor.ts` | 知识提取Agent |
| `server/src/agents/skills/*.ts` | 各分类Skill定义文件 |
| `server/src/services/knowledge.ts` | 知识库服务（合并逻辑） |
| `server/src/routes/knowledge.ts` | 知识库路由 |
| `server/src/routes/skills.ts` | Skill管理路由 |
| `server/src/db/knowledge.ts` | SQLite知识索引操作 |
| `client/src/pages/Knowledge.tsx` | 知识提取任务管理页 |
| `client/src/components/knowledge/ExtractTask.tsx` | 提取任务配置 |
| `client/src/components/knowledge/ConflictResolver.tsx` | 冲突裁决组件 |
| `client/src/components/skill/SkillEditor.tsx` | Skill编辑器 |

## 7. 验收流程

1. 选择已拆分的第1章，勾选"人物"和"地图"两个分类，启动提取
2. 观察进度条更新
3. 提取完成后查看结果，确认条目结构正确
4. 创建自定义 Skill "宗门提取"，并成功提取宗门信息
5. 选择第2章再次提取，观察新条目创建和已有条目合并
6. 制造冲突：修改 txt 中某人物属性后重新提取该章，观察冲突弹出
7. 手动裁决冲突，确认知识库更新
