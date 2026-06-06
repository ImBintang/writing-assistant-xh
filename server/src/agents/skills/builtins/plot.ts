// server/src/agents/skills/builtins/plot.ts
// Built-in Skill: Plot (情节) Extraction

import type { SkillDefinition } from '../../../types/knowledge';

const plotSkill: SkillDefinition = {
  id: 'builtin-plot',
  name: '情节提取',
  category: 'plot',
  description: '提取小说中的情节事件信息，包括事件名称、类型、参与角色、发生地点及因果链',
  isBuiltIn: true,
  enabled: true,
  promptTemplate: `你是一个小说知识提取助手。请从以下章节内容中提取重要的情节事件信息。

## 提取规则
1. 只提取有明确情节意义的事件（转折、冲突、揭示、伏笔等）
2. 不确定的内容不要编造 — 留空或省略
3. 事件类型包括：战斗、修炼、突破、相遇、离别、揭示、转折、冲突、交易、历练等
4. 因果链描述事件的起因和结果
5. 伏笔标记用于标记可能影响后续情节的细节
6. 如果没有发现值得提取的情节事件，返回空数组

## 输出格式
返回一个 JSON 对象，包含 "entries" 数组。每个条目包含：
- name: 事件名称（必填）
- aliases: 别名（可选）
- attributes: 事件属性对象，可包含：
  - type: 事件类型（"战斗"/"修炼"/"突破"/"相遇"/"离别"/"揭示"/"转折"/"冲突"/"交易"/"历练"/"其他"）
  - participants: 参与角色（逗号分隔）
  - location: 发生地点
  - causeEffect: 因果链描述
  - foreshadowingFlag: 是否可能为伏笔（true/false）
  - foreshadowingDetail: 伏笔说明（如果foreshadowingFlag为true）
  - importance: 重要程度（"关键"/"重要"/"一般"）
- description: 事件综合描述（可选）
- relations: 与其他事件/条目的关系（可选）

## 原则
- 宁可漏提，不可编造
- 只输出 JSON，不要其他文字`,
  outputSchema: {
    type: 'object',
    properties: {
      entries: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '事件名称（必填）' },
            aliases: { type: 'array', items: { type: 'string' }, description: '别名' },
            attributes: {
              type: 'object',
              properties: {
                type: { type: 'string', description: '事件类型' },
                participants: { type: 'string', description: '参与角色（逗号分隔）' },
                location: { type: 'string', description: '发生地点' },
                causeEffect: { type: 'string', description: '因果链描述' },
                foreshadowingFlag: { type: 'boolean', description: '是否可能为伏笔' },
                foreshadowingDetail: { type: 'string', description: '伏笔说明' },
                importance: { type: 'string', description: '重要程度：关键/重要/一般' },
              },
              description: '情节事件属性',
            },
            description: { type: 'string', description: '事件综合描述' },
            relations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  targetName: { type: 'string' },
                  relationType: { type: 'string' },
                  description: { type: 'string' },
                },
                required: ['targetName', 'relationType'],
              },
            },
          },
          required: ['name', 'attributes'],
        },
        description: '提取的情节条目列表',
      },
    },
    required: ['entries'],
  },
};

export default plotSkill;
