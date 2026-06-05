# PRD-05：写文窗口

## 版本信息

| 字段 | 内容 |
|------|------|
| PRD编号 | PRD-05 |
| 版本 | v1.0 |
| 创建日期 | 2026-06-05 |
| 依赖 | PRD-04（知识库管理与知识图谱） |

## 1. 需求概述

提供核心写文窗口，支持作者输入大纲或草稿，系统根据大纲与草稿内容自动检索知识库构建先验知识，然后通过 Agent+Skill 进行 AI 撰写、补充与润色。编辑器内支持滑动选择文段，对选中内容向 AI 提出重写需求。

## 2. 功能需求

### 2.1 RAG 检索增强生成 (`server/src/services/rag.ts`)

#### 2.1.1 检索流程

1. 作者输入大纲/草稿内容
2. 对输入文本进行分词和关键词提取
3. 从 SQLite FTS 索引中检索相关度最高的知识条目
4. 同时按分类进行定向检索（确保覆盖各类知识）
5. 合并检索结果，按相关度排序
6. 生成"先验知识上下文"：结构化的知识摘要

#### 2.1.2 检索策略

| 检索维度 | 方法 | 权重 |
|---------|------|------|
| 人物名匹配 | SQLite FTS + 精确匹配 | 高 |
| 地点名匹配 | SQLite FTS | 高 |
| 关键词匹配 | 文本分词后 TF-IDF | 中 |
| 最近章节关联 | 时间衰减（越近的章节权重越高） | 中 |
| 全局关键设定 | 世界观的全局规则类条目 | 常驻 |

#### 2.1.3 先验知识组装

```typescript
interface PriorKnowledge {
  characters: KnowledgeEntry[];     // 相关人物
  techniques: KnowledgeEntry[];     // 相关功法
  locations: KnowledgeEntry[];      // 相关地点
  worldbuilding: KnowledgeEntry[];  // 世界观规则
  weapons: KnowledgeEntry[];        // 相关武器
  alchemy: KnowledgeEntry[];        // 相关丹药
  plot: KnowledgeEntry[];           // 相关情节/伏笔
  previousChapter: string;          // 上一章结尾(300字)
  summary: string;                  // 检索结果摘要文本
}
```

**验收标准：**
- 输入大纲中包含"林动"，检索结果中包含林动的知识条目
- 输入涉及"炼丹"，检索到丹药相关条目
- 先验知识上下文被正确组装并传递给写文 Agent

### 2.2 写文窗口前端

#### 2.2.1 布局

```
┌───────────────────────────────────────────────────────┐
│  写文窗口                  [大纲模式] [正文模式]       │
├───────────────────────────┬───────────────────────────┤
│                           │                           │
│    大纲/草稿输入区        │    先验知识预览区          │
│    (TipTap编辑器)         │    (可折叠)               │
│                           │    - 检索到的人物          │
│                           │    - 相关设定              │
│                           │    - 上文摘要              │
│                           │                           │
├───────────────────────────┴───────────────────────────┤
│                                                       │
│    正文撰写区 (TipTap编辑器)                           │
│    - 富文本编辑                                        │
│    - 选中文本后弹出AI操作菜单                           │
│    - 实时字数统计                                      │
│                                                       │
├───────────────────────────────────────────────────────┤
│  [AI撰写本章] [AI续写] [AI润色] [AI扩写] [检查伏笔]    │
└───────────────────────────────────────────────────────┘
```

#### 2.2.2 编辑器功能

**TipTap 扩展：**
- 基础：加粗、斜体、下划线、标题层级
- 字数统计（字符数 + 中文字数）
- AI 操作浮动工具栏（选中文本后弹出）
- 修订追踪（AI 修改前后对比）
- 历史记录（undo/redo）

**选中文本 AI 操作菜单：**
- "润色此段"：优化文笔，保持原意
- "扩写此段"：丰富细节，增加长度
- "缩写此段"：精简内容，保留核心
- "改写成xx风格"：风格转换
- "检查逻辑"：检查与知识库的一致性
- "自由指令"：打开输入框输入自定义需求

**验收标准：**
- TipTap 编辑器正常渲染，支持富文本操作
- 选中文字后弹出 AI 操作菜单
- 点击"润色此段"后 AI 返回润色后的文本

### 2.3 AI 撰写能力

#### 2.3.1 撰写模式

| 模式 | 说明 | 输入 |
|------|------|------|
| 撰写本章 | 根据大纲+知识库从头撰写整章 | 大纲/草稿 |
| 续写 | 基于当前正文继续往后写 | 当前正文 |
| 润色 | 优化文笔、修正语病 | 当前正文 |
| 扩写 | 扩展内容，丰富细节 | 选中文本 |
| 缩写 | 精简内容 | 选中文本 |
| 改写 | 按指定风格改写 | 选中文本 + 风格指令 |
| 伏笔检查 | 对照知识库检查伏笔遗漏 | 当前正文 + 知识库情节 |

#### 2.3.2 Agent 调用

- 模型配置使用 `write` 功能绑定的模型
- System Prompt 包含：先验知识上下文、写作风格指南
- 正文编辑器内容实时传递给 Agent
- AI 返回的文本以"建议"形式插入（可接受/拒绝）

**验收标准：**
- 点击"AI 撰写本章"，输入大纲，Agent 输出完整的章节正文
- 输出内容与知识库设定一致

### 2.4 大纲模式 vs 正文模式

**大纲模式：**
- 上方编辑区为大纲/要点编辑
- AI 基于大纲自动扩写为正文
- 支持树形大纲结构（一级目录、二级要点）

