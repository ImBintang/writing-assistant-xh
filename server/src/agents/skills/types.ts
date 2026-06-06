// server/src/agents/skills/types.ts
// SkillDefinition interface and related types

import type { SkillDefinition } from '../../types/knowledge';

// Re-export for convenience
export type { SkillDefinition };

/**
 * Registry of all available skills (built-in + custom).
 * Built-in skills are defined as TypeScript constants.
 * Custom skills are loaded from JSON files in workspace/knowledge/_skills/.
 */
export interface SkillRegistry {
  getAllSkills(): SkillDefinition[];
  getSkill(id: string): SkillDefinition | undefined;
  getSkillsByCategories(categories: string[]): SkillDefinition[];
  registerCustomSkill(skill: SkillDefinition): void;
  unregisterCustomSkill(id: string): void;
  loadCustomSkills(): Promise<void>;
}
