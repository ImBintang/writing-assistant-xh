// client/src/components/writing/WritingSidebar.tsx
// Floating writing assistant sidebar for PRD-05
// Shows real-time context hints by cross-referencing current body text
// with prior knowledge entities.

import { useMemo, useState } from 'react';
import { useWriting } from '../../hooks/useWriting';

export default function WritingSidebar() {
  const priorKnowledge = useWriting((s) => s.priorKnowledge);
  const body = useWriting((s) => s.body);
  const sidebarOpen = useWriting((s) => s.sidebarOpen);
  const toggleSidebar = useWriting((s) => s.toggleSidebar);

  const [expandedHints, setExpandedHints] = useState(true);

  // Cross-reference current body text with prior knowledge to find mentioned entities
  const mentionedEntities = useMemo(() => {
    if (!priorKnowledge || !body) return [];

    const allCategories = [
      ...(priorKnowledge.characters || []),
      ...(priorKnowledge.locations || []),
      ...(priorKnowledge.techniques || []),
      ...(priorKnowledge.worldbuilding || []),
      ...(priorKnowledge.weapons || []),
      ...(priorKnowledge.alchemy || []),
      ...(priorKnowledge.plot || []),
    ];

    return allCategories
      .filter((e) => {
        // Check if entity name appears in current body text
        if (body.includes(e.name)) return true;
        // Also check aliases
        if (e.aliases) {
          return e.aliases.some((a) => body.includes(a));
        }
        return false;
      })
      .slice(0, 10); // Top 10 most recently mentioned
  }, [priorKnowledge, body]);

  // Find unresolved plot entries (foreshadowing hints)
  const unresolvedPlots = useMemo(() => {
    if (!priorKnowledge?.plot) return [];
    return priorKnowledge.plot.filter(
      (p) =>
        p.attributes &&
        (p.attributes.status === 'unresolved' || p.attributes.status === '未回收'),
    );
  }, [priorKnowledge]);

  if (!sidebarOpen) {
    return null;
  }

  return (
    <div className="w-64 border-l border-gray-200 bg-white overflow-y-auto flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
        <span className="text-sm font-medium text-gray-700">写作辅助</span>
        <button
          type="button"
          onClick={toggleSidebar}
          className="text-xs px-1.5 py-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded cursor-pointer"
          title="收起面板"
        >
          ✕
        </button>
      </div>

      {/* Empty state */}
      {(!priorKnowledge || body.length === 0) && (
        <div className="flex flex-col items-center justify-center py-8 px-4">
          <span className="text-2xl mb-2">💡</span>
          <p className="text-xs text-gray-500 text-center">
            输入正文后，这里将实时显示上下文提示
          </p>
        </div>
      )}

      {/* Mentioned Entities */}
      {mentionedEntities.length > 0 && (
        <div className="border-b border-gray-100">
          <button
            type="button"
            onClick={() => setExpandedHints(!expandedHints)}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <span>{expandedHints ? '▾' : '▸'}</span>
              <span className="text-xs font-medium text-gray-600">
                📍 当前提到的 ({mentionedEntities.length})
              </span>
            </span>
          </button>
          {expandedHints && (
            <div className="pb-2">
              {mentionedEntities.map((entry) => {
                const catColors: Record<string, string> = {
                  characters: 'text-blue-700 bg-blue-50',
                  techniques: 'text-purple-700 bg-purple-50',
                  locations: 'text-green-700 bg-green-50',
                  worldbuilding: 'text-amber-700 bg-amber-50',
                  weapons: 'text-red-700 bg-red-50',
                  alchemy: 'text-emerald-700 bg-emerald-50',
                  plot: 'text-pink-700 bg-pink-50',
                };
                const colorClass = catColors[entry.category] || 'text-gray-700 bg-gray-50';

                return (
                  <div key={entry.id} className="px-3 py-1.5 mx-1 rounded hover:bg-gray-50">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-xs px-1 py-0 rounded ${colorClass}`}
                      >
                        {entry.category === 'characters'
                          ? '人物'
                          : entry.category === 'locations'
                            ? '地点'
                            : entry.category === 'techniques'
                              ? '功法'
                              : entry.category === 'worldbuilding'
                                ? '世界观'
                                : entry.category === 'weapons'
                                  ? '武器'
                                  : entry.category === 'alchemy'
                                    ? '丹药'
                                    : '情节'}
                      </span>
                      <span className="text-sm font-medium text-gray-800">
                        {entry.name}
                      </span>
                    </div>
                    {entry.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {entry.description.slice(0, 100)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Unresolved Plot Hints */}
      {unresolvedPlots.length > 0 && (
        <div className="border-b border-gray-100">
          <div className="px-3 py-2 text-xs font-medium text-amber-700 bg-amber-50">
            ⚠ 伏笔未回收 ({unresolvedPlots.length})
          </div>
          <div className="pb-2">
            {unresolvedPlots.map((plot) => (
              <div key={plot.id} className="px-3 py-1.5 mx-1">
                <p className="text-sm text-gray-800">{plot.name}</p>
                {plot.description && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {plot.description.slice(0, 100)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick tips */}
      {priorKnowledge?.worldbuilding && priorKnowledge.worldbuilding.length > 0 && (
        <div className="border-b border-gray-100">
          <div className="px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50">
            📋 世界观规则
          </div>
          <div className="pb-2">
            {priorKnowledge.worldbuilding.slice(0, 5).map((rule) => (
              <div key={rule.id} className="px-3 py-1 mx-1 rounded hover:bg-gray-50">
                <p className="text-sm text-gray-800">{rule.name}</p>
                {rule.description && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {rule.description.slice(0, 100)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
