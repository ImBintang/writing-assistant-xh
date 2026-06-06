// server/src/agents/skills/builtins/location.ts
// Built-in Skill: Location (地图) Extraction

import type { SkillDefinition } from '../../../types/knowledge';

const locationSkill: SkillDefinition = {
  id: 'builtin-location',
  name: '地图提取',
  category: 'locations',
  description: '提取小说中的地点/场景信息，包括地名、类型、地理位置、所属势力及环境描述',
  isBuiltIn: true,
  enabled: true,
  promptTemplate: `你是一个小说知识提取助手。请从以下章节内容中提取所有出现的地点/场景信息。

## 提取规则
1. 提取有名称或明确描述的地点/场景
2. 不确定的属性不要编造 — 留空或省略
3. 地点类型包括：城市、宗门、学院、山脉、森林、秘境、宫殿、洞府等
4. 地理位置描述相对于已知地点
5. 如果没有发现任何地点，返回空数组

## 输出格式
返回一个 JSON 对象，包含 "entries" 数组。每个地点条目包含：
- name: 地名（必填）
- aliases: 别名列表（可选）
- attributes: 地点属性对象，可包含：
  - type: 地点类型（"城市"/"宗门"/"学院"/"山脉"/"森林"/"秘境"/"宫殿"/"洞府"/"其他"）
  - geography: 地理位置描述
  - faction: 所属势力
  - environment: 环境描述
  - firstMention: 首次提及信息
  - significance: 重要程度（"主要场景"/"次要场景"/"提及"）
- description: 地点综合描述（可选）
- relations: 与其他地点的关系（可选）

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
            name: { type: 'string', description: '地名（必填）' },
            aliases: { type: 'array', items: { type: 'string' }, description: '别名' },
            attributes: {
              type: 'object',
              properties: {
                type: { type: 'string', description: '地点类型' },
                geography: { type: 'string', description: '地理位置描述' },
                faction: { type: 'string', description: '所属势力' },
                environment: { type: 'string', description: '环境描述' },
                firstMention: { type: 'string', description: '首次提及信息' },
                significance: { type: 'string', description: '重要程度：主要场景/次要场景/提及' },
              },
              description: '地点属性',
            },
            description: { type: 'string', description: '地点综合描述' },
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
        description: '提取的地点条目列表',
      },
    },
    required: ['entries'],
  },
};

export default locationSkill;
