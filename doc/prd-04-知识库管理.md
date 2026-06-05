# PRD-04：知识库管理与知识图谱

## 版本信息

| 字段 | 内容 |
|------|------|
| PRD编号 | PRD-04 |
| 版本 | v1.0 |
| 创建日期 | 2026-06-05 |
| 依赖 | PRD-03（知识提取系统） |

## 1. 需求概述

提供知识库的完整管理功能，包括浏览、搜索、筛选、查看详情、手动编辑、删除条目。实现版本管理机制，记录每次修改的时间与来源章节。构建知识图谱，以图形化方式展示知识条目之间的关联关系，支持交互式探索。

## 2. 功能需求

### 2.1 知识库浏览与搜索

#### 2.1.1 分类浏览

**前端：**
- 左侧分类树/标签栏：人物、功法、地图、世界观、武器、丹药、情节、自定义分类
- 右侧条目列表：按名称排序，支持切换为卡片/表格视图
- 每个条目显示：名称、分类标签、来源章节数、最后更新时间
- 点击条目进入详情页

**后端：**
```
GET /api/v1/knowledge?category=character&page=1&size=20&sort=name
GET /api/v1/knowledge?category=character&page=1&size=20&sort=updatedAt
```

**验收标准：**
- 分类切换时列表即时过滤
- 卡片和表格视图可切换
- 分页加载正常

#### 2.1.2 全文搜索

**功能：**
- 搜索输入框，支持按名称、别名、描述内容搜索
- 支持分类过滤 + 关键词组合
- 搜索结果高亮匹配文本
- 使用 SQLite FTS（全文搜索）提升性能

**后端：**
```
GET /api/v1/knowledge/search?q=林动&category=character
```

**验收标准：**
- 输入"林"能匹配到包含"林"字的条目，并按相关度排序
- 别名也能被搜索到

#### 2.1.3 条目详情

**前端详情页展示：**
- 名称 + 别名
- 分类标签
- 所有属性键值对（表格/卡片展示）
- 描述文本（支持富文本渲染）
- 关联条目（可点击跳转）
- 来源章节列表（点击可跳转查看原文）
- 版本历史（修改时间线）
- 冲突历史（如有）
- 编辑/删除按钮

**验收标准：**
- 详情页完整展示所有字段
- 点击关联条目可跳转
- 来源章节可链接到章节阅读

### 2.2 知识库编辑

#### 2.2.1 手动编辑

- 支持直接编辑条目属性、描述
- 编辑后版本号+1，记录修改时间
- 手动修改标记来源为 "manual"，与自动提取区分
- 支持添加关联关系：从条目A关联到条目B

#### 2.2.2 条目删除

- 支持单个删除（二次确认弹窗）
- 支持批量删除
- 删除操作记录日志但不立即物理删除（软删除标记）
- 提供回收站功能，支持恢复

**验收标准：**
- 编辑属性后版本号递增
- 删除后条目消失但可在回收站找到并恢复

### 2.3 版本管理

#### 2.3.1 版本记录

每条知识条目维护版本历史：

```json
{
  "version": 5,
  "versionHistory": [
    { "version": 1, "timestamp": "2026-06-01T10:00:00Z", "source": "第1章", "type": "extract" },
    { "version": 2, "timestamp": "2026-06-02T14:00:00Z", "source": "第3章", "type": "auto_merge" },
    { "version": 3, "timestamp": "2026-06-03T09:00:00Z", "source": "第5章", "type": "conflict_resolved" },
    { "version": 4, "timestamp": "2026-06-04T11:00:00Z", "source": "manual", "type": "manual_edit" },
    { "version": 5, "timestamp": "2026-06-05T16:00:00Z", "source": "第7章", "type": "auto_merge" }
  ]
}
```

修改类型：
- `extract`：首次提取创建
- `auto_merge`：后续章节自动合并
- `conflict_resolved`：冲突裁决后修改
- `manual_edit`：作者手动编辑

#### 2.3.2 变更通知

- 知识库首页顶部显示"最近更新"横幅
- 列出最近 10 条变更（按时间倒序）
- 格式："条目『林动』因第5章的知识自动更新（2026-06-03 09:00）"
- 点击可跳转到对应条目详情

**验收标准：**
- 条目详情中完整展示版本时间线
- 首页通知准确反映最近变更

### 2.4 知识图谱

#### 2.4.1 图谱数据模型

知识条目之间的关系类型：

| 关系类型 | 示例 |
|---------|------|
| `belongs_to` | 角色 → 势力 |
| `owns` | 角色 → 武器/功法 |
| `appears_in` | 角色 → 地点/事件 |
| `causes` | 事件 → 事件 |
| `located_in` | 地点 → 地点 |
| `related_to` | 通用关联 |
| `conflicts_with` | 敌对关系 |
| `ally_of` | 盟友关系 |

图谱节点 = 知识条目
图谱边 = 条目间关系

#### 2.4.2 前端可视化 (Cytoscape.js)

**核心功能：**
- 以 Cytoscape.js 渲染交互式知识图谱
- 节点颜色按分类区分
- 节点大小反映关联数量（关联越多越大）
- 边样式按关系类型区分（实线/虚线/不同颜色）
- 支持图谱操作：
  - 拖拽移动节点
  - 滚轮缩放
  - 点击节点查看详情
  - 双击展开关联节点
  - 框选多个节点
- 布局算法切换：
  - 力导向布局（默认）
  - 圆形布局
  - 层级布局（按分类）
  - 网格布局
- 过滤面板：
  - 按分类显示/隐藏节点
  - 按关系类型显示/隐藏边
  - 搜索高亮特定节点
- 导出：PNG 截图、JSON 数据导出

