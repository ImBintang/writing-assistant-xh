// server/src/agents/skills/registry.ts
// Skill Registry — manages built-in + custom skills

import path from 'path';
import fs from 'fs/promises';
import type { SkillDefinition } from '../../types/knowledge';
import { getWorkspaceRoot } from '../../utils/file';
import { createLogger } from '../../utils/logger';

// Import built-in skills
import characterSkill from './builtins/character';
import techniqueSkill from './builtins/technique';
import locationSkill from './builtins/location';
import worldbuildingSkill from './builtins/worldbuilding';
import weaponSkill from './builtins/weapon';
import alchemySkill from './builtins/alchemy';
import plotSkill from './builtins/plot';

const logger = createLogger('skill-registry');

const BUILTIN_SKILLS: SkillDefinition[] = [
  characterSkill,
  techniqueSkill,
  locationSkill,
  worldbuildingSkill,
  weaponSkill,
  alchemySkill,
  plotSkill,
];

// Category display name mapping
export const CATEGORY_NAMES: Record<string, string> = {
  characters: '人物',
  techniques: '功法',
  locations: '地图',
  worldbuilding: '世界观',
  weapons: '武器',
  alchemy: '丹药',
  plot: '情节',
};

class SkillRegistryImpl {
  private builtInSkills: Map<string, SkillDefinition> = new Map();
  private customSkills: Map<string, SkillDefinition> = new Map();

  constructor() {
    // Register all built-in skills
    for (const skill of BUILTIN_SKILLS) {
      this.builtInSkills.set(skill.id, { ...skill });
    }
    logger.info(`Registered ${BUILTIN_SKILLS.length} built-in skills`);
  }

  /**
   * Get all skills (built-in + custom), with custom skills taking precedence
   * for the same ID.
   */
  getAllSkills(): SkillDefinition[] {
    const skills = new Map<string, SkillDefinition>();

    // Built-in first (lower priority)
    for (const [id, skill] of this.builtInSkills) {
      skills.set(id, { ...skill });
    }

    // Custom override
    for (const [id, skill] of this.customSkills) {
      skills.set(id, { ...skill });
    }

    return Array.from(skills.values());
  }

  /**
   * Get enabled skills (for extraction).
   */
  getEnabledSkills(): SkillDefinition[] {
    return this.getAllSkills().filter((s) => s.enabled);
  }

  /**
   * Get a single skill by ID.
   */
  getSkill(id: string): SkillDefinition | undefined {
    return this.customSkills.get(id) ?? this.builtInSkills.get(id);
  }

  /**
   * Get skills filtered by category.
   */
  getSkillsByCategories(categories: string[]): SkillDefinition[] {
    const categorySet = new Set(categories);
    return this.getEnabledSkills().filter((s) => categorySet.has(s.category));
  }

  /**
   * Register a custom skill (overwrites if same ID).
   */
  registerCustomSkill(skill: SkillDefinition): void {
    this.customSkills.set(skill.id, { ...skill, isBuiltIn: false });
    logger.info(`Registered custom skill: ${skill.name} (${skill.id})`);
  }

  /**
   * Remove a custom skill.
   */
  unregisterCustomSkill(id: string): void {
    this.customSkills.delete(id);
    logger.info(`Unregistered custom skill: ${id}`);
  }

  /**
   * Load custom skills from disk (workspace/knowledge/_skills/).
   */
  async loadCustomSkills(): Promise<void> {
    try {
      const workspaceRoot = getWorkspaceRoot();
      const skillsDir = path.join(workspaceRoot, 'knowledge', '_skills');

      // Ensure directory exists
      await fs.mkdir(skillsDir, { recursive: true });

      const files = await fs.readdir(skillsDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      for (const file of jsonFiles) {
        try {
          const content = await fs.readFile(path.join(skillsDir, file), 'utf-8');
          const skill = JSON.parse(content) as SkillDefinition;
          this.registerCustomSkill(skill);
        } catch (err) {
          logger.warn(`Failed to load custom skill from ${file}:`, err);
        }
      }

      logger.info(`Loaded ${jsonFiles.length} custom skills from disk`);
    } catch (err) {
      logger.warn('Failed to load custom skills:', err);
    }
  }

  /**
   * Save a custom skill to disk.
   */
  async saveCustomSkillToDisk(skill: SkillDefinition): Promise<void> {
    const workspaceRoot = getWorkspaceRoot();
    const skillsDir = path.join(workspaceRoot, 'knowledge', '_skills');
    await fs.mkdir(skillsDir, { recursive: true });

    const filePath = path.join(skillsDir, `${skill.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(skill, null, 2), 'utf-8');
    logger.info(`Saved custom skill to: ${filePath}`);
  }

  /**
   * Delete a custom skill from disk.
   */
  async deleteCustomSkillFromDisk(id: string): Promise<void> {
    const workspaceRoot = getWorkspaceRoot();
    const filePath = path.join(workspaceRoot, 'knowledge', '_skills', `${id}.json`);

    try {
      await fs.unlink(filePath);
      logger.info(`Deleted custom skill file: ${filePath}`);
    } catch (err) {
      logger.warn(`Failed to delete custom skill file: ${filePath}`, err);
    }
  }

  /**
   * Check if a skill ID belongs to a built-in skill.
   */
  isBuiltIn(id: string): boolean {
    return this.builtInSkills.has(id) && !this.customSkills.has(id);
  }
}

// Singleton
let registryInstance: SkillRegistryImpl | null = null;

export function getSkillRegistry(): SkillRegistryImpl {
  if (!registryInstance) {
    registryInstance = new SkillRegistryImpl();
  }
  return registryInstance;
}

export function createSkillRegistry(): SkillRegistryImpl {
  registryInstance = new SkillRegistryImpl();
  return registryInstance;
}

export default getSkillRegistry;
