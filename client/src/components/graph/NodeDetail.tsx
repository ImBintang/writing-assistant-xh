// client/src/components/graph/NodeDetail.tsx
// Node detail floating panel (PRD-04 Section 2.4.2)

import type { GraphNode } from '../../services/knowledge';

const CATEGORY_NAMES: Record<string, string> = {
  characters: '人物',
  techniques: '功法',
  locations: '地图',
  worldbuilding: '世界观',
  weapons: '武器',
  alchemy: '丹药',
  plot: '情节',
};

interface Props {
  node: GraphNode;
  onClose: () => void;
}

export default function NodeDetail({ node, onClose }: Props) {
  const catName = CATEGORY_NAMES[node.category] || node.category;

  return (
    <div className="absolute top-4 left-4 z-20 max-w-sm bg-white rounded-lg shadow-xl border border-gray-200 p-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-gray-800 text-lg">{node.name}</h3>
          <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">
            {catName}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-2"
        >
          &times;
        </button>
      </div>

      {/* Attributes */}
      {node.attributes && Object.keys(node.attributes).length > 0 && (
        <div className="mb-3">
          <h4 className="text-xs font-semibold text-gray-500 mb-1">属性</h4>
          <div className="space-y-1">
            {Object.entries(node.attributes)
              .filter(([k]) => !['id', 'label', 'name', 'category', 'group', 'version'].includes(k))
              .slice(0, 6)
              .map(([key, value]) => (
                <div key={key} className="flex text-xs">
                  <span className="text-gray-400 w-20 flex-shrink-0">{key}</span>
                  <span className="text-gray-700 truncate">
                    {typeof value === 'string' ? (value.length > 40 ? value.slice(0, 40) + '...' : value) : String(value)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Version */}
      <div className="text-xs text-gray-400">
        v{node.version}
      </div>
    </div>
  );
}
