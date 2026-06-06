// client/src/components/graph/NodeDetail.tsx
// Node detail floating panel — animate-fade-in now works

import type { GraphNode } from '../../services/knowledge';
import { Badge } from '../ui/Badge';

const CATEGORY_NAMES: Record<string, string> = {
  characters: '人物', techniques: '功法', locations: '地图',
  worldbuilding: '世界观', weapons: '武器', alchemy: '丹药', plot: '情节',
};

interface Props { node: GraphNode; onClose: () => void; }

export default function NodeDetail({ node, onClose }: Props) {
  const catName = CATEGORY_NAMES[node.category] || node.category;

  return (
    <div className="absolute top-4 left-4 z-20 max-w-sm bg-white rounded-card shadow-modal border border-slate-200 p-4 animate-fade-in">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-slate-800 text-lg">{node.name}</h3>
          <Badge variant="info" className="mt-0.5">{catName}</Badge>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none ml-2">&times;</button>
      </div>
      {node.attributes && Object.keys(node.attributes).length > 0 && (
        <div className="mb-3">
          <h4 className="text-xs font-semibold text-slate-500 mb-1">属性</h4>
          <div className="space-y-1">
            {Object.entries(node.attributes).filter(([k]) => !['id', 'label', 'name', 'category', 'group', 'version'].includes(k)).slice(0, 6).map(([key, value]) => (
              <div key={key} className="flex text-xs">
                <span className="text-slate-400 w-20 flex-shrink-0">{key}</span>
                <span className="text-slate-700 truncate">{typeof value === 'string' ? (value.length > 40 ? value.slice(0, 40) + '...' : value) : String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="text-xs text-slate-400">v{node.version}</div>
    </div>
  );
}
