// client/src/components/knowledge/KnowledgeList.tsx
// Knowledge entry list — card and table views

import type { KnowledgeEntry } from '../../services/knowledge';
import { Card } from '../ui/Card';

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
  characters:    'bg-red-50 text-red-700',
  techniques:    'bg-blue-50 text-blue-700',
  locations:     'bg-emerald-50 text-emerald-700',
  worldbuilding: 'bg-violet-50 text-violet-700',
  weapons:       'bg-amber-50 text-amber-700',
  alchemy:       'bg-pink-50 text-pink-700',
  plot:          'bg-indigo-50 text-indigo-700',
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
      <div className="text-center py-12 text-slate-400">
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
  const colorClass = CATEGORY_COLORS[entry.category] || 'bg-slate-100 text-slate-800';
  const catName = CATEGORY_NAMES[entry.category] || entry.category;

  return (
    <Card variant="hover" padding="md" onClick={onClick}>
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-slate-800 text-lg truncate flex-1">{entry.name}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass} ml-2 whitespace-nowrap`}>
          {catName}
        </span>
      </div>
      {entry.aliases && entry.aliases.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {entry.aliases.slice(0, 3).map((alias, i) => (
            <span key={i} className="text-xs text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">
              {alias}
            </span>
          ))}
          {entry.aliases.length > 3 && (
            <span className="text-xs text-slate-400">+{entry.aliases.length - 3}</span>
          )}
        </div>
      )}
      {entry.description && (
        <p className="text-sm text-slate-500 line-clamp-2 mb-3">{entry.description}</p>
      )}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>v{entry.version} · {entry.source?.length || 0} 个来源</span>
        <span>{new Date(entry.updatedAt).toLocaleDateString('zh-CN')}</span>
      </div>
    </Card>
  );
}

function KnowledgeTable({ entries, onEntryClick }: { entries: KnowledgeEntry[]; onEntryClick: (e: KnowledgeEntry) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
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
            const colorClass = CATEGORY_COLORS[entry.category] || 'bg-slate-100 text-slate-800';
            return (
              <tr
                key={entry.id}
                onClick={() => onEntryClick(entry)}
                className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <td className="py-3 font-medium text-slate-800">{entry.name}</td>
                <td className="py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}>{catName}</span>
                </td>
                <td className="py-3 text-slate-500">
                  {(entry.aliases || []).slice(0, 3).join(', ')}
                  {(entry.aliases || []).length > 3 ? '...' : ''}
                </td>
                <td className="py-3 text-slate-500">v{entry.version}</td>
                <td className="py-3 text-slate-500">{entry.source?.length || 0} 章</td>
                <td className="py-3 text-slate-400">
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
