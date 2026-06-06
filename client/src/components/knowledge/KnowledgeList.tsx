// client/src/components/knowledge/KnowledgeList.tsx
// Knowledge entry list — supports card and table views (PRD-04 Section 2.1)

import type { KnowledgeEntry } from '../../services/knowledge';

const CATEGORY_NAMES: Record<string, string> = {
  characters: '人物',
  techniques: '功法',
  locations: '地图',
  worldbuilding: '世界观',
  weapons: '武器',
  alchemy: '丹药',
  plot: '情节',
};

const CATEGORY_COLORS: Record<string, string> = {
  characters: 'bg-red-100 text-red-800',
  techniques: 'bg-blue-100 text-blue-800',
  locations: 'bg-green-100 text-green-800',
  worldbuilding: 'bg-purple-100 text-purple-800',
  weapons: 'bg-amber-100 text-amber-800',
  alchemy: 'bg-pink-100 text-pink-800',
  plot: 'bg-indigo-100 text-indigo-800',
};

interface Props {
  entries: KnowledgeEntry[];
  loading: boolean;
  viewMode: 'card' | 'table';
  onEntryClick: (entry: KnowledgeEntry) => void;
}

export default function KnowledgeList({ entries, loading, viewMode, onEntryClick }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <svg className="mx-auto h-12 w-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <p>该分类下暂无条目</p>
      </div>
    );
  }

  if (viewMode === 'table') {
    return <KnowledgeTable entries={entries} onEntryClick={onEntryClick} />;
  }

  return <KnowledgeCardGrid entries={entries} onEntryClick={onEntryClick} />;
}

function KnowledgeCardGrid({ entries, onEntryClick }: { entries: KnowledgeEntry[]; onEntryClick: (e: KnowledgeEntry) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {entries.map((entry) => (
        <KnowledgeCard key={entry.id} entry={entry} onClick={() => onEntryClick(entry)} />
      ))}
    </div>
  );
}

function KnowledgeCard({ entry, onClick }: { entry: KnowledgeEntry; onClick: () => void }) {
  const colorClass = CATEGORY_COLORS[entry.category] || 'bg-gray-100 text-gray-800';
  const catName = CATEGORY_NAMES[entry.category] || entry.category;

  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-indigo-300 cursor-pointer transition-all"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-gray-800 text-lg truncate flex-1">{entry.name}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${colorClass} ml-2 whitespace-nowrap`}>
          {catName}
        </span>
      </div>
      {entry.aliases && entry.aliases.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {entry.aliases.slice(0, 3).map((alias, i) => (
            <span key={i} className="text-xs text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">
              {alias}
            </span>
          ))}
          {entry.aliases.length > 3 && (
            <span className="text-xs text-gray-400">+{entry.aliases.length - 3}</span>
          )}
        </div>
      )}
      {entry.description && (
        <p className="text-sm text-gray-500 line-clamp-2 mb-3">{entry.description}</p>
      )}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>v{entry.version} · {entry.source?.length || 0} 个来源</span>
        <span>{new Date(entry.updatedAt).toLocaleDateString('zh-CN')}</span>
      </div>
    </div>
  );
}

function KnowledgeTable({ entries, onEntryClick }: { entries: KnowledgeEntry[]; onEntryClick: (e: KnowledgeEntry) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="pb-3 font-medium">名称</th>
            <th className="pb-3 font-medium">分类</th>
            <th className="pb-3 font-medium">别名</th>
            <th className="pb-3 font-medium">版本</th>
            <th className="pb-3 font-medium">来源章节</th>
            <th className="pb-3 font-medium">更新时间</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const catName = CATEGORY_NAMES[entry.category] || entry.category;
            const colorClass = CATEGORY_COLORS[entry.category] || 'bg-gray-100 text-gray-800';
            return (
              <tr
                key={entry.id}
                onClick={() => onEntryClick(entry)}
                className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <td className="py-3 font-medium text-gray-800">{entry.name}</td>
                <td className="py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${colorClass}`}>{catName}</span>
                </td>
                <td className="py-3 text-gray-500">
                  {(entry.aliases || []).slice(0, 3).join(', ')}
                  {(entry.aliases || []).length > 3 ? '...' : ''}
                </td>
                <td className="py-3 text-gray-500">v{entry.version}</td>
                <td className="py-3 text-gray-500">{entry.source?.length || 0} 章</td>
                <td className="py-3 text-gray-400">
                  {new Date(entry.updatedAt).toLocaleDateString('zh-CN')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