**验收标准：**
- 知识图谱页面默认使用力导向布局展示所有节点
- 筛选"仅人物"后只显示人物节点及其关联边
- 点击节点弹出详情浮层
- 图谱可缩放、拖拽

#### 2.4.3 图谱数据服务 (`server/src/services/graph.ts`)

- 遍历所有知识条目的 `relations` 字段构建图谱
- 按需查询，支持分区加载（节点数量 > 200 时分页）
- 缓存图谱数据结构，知识库变更时失效

**API：**
```
GET /api/v1/graph                 获取完整图谱数据
GET /api/v1/graph?categories=character,technique  按分类筛选
GET /api/v1/graph/node/:id        获取单个节点及其 N 度关系
GET /api/v1/graph/relations       获取所有关系类型定义
POST /api/v1/graph/relations      添加自定义关系类型
```

**验收标准：**
- 图谱数据正确反映知识条目的 relations
- 分区加载时前端不卡顿

### 2.5 知识库导入/导出

- 支持导出整个知识库为 ZIP（含所有 JSON 文件）
- 支持从 ZIP 导入知识库（版本检查、合并确认）
- 导出时附带知识库统计信息

**验收标准：**
- 导出 ZIP 包含完整知识库，在其他实例中可导入

## 3. 接口定义

### 3.1 知识库 CRUD

```
GET    /api/v1/knowledge                 列表/搜索
GET    /api/v1/knowledge/:id             详情
PUT    /api/v1/knowledge/:id             编辑条目
DELETE /api/v1/knowledge/:id             软删除
POST   /api/v1/knowledge/:id/restore     恢复
GET    /api/v1/knowledge/trash           回收站
DELETE /api/v1/knowledge/trash/empty     清空回收站

POST   /api/v1/knowledge/:id/relations   添加关联
DELETE /api/v1/knowledge/:id/relations/:relationId  删除关联
```

### 3.2 版本与变更

```
GET    /api/v1/knowledge/:id/history     版本历史
GET    /api/v1/knowledge/changes         最近变更（?limit=10）
```

### 3.3 图谱

```
GET    /api/v1/graph                     图谱数据
GET    /api/v1/graph/node/:id            节点N度关系
```

### 3.4 导入导出

```
GET    /api/v1/knowledge/export          导出ZIP
POST   /api/v1/knowledge/import          导入ZIP
```

## 4. 前端组件设计

### 4.1 知识库管理页 (`pages/Knowledge.tsx`)

```
┌──────────────────────────────────────────────────┐
│  [搜索框━━━━━━━━━━━━━━] [分类选择] [排序] [视图]  │
│  ┌──────┐ ┌─────────────────────────────────────┐ │
│  │ 分类  │ │                                     │ │
│  │ ●人物 │ │  ┌──────┐ ┌──────┐ ┌──────┐       │ │
│  │ ●功法 │ │  │ 林动  │ │ 萧炎  │ │ 韩立  │       │ │
│  │ ●地图 │ │  │ 人物  │ │ 人物  │ │ 人物  │       │ │
│  │ ...  │ │  └──────┘ └──────┘ └──────┘       │ │
│  └──────┘ └─────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### 4.2 知识图谱页 (`pages/Graph.tsx`)

```
┌──────────────────────────────────────────────────┐
│  [布局切换] [筛选] [搜索节点] [导出]              │
│  ┌──────────────────────────────────────────────┐ │
│  │                                              │ │
│  │           Cytoscape 图谱区域                  │ │
│  │           (力导向布局)                        │ │
│  │                                              │ │
│  └──────────────────────────────────────────────┘ │
│  [图例: ●人物 ●功法 ●地图 ▲事件 ■武器]           │
└──────────────────────────────────────────────────┘
```

## 5. 非功能需求

- 知识条目数量 < 1000 时图谱加载 < 2 秒
- 搜索响应 < 200ms（SQLite 索引保障）
- 图谱在节点数 < 500 时交互流畅（60fps）
- 版本历史完整保留，不做定期清理

## 6. 文件清单

| 文件 | 说明 |
|------|------|
| `server/src/services/knowledge.ts` | 知识库CRUD服务 |
| `server/src/services/graph.ts` | 图谱数据服务 |
| `server/src/db/knowledge.ts` | SQLite知识索引操作 |
| `server/src/routes/knowledge.ts` | 知识库路由 |
| `server/src/routes/graph.ts` | 图谱路由 |
| `client/src/pages/Knowledge.tsx` | 知识库管理页 |
| `client/src/pages/Graph.tsx` | 知识图谱页 |
| `client/src/components/knowledge/KnowledgeList.tsx` | 条目列表 |
| `client/src/components/knowledge/KnowledgeDetail.tsx` | 条目详情 |
| `client/src/components/knowledge/VersionTimeline.tsx` | 版本时间线 |
| `client/src/components/knowledge/ChangeBanner.tsx` | 变更横幅 |
| `client/src/components/graph/GraphCanvas.tsx` | Cytoscape画布封装 |
| `client/src/components/graph/GraphFilter.tsx` | 图谱筛选面板 |
| `client/src/components/graph/NodeDetail.tsx` | 节点详情浮层 |
| `client/src/stores/knowledge.ts` | 知识库状态管理 |

## 7. 验收流程

1. 浏览知识库，切换分类，确认列表过滤正确
2. 搜索"林"找到匹配条目
3. 进入条目详情，查看到各属性和版本历史
4. 手动编辑一个属性，保存后版本号+1
5. 打开知识图谱，看到所有节点和关联边
6. 筛选分类、拖拽节点、缩放图谱，交互正常
7. 点击节点弹出详情浮层
8. 导出知识库 ZIP，删除某条目后重新导入恢复