**正文模式：**
- 上方编辑区隐藏或折叠
- 占满屏幕专注写作
- 右侧保留知识检索侧边栏（可收起）

**验收标准：**
- 两种模式可自由切换
- 大纲模式下输入要点，AI 能扩写为完整段落

### 2.5 写作辅助侧边栏

- 浮动在编辑器右侧
- 显示当前检索到的相关知识条目摘要（可点击展开）
- 显示上下文提示："上文提到的 xxx"、"注意此处 yy 的设定"
- 显示可能的伏笔提示："前文伏笔 未回收"

**验收标准：**
- 侧边栏实时显示检索到的知识
- 点击知识条目可查看完整信息

## 3. 接口定义

### 3.1 RAG 检索

```
POST   /api/v1/writing/retrieve        检索先验知识
  Request: {
    outline?: string,                   // 大纲
    draft?: string,                     // 草稿/当前正文
    targetChapter?: number,             // 目标章节号
    categoryFilter?: string[]           // 指定分类
  }
  Response: PriorKnowledge
```

### 3.2 AI 操作

```
POST   /api/v1/writing/generate          AI撰写整章
  Request: { outline: string, priorKnowledge: PriorKnowledge, chapterNumber?: number }
  Response: { content: string, usage: TokenUsage }

POST   /api/v1/writing/continue          AI续写
  Request: { currentContent: string, priorKnowledge: PriorKnowledge, length?: number }
  Response: { content: string }

POST   /api/v1/writing/polish            AI润色选中文本
  Request: { selectedText: string, priorKnowledge: PriorKnowledge, instruction?: string }
  Response: { polishedText: string, changes: DiffItem[] }

POST   /api/v1/writing/expand            AI扩写
POST   /api/v1/writing/shorten           AI缩写
POST   /api/v1/writing/rewrite           AI改写
  Request: { text: string, style?: string, priorKnowledge: PriorKnowledge }
  Response: { result: string }

POST   /api/v1/writing/check-foreshadowing  伏笔检查
  Request: { content: string, chapterNumber: number, priorKnowledge: PriorKnowledge }
  Response: { findings: ForeshadowFinding[] }
```

### 3.3 草稿管理

```
GET    /api/v1/writing/drafts           草稿列表
POST   /api/v1/writing/drafts           保存草稿
PUT    /api/v1/writing/drafts/:id       更新草稿
DELETE /api/v1/writing/drafts/:id       删除草稿
```

## 4. 数据结构

```typescript
interface DraftOutline {
  id: string;
  title: string;
  targetChapter: number;
  outline: string;             // 大纲内容
  draft: string;               // 正文草稿
  priorKnowledge?: PriorKnowledge;
  createdAt: string;
  updatedAt: string;
}

interface ForeshadowFinding {
  type: 'unresolved' | 'contradiction' | 'new_foreshadow';
  description: string;
  relatedPlot: string;         // 关联的已有情节条目
  chapterReference: number;    // 涉及章节
  severity: 'info' | 'warning' | 'error';
}
```

## 5. 前端组件设计

| 组件 | 文件 | 说明 |
|------|------|------|
| WritingLayout | `components/writing/WritingLayout.tsx` | 写文窗口整体布局 |
| OutlineEditor | `components/writing/OutlineEditor.tsx` | 大纲编辑区 |
| TipTapEditor | `components/editor/TipTapEditor.tsx` | TipTap封装，包含AI浮动菜单 |
| PriorKnowledgePanel | `components/writing/PriorKnowledgePanel.tsx` | 先验知识侧边栏 |
| AiToolbar | `components/writing/AiToolbar.tsx` | 底部AI操作栏 |
| WritingSidebar | `components/writing/WritingSidebar.tsx` | 辅助侧边栏 |
| DiffView | `components/editor/DiffView.tsx` | AI修改前后对比 |
| DraftManager | `components/writing/DraftManager.tsx` | 草稿管理 |

## 6. 非功能需求

- 编辑器输入延迟 < 50ms（不阻塞渲染）
- AI 操作时显示 loading 动画，支持取消
- 草稿自动保存（每 30 秒 + 失焦时）
- 长文本（> 5万字）编辑不卡顿

## 7. 文件清单

| 文件 | 说明 |
|------|------|
| `server/src/services/rag.ts` | RAG检索服务 |
| `server/src/services/writing.ts` | 写文业务逻辑 |
| `server/src/agents/writer.ts` | 写文Agent |
| `server/src/routes/writing.ts` | 写文路由 |
| `client/src/pages/Writing.tsx` | 写文页面 |
| `client/src/components/editor/TipTapEditor.tsx` | TipTap编辑器 |
| `client/src/components/writing/WritingLayout.tsx` | 写文布局 |
| `client/src/components/writing/OutlineEditor.tsx` | 大纲编辑 |
| `client/src/components/writing/PriorKnowledgePanel.tsx` | 先验知识面板 |
| `client/src/components/writing/AiToolbar.tsx` | AI工具栏 |
| `client/src/stores/writing.ts` | 写文状态管理 |
| `client/src/hooks/useEditor.ts` | 编辑器hook |

## 8. 验收流程

1. 进入写文页面，在大纲区输入"林动前往青云宗参加宗门大比"
2. 右侧先验知识面板显示检索到的林动、青云宗等知识
3. 点击"AI撰写本章"，等待生成结果
4. 生成的正文与知识库设定一致
5. 选中一段正文，点击"润色"，收到优化后的文本
6. 选择"接受"替换原文，或"拒绝"保留
7. 切换大纲模式/正文模式，布局正确切换
8. 关闭页面后草稿已自动保存，重新打开可恢复
