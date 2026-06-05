# AI辅助写文助手 — 项目总览

## 项目目标

构建一个本地运行的轻量级AI辅助写文助手，帮助长篇小说作者进行：
- 章节拆解与知识提取归档
- 知识库管理与知识图谱可视化
- AI辅助撰写、补充与润色
- 设定构思与剧情头脑风暴

## 技术栈

| 维度 | 选择 |
|------|------|
| 前端框架 | React + Vite + TypeScript |
| 富文本编辑器 | TipTap |
| 知识图谱 | Cytoscape.js |
| 状态管理 | Zustand |
| 后端框架 | Node.js + Express (TypeScript) |
| AI Agent | Claude Agent SDK |
| AI多来源 | Claude API / OpenAI / 本地模型(预留) |
| 数据存储 | SQLite (索引查询) + JSON文件 (版本管理) |
| 脚本 | Python 3.10+ (文本处理) |
| 包管理 | pnpm (monorepo) |

## 项目结构

```
writing-assistant/
├── doc/                         # 项目文档与PRD
├── server/                      # 后端 (TypeScript + Express)
├── client/                      # 前端 (React + Vite)
├── scripts/                     # Python 脚本
├── workspace/                   # 用户工作区 (沙箱范围)
│   ├── originals/               # 原始上传txt
│   ├── chapters/                # 拆分后的章节
│   ├── knowledge/               # 知识库JSON
│   ├── settings/                # 待落地设定(隔离)
│   └── drafts/                  # 草稿/大纲
└── package.json                 # Monorepo根配置
```

## PRD文档索引

| 编号 | 名称 | 核心内容 | 依赖 |
|------|------|---------|------|
| PRD-01 | 项目初始化与基础架构 | 脚手架搭建、目录结构、基础配置、沙箱框架 | - |
| PRD-02 | 正文拆解与异常检测 | 章节正则拆分、异常检测、拆分报告 | PRD-01 |
| PRD-03 | 知识提取系统 | Agent+Skill知识提取、分类归档、合并去重 | PRD-02 |
| PRD-04 | 知识库管理与知识图谱 | 知识库CRUD、版本管理、图谱可视化 | PRD-03 |
| PRD-05 | 写文窗口 | TipTap编辑器、RAG检索、AI撰写润色 | PRD-04 |
| PRD-06 | 构思与头脑风暴 | 独立对话窗口、设定管理、隔离与迁移 | PRD-04 |
| PRD-07 | 功能安全性与配置管理 | 沙箱加固、多模型配置、上下文管理 | PRD-01~06 |

## 核心数据流

```
原始txt → [Python拆分] → 章节文件 → [Agent+Skill] → 知识条目 → [合并入知识库]
                                                                    ↓
作者大纲 ← [RAG检索知识库] ← [Agent撰写] → 草稿 → [Agent润色] → 完成
```

## 知识分类体系

| 分类 | 英文标识 | 说明 |
|------|---------|------|
| 人物 | character | 角色信息、外貌、性格、关系 |
| 功法 | technique | 修炼体系、功法、技能 |
| 地图 | location | 地理位置、势力范围 |
| 世界观 | worldbuilding | 时间线、规则、文化 |
| 武器 | weapon | 兵器、法宝 |
| 丹药 | alchemy | 丹药、药材、配方 |
| 情节 | plot | 剧情线、事件、伏笔 |

## 版本

- 项目版本: v0.1.0
- 文档更新: 2026-06-05
