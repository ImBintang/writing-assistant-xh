// server/src/agents/skills/builtins/alchemy.ts
// Built-in Skill: Alchemy (丹药) Extraction

import type { SkillDefinition } from '../../../types/knowledge';

const alchemySkill: SkillDefinition = {
  id: 'builtin-alchemy',
  name: '丹药提取',
  category: 'alchemy',
  description: '提取小说中的丹药/灵药信息，包括名称、类型、品级、效果及炼制条件',
  isBuiltIn: true,
  enabled: true,
  promptTemplate: `你是一个小说知识提取助手。请从以下章节内容中提取所有出现的丹药/灵药/药剂等信息。

## 提取规则
1. 只提取明确在文中出现或有实质性描述的丹药
2. 不确定的属性不要编造 — 留空或省略
3. 丹药类型包括：疗伤、修炼、突破、延寿、解毒、强化、特殊等
4. 品级按原文描述（如"一品""九品""仙丹""神丹"等）
5. 如果没有发现任何丹药，返回空数组

## 输出格式
返回一个 JSON 对象，包含 "entries" 数组。每个条目包含：
- name: 丹药名称（必填）
- aliases: 别名列表（可选）
- attributes: 丹药属性对象，可包含：
  - type: 丹药类型（"疗伤"/"修炼"/"突破"/"延寿"/"解毒"/"强化"/"特殊"/"其他"）
  - grade: 品级
  - effects: 效果描述
  - recipe: 配方/主要材料
  - conditions: 炼制条件/要求
  - sideEffects: 副作用（可选）
- description: 丹药综合描述（可选）
- relations: 与其他条目的关系（可选）

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
            name: { type: 'string', description: '丹药名称（必填）' },
            aliases: { type: 'array', items: { type: 'string' }, description: '别名' },
            attributes: {
              type: 'object',
              properties: {
                type: { type: 'string', description: '丹药类型' },
                grade: { type: 'string', description: '品级' },
                effects: { type: 'string', description: '效果描述' },
                recipe: { type: 'string', description: '配方/主要材料' },
                conditions: { type: 'string', description: '炼制条件/要求' },
                sideEffects: { type: 'string', description: '副作用' },
              },
              description: '丹药属性',
            },
            description: { type: 'string', description: '丹药综合描述' },
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
        description: '提取的丹药条目列表',
      },
    },
    required: ['entries'],
  },
};

export default alchemySkill;
