// server/src/services/graph.ts
// Knowledge graph service — builds graph data from knowledge entries (PRD-04 Section 2.4)

import path from 'path';
import fs from 'fs/promises';
import { createLogger } from '../utils/logger';
import { getWorkspaceRoot } from '../utils/file';
import type {
  KnowledgeEntry,
  GraphNode,
  GraphEdge,
  RelationTypeDefinition,
} from '../types/knowledge';

const logger = createLogger('graph-service');

// Built-in relation types (PRD-04 Section 2.4.1)
const BUILTIN_RELATION_TYPES: RelationTypeDefinition[] = [
  { id: 'belongs_to', name: '隶属于', description: '角色→势力', bidirectional: false, isBuiltIn: true },
  { id: 'owns', name: '拥有', description: '角色→武器/功法', bidirectional: false, isBuiltIn: true },
  { id: 'appears_in', name: '登场于', description: '角色→地点/事件', bidirectional: false, isBuiltIn: true },
  { id: 'causes', name: '导致', description: '事件→事件', bidirectional: false, isBuiltIn: true },
  { id: 'located_in', name: '位于', description: '地点→地点', bidirectional: false, isBuiltIn: true },
  { id: 'related_to', name: '关联', description: '通用关联', bidirectional: true, isBuiltIn: true },
  { id: 'conflicts_with', name: '敌对', description: '敌对关系', bidirectional: true, isBuiltIn: true },
  { id: 'ally_of', name: '盟友', description: '盟友关系', bidirectional: true, isBuiltIn: true },
];

const CATEGORIES = [
  'characters',
  'techniques',
  'locations',
  'worldbuilding',
  'weapons',
  'alchemy',
  'plot',
];

// Custom relation types added by the user
let customRelationTypes: RelationTypeDefinition[] = [];

/**
 * Load custom relation types from disk.
 */
export async function loadCustomRelationTypes(): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  const settingsPath = path.join(workspaceRoot, 'settings', 'relation_types.json');
  try {
    const content = await fs.readFile(settingsPath, 'utf-8');
    customRelationTypes = JSON.parse(content) as RelationTypeDefinition[];
    logger.info(`Loaded ${customRelationTypes.length} custom relation types`);
  } catch {
    customRelationTypes = [];
  }
}

/**
 * Save custom relation types to disk.
 */
async function saveCustomRelationTypes(): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  const settingsPath = path.join(workspaceRoot, 'settings', 'relation_types.json');
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(customRelationTypes, null, 2), 'utf-8');
}

/**
 * Get all relation type definitions (built-in + custom).
 */
export function getAllRelationTypes(): RelationTypeDefinition[] {
  return [...BUILTIN_RELATION_TYPES, ...customRelationTypes];
}

/**
 * Add a custom relation type.
 */
export async function addCustomRelationType(
  relationType: RelationTypeDefinition,
): Promise<RelationTypeDefinition[]> {
  const existing = customRelationTypes.findIndex((r) => r.id === relationType.id);
  if (existing >= 0) {
    customRelationTypes[existing] = relationType;
  } else {
    customRelationTypes.push(relationType);
  }
  await saveCustomRelationTypes();
  return getAllRelationTypes();
}

/**
 * Load all non-deleted entries from all categories.
 */
async function loadAllEntries(
  categories?: string[],
): Promise<KnowledgeEntry[]> {
  const workspaceRoot = getWorkspaceRoot();
  const cats = categories || CATEGORIES;
  const entries: KnowledgeEntry[] = [];

  for (const category of cats) {
    const categoryDir = path.join(workspaceRoot, 'knowledge', category);
    try {
      const files = await fs.readdir(categoryDir);
      const jsonFiles = files.filter(
        (f) => f.endsWith('.json') && f !== '_index.json',
      );

      for (const file of jsonFiles) {
        try {
          const content = await fs.readFile(path.join(categoryDir, file), 'utf-8');
          const entry = JSON.parse(content) as KnowledgeEntry;
          if (!entry.deletedAt) {
            entries.push(entry);
          }
        } catch { /* skip malformed files */ }
      }
    } catch { /* directory might not exist */ }
  }

  return entries;
}

// Category display name mapping
const CATEGORY_NAMES: Record<string, string> = {
  characters: '人物',
  techniques: '功法',
  locations: '地图',
  worldbuilding: '世界观',
  weapons: '武器',
  alchemy: '丹药',
  plot: '情节',
};

