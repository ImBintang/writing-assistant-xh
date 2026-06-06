// client/src/components/writing/PriorKnowledgePanel.tsx
// Prior knowledge content — used inside Drawer

import { useState } from 'react';
import { useWriting } from '../../hooks/useWriting';

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  characters: { label: '人物', color: 'bg-blue-100 text-blue-800', icon: '👤' },
  techniques: { label: '功法', color: 'bg-violet-100 text-violet-800', icon: '⚔' },
  locations: { label: '地点', color: 'bg-emerald-100 text-emerald-800', icon: '📍' },
  worldbuilding: { label: '世界观', color: 'bg-amber-100 text-amber-800', icon: '🌍' },
  weapons: { label: '武器', color: 'bg-red-100 text-red-800', icon: '🗡' },
  alchemy: { label: '丹药', color: 'bg-emerald-100 text-emerald-800', icon: '🧪' },
  plot: { label: '情节/伏笔', color: 'bg-pink-100 text-pink-800', icon: '📖' },
};

export default function PriorKnowledgePanel() {
  const priorKnowledge = useWriting((s) => s.priorKnowledge);
  const knowledgeLoading = useWriting((s) => s.knowledgeLoading);
  const retrieveKnowledge = useWriting((s) => s.retrieveKnowledge);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['characters', 'locations', 'plot']));
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  const toggleCategory = (cat: string) => { setExpandedCategories((prev) => { const next = new Set(prev); next.has(cat) ? next.delete(cat) : next.add(cat); return next; }); };
  const toggleEntry = (id: string) => { setExpandedEntries((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; }); };

  const totalEntries = priorKnowledge ? Object.values(CATEGORY_CONFIG).reduce((sum, _, i) => { const key = Object.keys(CATEGORY_CONFIG)[i]; return sum + ((priorKnowledge as unknown as Record<string, unknown[]>)[key]?.length || 0); }, 0) : 0;

  return (
    <div className="flex flex-col h-full">
      {/* 操作栏 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">先验知识</span>
          {totalEntries > 0 && <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">{totalEntries}</span>}
        </div>
        <button
          type="button"
          onClick={() => retrieveKnowledge()}
          disabled={knowledgeLoading}
          className={`text-xs px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
            knowledgeLoading
              ? 'bg-slate-100 text-slate-400 cursor-wait'
              : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-medium'
          }`}
        >{knowledgeLoading ? '检索中...' : '刷新检索'}</button>
      </div>

      {priorKnowledge?.summary && <div className="px-4 py-2.5 text-xs text-slate-600 bg-indigo-50/30 border-b border-slate-100">{priorKnowledge.summary}</div>}

      {knowledgeLoading && !priorKnowledge && (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
          <span className="ml-2.5 text-sm text-slate-500">检索知识中...</span>
        </div>
      )}

      {!priorKnowledge && !knowledgeLoading && (
        <div className="flex flex-col items-center justify-center py-10 px-4">
          <span className="text-2xl mb-2">📚</span>
          <p className="text-xs text-slate-500 text-center">输入大纲或正文内容后，点击"刷新检索"检索相关知识</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {priorKnowledge && Object.entries(CATEGORY_CONFIG).map(([cat, cfg]) => {
          const entries = (priorKnowledge as unknown as Record<string, unknown[]>)[cat] || [];
          if (entries.length === 0) return null;
          const isExpanded = expandedCategories.has(cat);
          return (
            <div key={cat} className="border-b border-slate-100">
              <button type="button" onClick={() => toggleCategory(cat)} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors">
                <span className="flex items-center gap-2"><span className="text-xs">{isExpanded ? '▾' : '▸'}</span><span className="text-sm font-medium text-slate-700">{cfg.icon} {cfg.label}</span></span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${cfg.color}`}>{entries.length}</span>
              </button>
              {isExpanded && (
                <div className="pb-1">
                  {entries.slice(0, 10).map((entry: any) => {
                    const isEntryExpanded = expandedEntries.has(entry.id);
                    return (
                      <div key={entry.id} className="px-2">
                        <button type="button" onClick={() => toggleEntry(entry.id)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                          <div className="flex items-start justify-between"><span className="text-sm text-slate-800 font-medium truncate flex-1">{entry.name}</span><span className="text-xs text-slate-400 ml-1">{isEntryExpanded ? '▲' : '▼'}</span></div>
                          {!isEntryExpanded && entry.description && <p className="text-xs text-slate-500 truncate mt-0.5">{entry.description.slice(0, 60)}</p>}
                        </button>
                        {isEntryExpanded && (
                          <div className="px-3 pb-3 ml-2 border-l-2 border-slate-200">
                            {entry.aliases && entry.aliases.length > 0 && <p className="text-xs text-slate-500 mt-1">别名：{entry.aliases.join('、')}</p>}
                            {entry.description && <p className="text-xs text-slate-600 mt-1.5 whitespace-pre-wrap line-clamp-4">{entry.description}</p>}
                            {entry.attributes && Object.keys(entry.attributes).length > 0 && (<div className="mt-1.5 flex flex-wrap gap-1">{Object.entries(entry.attributes).filter(([, v]) => v !== undefined && v !== null && v !== '').slice(0, 5).map(([k, v]) => (<span key={k} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{k}: {String(v)}</span>))}</div>)}
                            {entry.source && entry.source.length > 0 && <p className="text-xs text-slate-400 mt-1">来源：第{entry.source.map((s: any) => s.chapter).join('、')}章</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {entries.length > 10 && <p className="text-xs text-slate-400 px-4 py-1">还有 {entries.length - 10} 条...</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {priorKnowledge?.previousChapter && (
        <div className="border-t border-slate-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-semibold text-amber-800 mb-1">📄 上一章结尾</p>
          <p className="text-xs text-amber-700 leading-relaxed whitespace-pre-wrap line-clamp-4">{priorKnowledge.previousChapter}</p>
        </div>
      )}
    </div>
  );
}
