// server/src/agents/skills/builtins/character.ts
// Built-in Skill: Character (人物) Extraction

import type { SkillDefinition } from '../../../types/knowledge';

const characterSkill: SkillDefinition = {
  id: 'builtin-character',
  name: '人物提取',
  category: 'characters',
  description: '提取小说中的人物信息，包括姓名、别名、性别、年龄、外貌、性格、身份、关系及首次出场',
  isBuiltIn: true,
  enabled: true,
  promptTemplate: `你是一个小说知识提取助手。请从以下章节内容中提取所有出现的人物信息。

## 提取规则
1. 只提取明确在文中出现或有实质性描述的人物
2. 不确定的属性不要编造 — 留空或省略
3. 别名可能包含绰号、尊称、小名、化名等
4. 关系描述应具体（如"林动的父亲"，而非笼统的"父子"）
5. 首次出场描述应引用原文片段
6. 如果没有发现任何人物，返回空数组

## 输出格式
返回一个 JSON 对象，包含 "entries" 数组。每个人物条目包含：
- name: 人物姓名（必填）
- aliases: 别名列表（可选，字符串数组）
- attributes: 人物属性对象，可包含：
  - gender: 性别（"男"/"女"/"未知"）
  - age: 年龄（数字或描述如"约30岁"）
  - appearance: 外貌描述
  - personality: 性格描述
  - identity: 身份/职业
  - realm: 修为境界（修炼小说）
  - status: 状态（"存活"/"已死亡"/"未知"）
  - firstAppearance: 首次出场描述
- description: 人物综合描述（可选）
- relations: 与其他人物/势力的关系列表（可选）
  每项包含 targetName（对象名称）、relationType（关系类型）、description（关系描述）

## 示例
{
  "entries": [
    {
      "name": "林动",
      "aliases": ["动儿", "林公子"],
      "attributes": {
        "gender": "男",
        "age": 16,
        "appearance": "少年模样，面容清秀",
        "personality": "坚毅果敢，不服输",
        "identity": "林氏宗族子弟",
        "realm": "淬体境",
        "firstAppearance": "第一章，林家庭院中修炼"
      },
      "description": "林氏宗族的年轻子弟，天赋卓绝",
      "relations": [
        { "targetName": "林啸", "relationType": "父子", "description": "林动的父亲" }
      ]
    }
  ]
}

## 原则
- 宁可漏提，不可编造
- 属性信息不足时留空
- 只输出 JSON，不要其他文字`,
  outputSchema: {
    type: 'object',
    properties: {
      entries: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '人物姓名（必填）' },
            aliases: {
              type: 'array',
              items: { type: 'string' },
              description: '别名列表，包括绰号、尊称、小名等',
            },
            attributes: {
              type: 'object',
              properties: {
                gender: { type: 'string', description: '性别：男/女/未知' },
                age: { description: '年龄，可以是数字或描述性文字' },
                appearance: { type: 'string', description: '外貌描述' },
                personality: { type: 'string', description: '性格描述' },
                identity: { type: 'string', description: '身份/职业' },
                realm: { type: 'string', description: '修为境界' },
                status: { type: 'string', description: '存活状态' },
                firstAppearance: { type: 'string', description: '首次出场描述' },
              },
              description: '人物属性，所有字段可选',
            },
            description: { type: 'string', description: '人物综合描述' },
            relations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  targetName: { type: 'string', description: '关系对象名称' },
                  relationType: { type: 'string', description: '关系类型，如父子、师徒、敌对' },
                  description: { type: 'string', description: '关系描述' },
                },
                required: ['targetName', 'relationType'],
              },
              description: '与其他人物/势力的关系',
            },
          },
          required: ['name', 'attributes'],
        },
        description: '提取的人物条目列表',
      },
    },
    required: ['entries'],
  },
};

export default characterSkill;