// Category color mapping (for frontend visualization)
const CATEGORY_COLORS: Record<string, string> = {
  characters: '#ef4444',
  techniques: '#3b82f6',
  locations: '#10b981',
  worldbuilding: '#8b5cf6',
  weapons: '#f59e0b',
  alchemy: '#ec4899',
  plot: '#6366f1',
};

/**
 * Build graph data from knowledge entries.
 */
export async function buildGraph(options?: {
  categories?: string[];
  relationTypes?: string[];
  startNodeId?: string;
  depth?: number;
}): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const entries = await loadAllEntries(options?.categories);

  // Build lookup for entry existence
  const entryMap = new Map<string, KnowledgeEntry>();
  for (const entry of entries) {
    entryMap.set(entry.id, entry);
    // Also map by name for loose matching
    entryMap.set(entry.name, entry);
  }

  const nodeSet = new Set<string>();
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const entry of entries) {
    // Add node
    if (!nodeSet.has(entry.id)) {
      nodeSet.add(entry.id);
      nodes.push({
        id: entry.id,
        name: entry.name,
        category: entry.category,
        group: CATEGORY_NAMES[entry.category] || entry.category,
        version: entry.version,
        attributes: {
          aliases: entry.aliases,
          description: entry.description?.slice(0, 100) || '',
        },
      });
    }

    // Build edges from relations
    for (const relation of entry.relations) {
      // Filter by relation type if specified
      if (
        options?.relationTypes &&
        options.relationTypes.length > 0 &&
        !options.relationTypes.includes(relation.relationType)
      ) {
        continue;
      }

      // Resolve target
      let targetId = relation.targetId;
      if (!targetId || !entryMap.has(targetId)) {
        // Try to find by name
        const targetEntry = entryMap.get(relation.targetName);
        if (targetEntry && targetEntry.id !== entry.id) {
          targetId = targetEntry.id;
        } else {
          continue; // Can't resolve target, skip this edge
        }
      }

      // Don't create self-loops
      if (targetId === entry.id) continue;

      // Ensure target node exists
      if (!nodeSet.has(targetId)) {
        const targetEntry = entryMap.get(targetId);
        if (targetEntry) {
          nodeSet.add(targetId);
          nodes.push({
            id: targetEntry.id,
            name: targetEntry.name,
            category: targetEntry.category,
            group: CATEGORY_NAMES[targetEntry.category] || targetEntry.category,
            version: targetEntry.version,
            attributes: {
              aliases: targetEntry.aliases,
              description: targetEntry.description?.slice(0, 100) || '',
            },
          });
        }
      }

      const edgeId = `${entry.id}->${targetId}::${relation.relationType}`;

      // Deduplicate edges
      if (edges.some((e) => e.id === edgeId)) continue;

      edges.push({
        id: edgeId,
        source: entry.id,
        target: targetId,
        relationType: relation.relationType,
        label: relation.relationType,
        description: relation.description,
      });
    }
  }

  // Handle depth-based expansion (BFS from startNode)
  if (options?.startNodeId && options?.depth && options.depth > 1) {
    const visited = new Set<string>([options.startNodeId]);
    const queue: Array<{ id: string; level: number }> = [{ id: options.startNodeId, level: 0 }];
    const edgeSet = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.level >= (options.depth || 2)) continue;

      for (const edge of edges) {
        let neighborId: string | null = null;

        if (edge.source === current.id) {
          neighborId = edge.target;
        } else if (edge.target === current.id) {
          neighborId = edge.source;
        }

        if (neighborId && !visited.has(neighborId)) {
          visited.add(neighborId);
          edgeSet.add(edge.id);
          queue.push({ id: neighborId, level: current.level + 1 });
        } else if (neighborId) {
          // Edge to already visited node — still include
          edgeSet.add(edge.id);
        }
      }
    }

    // Filter to only included nodes and edges
    const filteredNodes = nodes.filter(
      (n) => visited.has(n.id) || n.id === options.startNodeId,
    );
    const filteredEdges = edges.filter(
      (e) => edgeSet.has(e.id) || e.source === options.startNodeId || e.target === options.startNodeId,
    );

    return { nodes: filteredNodes, edges: filteredEdges };
  }

  logger.info(`Built graph: ${nodes.length} nodes, ${edges.length} edges`);
  return { nodes, edges };
}

/**
 * Get a single node with its N-degree relations.
 */
export async function getNodeWithRelations(
  nodeId: string,
  depth: number = 2,
): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] } | null> {
  const entries = await loadAllEntries();
  const entry = entries.find((e) => e.id === nodeId);
  if (!entry) return null;

  return buildGraph({ startNodeId: nodeId, depth });
}

export { CATEGORY_NAMES, CATEGORY_COLORS };
