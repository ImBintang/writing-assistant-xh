// server/src/agents/skills/builtins/technique.ts
// Built-in Skill: Technique (功法) Extraction

import type { SkillDefinition } from '../../../types/knowledge';

const techniqueSkill: SkillDefinition = {
  id: 'builtin-technique',
  name: '功法提取',
  category: 'techniques',
  description: '提取小说中的功法、武技、秘术等信息，包括名称、类型、等级、效果及修炼条件',
  isBuiltIn: true,
  enabled: true,
  promptTemplate: `你是一个小说知识提取助手。请从以下章节内容中提取所有出现的功法/武技/秘术信息。

## 提取规则
1. 只提取明确在文中出现或有实质性描述的功法
2. 不确定的属性不要编造 — 留空或省略
3. 功法等级按原文描述，如"黄阶低级""天阶""圣级"等
4. 修炼条件包括体质要求、境界要求、特殊条件等
5. 如果没有发现任何功法，返回空数组

## 输出格式
返回一个 JSON 对象，包含 "entries" 数组。每条功法包含：
- name: 功法名称（必填）
- aliases: 别名列表（可选）
- attributes: 功法属性对象，可包含：
  - type: 功法类型（"功法"/"武技"/"秘术"/"身法"/"阵法"/"其他"）
  - level: 等级品阶
  - effects: 效果描述
  - conditions: 修炼条件
  - owner: 所属角色/势力
  - source: 功法来源/出处
  - element: 属性（如"火""冰""雷"等，可选）
- description: 功法综合描述（可选）
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
            name: { type: 'string', description: '功法名称（必填）' },
            aliases: { type: 'array', items: { type: 'string' }, description: '别名' },
            attributes: {
              type: 'object',
              properties: {
                type: { type: 'string', description: '功法类型：功法/武技/秘术/身法/阵法/其他' },
                level: { type: 'string', description: '等级品阶' },
                effects: { type: 'string', description: '效果描述' },
                conditions: { type: 'string', description: '修炼条件' },
                owner: { type: 'string', description: '所属角色/势力' },
                source: { type: 'string', description: '功法来源/出处' },
                element: { type: 'string', description: '属性（火/冰/雷等）' },
              },
              description: '功法属性',
            },
            description: { type: 'string', description: '功法综合描述' },
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
        description: '提取的功法条目列表',
      },
    },
    required: ['entries'],
  },
};

export default techniqueSkill;
