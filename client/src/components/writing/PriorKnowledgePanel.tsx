// client/src/components/writing/PriorKnowledgePanel.tsx
// Prior knowledge sidebar panel for PRD-05
// Displays RAG retrieval results partitioned by category

import { useState } from 'react';
import { useWriting } from '../../hooks/useWriting';

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  characters: { label: '人物', color: 'bg-blue-100 text-blue-800', icon: '👤' },
  techniques: { label: '功法', color: 'bg-purple-100 text-purple-800', icon: '⚔' },
  locations: { label: '地点', color: 'bg-green-100 text-green-800', icon: '📍' },
  worldbuilding: { label: '世界观', color: 'bg-amber-100 text-amber-800', icon: '🌍' },
  weapons: { label: '武器', color: 'bg-red-100 text-red-800', icon: '🗡' },
  alchemy: { label: '丹药', color: 'bg-emerald-100 text-emerald-800', icon: '🧪' },
  plot: { label: '情节/伏笔', color: 'bg-pink-100 text-pink-800', icon: '📖' },
};

export default function PriorKnowledgePanel() {
  const priorKnowledge = useWriting((s) => s.priorKnowledge);
  const knowledgeLoading = useWriting((s) => s.knowledgeLoading);
  const retrieveKnowledge = useWriting((s) => s.retrieveKnowledge);
  const knowledgePanelOpen = useWriting((s) => s.knowledgePanelOpen);
  const toggleKnowledgePanel = useWriting((s) => s.toggleKnowledgePanel);

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['characters', 'locations', 'plot']),
  );
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const toggleEntry = (id: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Count entries
  const totalEntries = priorKnowledge
    ? Object.values(CATEGORY_CONFIG).reduce((sum, _, i) => {
        const key = Object.keys(CATEGORY_CONFIG)[i];
        return sum + ((priorKnowledge as unknown as Record<string, unknown[]>)[key]?.length || 0);
      }, 0)
    : 0;

  return (
    <div className="w-72 border-l border-gray-200 bg-white overflow-y-auto flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-gray-700">先验知识</span>
          {totalEntries > 0 && (
            <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">
              {totalEntries}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => retrieveKnowledge()}
            disabled={knowledgeLoading}
            className={`text-xs px-2 py-0.5 rounded transition-colors cursor-pointer ${
              knowledgeLoading
                ? 'bg-gray-100 text-gray-400 cursor-wait'
                : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
            }`}
          >
            {knowledgeLoading ? '检索中...' : '刷新'}
          </button>
          <button
            type="button"
            onClick={toggleKnowledgePanel}
            className="text-xs px-1.5 py-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded cursor-pointer"
            title="收起面板"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Summary */}
      {priorKnowledge?.summary && (
        <div className="px-3 py-2 text-xs text-gray-600 bg-indigo-50/50 border-b border-gray-100">
          {priorKnowledge.summary}
        </div>
      )}

      {/* Loading */}
      {knowledgeLoading && !priorKnowledge && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
          <span className="ml-2 text-sm text-gray-500">检索知识中...</span>
        </div>
      )}

      {/* Empty state */}
      {!priorKnowledge && !knowledgeLoading && (
        <div className="flex flex-col items-center justify-center py-8 px-4">
          <span className="text-2xl mb-2">📚</span>
          <p className="text-xs text-gray-500 text-center">
            输入大纲或正文内容后，点击"刷新"检索相关知识
          </p>
        </div>
      )}

      {/* Categories */}
      <div className="flex-1 overflow-y-auto">
        {priorKnowledge &&
          Object.entries(CATEGORY_CONFIG).map(([cat, cfg]) => {
            const entries = (priorKnowledge as unknown as Record<string, unknown[]>)[cat] || [];
            if (entries.length === 0) return null;

            const isExpanded = expandedCategories.has(cat);

            return (
              <div key={cat} className="border-b border-gray-100">
                {/* Category Header */}
                <button
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <span>{isExpanded ? '▾' : '▸'}</span>
                    <span className="text-sm font-medium text-gray-700">
                      {cfg.icon} {cfg.label}
                    </span>
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${cfg.color}`}>
                    {entries.length}
                  </span>
                </button>

                {/* Entries */}
                {isExpanded && (
                  <div className="pb-1">
                    {entries.slice(0, 10).map((entry: any) => {
                      const isEntryExpanded = expandedEntries.has(entry.id);
                      return (
                        <div key={entry.id} className="px-2">
                          <button
                            type="button"
                            onClick={() => toggleEntry(entry.id)}
                            className="w-full text-left px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
                          >
                            <div className="flex items-start justify-between">
                              <span className="text-sm text-gray-800 font-medium truncate flex-1">
                                {entry.name}
                              </span>
                              <span className="text-xs text-gray-400 ml-1">
                                {isEntryExpanded ? '▲' : '▼'}
                              </span>
                            </div>
                            {!isEntryExpanded && entry.description && (
                              <p className="text-xs text-gray-500 truncate mt-0.5">
                                {entry.description.slice(0, 60)}
                              </p>
                            )}
                          </button>

                          {/* Expanded details */}
                          {isEntryExpanded && (
                            <div className="px-2 pb-2 ml-2 border-l-2 border-gray-200">
                              {entry.aliases && entry.aliases.length > 0 && (
                                <p className="text-xs text-gray-500 mt-1">
                                  别名：{entry.aliases.join('、')}
                                </p>
                              )}
                              {entry.description && (
                                <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap line-clamp-4">
                                  {entry.description}
                                </p>
                              )}
                              {entry.attributes &&
                                Object.keys(entry.attributes).length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {Object.entries(entry.attributes)
                                      .filter(([, v]) => v !== undefined && v !== null && v !== '')
                                      .slice(0, 5)
                                      .map(([k, v]) => (
                                        <span
                                          key={k}
                                          className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded"
                                        >
                                          {k}: {String(v)}
                                        </span>
                                      ))}
                                  </div>
                                )}
                              {entry.source && entry.source.length > 0 && (
                                <p className="text-xs text-gray-400 mt-1">
                                  来源：第{entry.source.map((s: any) => s.chapter).join('、')}章
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {entries.length > 10 && (
                      <p className="text-xs text-gray-400 px-3 py-1">
                        还有 {entries.length - 10} 条...
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Previous Chapter Context */}
      {priorKnowledge?.previousChapter && (
        <div className="border-t border-gray-200 bg-amber-50 px-3 py-2">
          <p className="text-xs font-medium text-amber-800 mb-1">
            📄 上一章结尾
          </p>
          <p className="text-xs text-amber-700 leading-relaxed whitespace-pre-wrap line-clamp-4">
            {priorKnowledge.previousChapter}
          </p>
        </div>
      )}
    </div>
  );
}
