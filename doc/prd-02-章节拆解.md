# PRD-02：正文拆解与异常检测

## 版本信息

| 字段 | 内容 |
|------|------|
| PRD编号 | PRD-02 |
| 版本 | v1.0 |
| 创建日期 | 2026-06-05 |
| 依赖 | PRD-01（项目初始化与基础架构） |

## 1. 需求概述

实现对长篇小说正文 txt 文件的智能拆分。按照"第**章"的正则模式匹配章节边界，拆分为独立章节文件，同时检测拆分异常（如正文中出现类似"第xx章"的表述导致错误切割），并生成拆分报告供作者确认。

## 2. 功能需求

### 2.1 正文上传与存储

**前端：**
- 提供文件上传组件（拖拽/点击上传）
- 支持 `.txt` 文件，编码自动检测（UTF-8 / GBK）
- 上传前显示文件大小、文件名、预估章节数
- 上传进度显示

**后端：**
- `POST /api/v1/chapters/upload` — 接收文件，存入 `workspace/originals/`
- 返回文件 ID 和基本信息
- 重复上传检测（文件哈希对比）

**验收标准：**
- 拖拽 txt 文件到上传区，文件成功上传
- GBK 编码文件被正确转码为 UTF-8
- 同名/同内容文件上传时提示已存在

### 2.2 章节拆分核心逻辑（Python）

脚本入口：`scripts/text_splitter.py`

#### 2.2.1 正则匹配规则

主匹配模式（按优先级）：

```python
patterns = [
    # 中文章节（支持阿拉伯数字 + 中文数字）
    # 匹配示例：第1章、第10章、第123章、第一章、第十章、第一百二十三章
    r'^第[零一二三四五六七八九十百千万\d]+章\s*.*$',

    # 中文卷/部/篇（长篇小说常用分段结构）
    # 匹配示例：第一卷、第二部、第三篇
    r'^第[零一二三四五六七八九十百千万\d]+[卷部篇]\s*.*$',

    # 中文章节（仅数字编号，无"第"字）
    # 匹配示例：1. 重生、1、重生
    r'^[零一二三四五六七八九十百千万\d]+[\.\、\s]+.*$',

    # 对应节
    r'^第[零一二三四五六七八九十百千万\d]+节\s*.*$',

    # 英文章节
    # 匹配示例：Chapter 1、CHAPTER 2
    r'^[Cc][Hh][Aa][Pp][Tt][Ee][Rr]\s+\d+.*$',
]
```

**编号归一化：** 匹配到的中文数字（如"一百二十三"）统一转换为阿拉伯数字序号（123），确保章节按数字顺序排列。

#### 2.2.2 拆分流程

1. 读取原始 txt，按行扫描
2. 匹配章节标题行，记录每个章节起始行号和标题
3. 将相邻章节标题之间的内容切分为一个章节文件
4. 输出到 `workspace/chapters/chapter_{NNN}.txt`（NNN 从 001 开始的三位编号）
5. 生成拆分元数据 JSON 保存到 `workspace/chapters/_meta.json`

#### 2.2.3 元数据结构

```json
{
  "sourceFile": "original.txt",
  "sourceHash": "sha256...",
  "totalChapters": 42,
  "encoding": "utf-8",
  "chapters": [
    {
      "index": 1,
      "title": "第一章 重生",
      "fileName": "chapter_001.txt",
      "lineStart": 1,
      "lineEnd": 823,
      "charCount": 4521
    }
  ],
  "anomalies": []
}
```

**验收标准：**
- `第一章 重生` 格式正确拆分（中文数字）
- `第1章 重生` 格式正确拆分（阿拉伯数字）
- `第123章 大结局` 格式正确拆分（多位数阿拉伯数字）
- `第一百二十三章 xxxx` 格式正确拆分（长篇中文数字）
- `Chapter 1: Rebirth` 英文格式正确拆分
- 章节编号连续，文件名有序
- 中文数字编号归一化为阿拉伯数字序号
- 每章内容完整，不丢失首尾段落

### 2.3 拆分异常检测

脚本入口：`scripts/split_validator.py`

#### 2.3.1 异常类型

| 异常类型 | 说明 | 严重度 |
|---------|------|--------|
| `orphan_title` | 正文中出现的类似"第xx章"表述（非真实章节标题） | 警告 |
| `missing_chapter` | 章节序号跳跃，如第7章后直接第9章 | 警告 |
| `duplicate_chapter` | 同一序号出现多次匹配 | 错误 |
| `empty_chapter` | 拆分出的章节内容过短（< 100字） | 警告 |
| `oversized_chapter` | 单章超过平均长度3倍 | 提示 |
| `title_format` | 章节标题格式不标准 | 提示 |

