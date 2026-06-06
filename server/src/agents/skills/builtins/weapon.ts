// server/src/agents/skills/builtins/weapon.ts
// Built-in Skill: Weapon (武器) Extraction

import type { SkillDefinition } from '../../../types/knowledge';

const weaponSkill: SkillDefinition = {
  id: 'builtin-weapon',
  name: '武器提取',
  category: 'weapons',
  description: '提取小说中的武器/法宝信息，包括名称、类型、品级、特性及持有者',
  isBuiltIn: true,
  enabled: true,
  promptTemplate: `你是一个小说知识提取助手。请从以下章节内容中提取所有出现的武器/法宝/灵宝等信息。

## 提取规则
1. 只提取明确在文中出现或有实质性描述的武器/法宝
2. 不确定的属性不要编造 — 留空或省略
3. 武器类型包括：剑、刀、枪、戟、弓、暗器、灵宝、法宝、阵旗、符箓等
4. 品级按原文描述（如"灵器""仙器""神器"或"一阶""九阶"等）
5. 如果没有发现任何武器，返回空数组

## 输出格式
返回一个 JSON 对象，包含 "entries" 数组。每个条目包含：
- name: 武器名称（必填）
- aliases: 别名列表（可选）
- attributes: 武器属性对象，可包含：
  - type: 武器类型（"剑"/"刀"/"枪"/"戟"/"弓"/"暗器"/"灵宝"/"法宝"/"阵旗"/"符箓"/"其他"）
  - grade: 品级
  - traits: 特性描述（能力/效果）
  - owner: 持有者
  - origin: 来历/出处
  - status: 现状（"完好"/"损毁"/"遗失"/"封印"等）
- description: 武器综合描述（可选）
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
            name: { type: 'string', description: '武器名称（必填）' },
            aliases: { type: 'array', items: { type: 'string' }, description: '别名' },
            attributes: {
              type: 'object',
              properties: {
                type: { type: 'string', description: '武器类型' },
                grade: { type: 'string', description: '品级' },
                traits: { type: 'string', description: '特性描述' },
                owner: { type: 'string', description: '持有者' },
                origin: { type: 'string', description: '来历/出处' },
                status: { type: 'string', description: '现状' },
              },
              description: '武器属性',
            },
            description: { type: 'string', description: '武器综合描述' },
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
        description: '提取的武器条目列表',
      },
    },
    required: ['entries'],
  },
};

export default weaponSkill;