#### 2.3.2 检测算法

**orphan_title（核心检测）：**

1. 统计每个匹配行在原文中的上下文特征：
   - 该行前后是否为空行？（真正的章节标题通常是前后空行的独立行）
   - 该行是否是所在行的唯一内容？（无前后文混排）
   - 该行与下一个章节标题之间的内容量是否合理？（过短说明可能是正文引述）
   - 该行内容是否在原文其他位置也出现过？（重复出现多为引述/模仿）

2. 综合评分判定为 orphan_title

3. 将疑似 orphan_title 的行列在拆分报告中，供作者确认

**验收标准：**
- 输入包含"第三章"、"第八章"等正文文段的测试文本，系统能识别并标记
- 异常检测结果在报告中清晰展示

### 2.4 拆分报告与确认

**前端展示：**

- 拆分完成后跳转到章节管理页面
- 章节列表视图：序号、标题、字数、状态（正常/异常）
- 异常章节高亮标记，并提供"查看详情"按钮
- 支持手动合并、拆分、重命名章节
- "确认拆分" 按钮，确认后将章节固化（不可再自动拆分）

**后端 API：**

```
POST   /api/v1/chapters/upload       上传并触发拆分
GET    /api/v1/chapters              章节列表
GET    /api/v1/chapters/:id          获取章节内容
GET    /api/v1/chapters/:id/raw      获取原始未分段内容
PUT    /api/v1/chapters/:id          更新章节（手动修改标题/内容）
POST   /api/v1/chapters/merge        合并章节
POST   /api/v1/chapters/split        手动拆分章节
POST   /api/v1/chapters/confirm      确认拆分结果
GET    /api/v1/chapters/anomalies    获取异常列表
```

**验收标准：**
- 拆分报告页面展示全部章节，异常项标红/黄
- 手动修改章节内容后能保存
- 确认拆分后状态变为"已确认"

## 3. 接口定义

### 3.1 章节拆分

```
POST   /api/v1/chapters/upload      上传txt并拆分
  Request: multipart/form-data { file }
  Response: { sourceId, totalChapters, anomalies }

GET    /api/v1/chapters              章节列表（支持 ?status=anomaly 筛选）
  Response: { chapters: ChapterMeta[], total }

GET    /api/v1/chapters/:id          章节完整内容
  Response: { meta: ChapterMeta, content: string }

PUT    /api/v1/chapters/:id          更新章节
  Request: { title?, content? }
  Response: ChapterMeta

POST   /api/v1/chapters/merge        合并相邻章节
  Request: { chapterIds: string[] }
  Response: ChapterMeta

POST   /api/v1/chapters/split        手动拆分某章
  Request: { chapterId, splitAtLine: number }
  Response: ChapterMeta[]

POST   /api/v1/chapters/confirm      确认拆分
  Response: { status: "confirmed" }
```

## 4. 非功能需求

- Python 脚本需通过 Node.js `child_process.spawn` 调用，传入参数 JSON
- 拆分大型 txt（> 100万字）应在 30 秒内完成
- 所有文件操作限制在 `workspace/` 下

## 5. 文件清单

| 文件 | 说明 |
|------|------|
| `scripts/text_splitter.py` | 章节拆分主脚本 |
| `scripts/split_validator.py` | 异常检测脚本 |
| `scripts/requirements.txt` | Python依赖（无第三方依赖，仅标准库） |
| `server/src/services/splitter.ts` | 调用Python脚本的服务 |
| `server/src/routes/chapters.ts` | 章节相关路由 |
| `client/src/pages/Chapters.tsx` | 章节管理页面 |
| `client/src/components/chapter/Uploader.tsx` | 文件上传组件 |
| `client/src/components/chapter/ChapterList.tsx` | 章节列表组件 |
| `client/src/components/chapter/AnomalyBadge.tsx` | 异常标记组件 |

## 6. 验收流程

1. 上传一个包含42章的标准格式中文小说 txt
2. 查看拆分结果，确认章节数量正确，每章内容完整
3. 上传一个包含正文中"第xx章"引述的特殊 txt
4. 查看异常检测报告，确认引述内容被标记
5. 手动合并两个章节，确认生效
6. 点击确认拆分，状态更新
