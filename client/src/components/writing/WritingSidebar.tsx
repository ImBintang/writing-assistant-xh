// client/src/components/writing/WritingSidebar.tsx
// Writing assistant content — used inside Drawer

import { useMemo, useState } from 'react';
import { useWriting } from '../../hooks/useWriting';

export default function WritingSidebar() {
  const priorKnowledge = useWriting((s) => s.priorKnowledge);
  const body = useWriting((s) => s.body);
  const [expandedHints, setExpandedHints] = useState(true);

  const mentionedEntities = useMemo(() => {
    if (!priorKnowledge || !body) return [];
    const allCategories = [...(priorKnowledge.characters || []), ...(priorKnowledge.locations || []), ...(priorKnowledge.techniques || []), ...(priorKnowledge.worldbuilding || []), ...(priorKnowledge.weapons || []), ...(priorKnowledge.alchemy || []), ...(priorKnowledge.plot || [])];
    return allCategories.filter((e) => { if (body.includes(e.name)) return true; if (e.aliases) return e.aliases.some((a) => body.includes(a)); return false; }).slice(0, 10);
  }, [priorKnowledge, body]);

  const unresolvedPlots = useMemo(() => {
    if (!priorKnowledge?.plot) return [];
    return priorKnowledge.plot.filter((p) => p.attributes && (p.attributes.status === 'unresolved' || p.attributes.status === '未回收'));
  }, [priorKnowledge]);

  return (
    <div className="flex flex-col h-full">
      {/* 标题栏 */}
      <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">写作辅助</span>
      </div>

      {(!priorKnowledge || body.length === 0) && (
        <div className="flex flex-col items-center justify-center py-10 px-4">
          <span className="text-2xl mb-2">💡</span>
          <p className="text-xs text-slate-500 text-center">输入正文后，这里将实时显示上下文提示</p>
        </div>
      )}

      {mentionedEntities.length > 0 && (
        <div className="border-b border-slate-100">
          <button type="button" onClick={() => setExpandedHints(!expandedHints)} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors">
            <span className="flex items-center gap-2"><span className="text-xs">{expandedHints ? '▾' : '▸'}</span><span className="text-xs font-medium text-slate-600">📍 当前提到的 ({mentionedEntities.length})</span></span>
          </button>
          {expandedHints && (
            <div className="pb-2">
              {mentionedEntities.map((entry) => {
                const catColors: Record<string, string> = { characters: 'text-blue-700 bg-blue-50', techniques: 'text-violet-700 bg-violet-50', locations: 'text-emerald-700 bg-emerald-50', worldbuilding: 'text-amber-700 bg-amber-50', weapons: 'text-red-700 bg-red-50', alchemy: 'text-emerald-700 bg-emerald-50', plot: 'text-pink-700 bg-pink-50' };
                const colorClass = catColors[entry.category] || 'text-slate-700 bg-slate-50';
                return (
                  <div key={entry.id} className="px-3 py-2 mx-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${colorClass}`}>{entry.category}</span>
                      <span className="text-sm font-medium text-slate-800">{entry.name}</span>
                    </div>
                    {entry.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{entry.description.slice(0, 100)}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {unresolvedPlots.length > 0 && (
        <div className="border-b border-slate-100">
          <div className="px-4 py-2.5 text-xs font-semibold text-amber-700 bg-amber-50/70">⚠ 伏笔未回收 ({unresolvedPlots.length})</div>
          <div className="pb-2">{unresolvedPlots.map((plot) => (<div key={plot.id} className="px-4 py-2 mx-2"><p className="text-sm text-slate-800">{plot.name}</p>{plot.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{plot.description.slice(0, 100)}</p>}</div>))}</div>
        </div>
      )}

      {priorKnowledge?.worldbuilding && priorKnowledge.worldbuilding.length > 0 && (
        <div className="border-b border-slate-100">
          <div className="px-4 py-2.5 text-xs font-semibold text-blue-700 bg-blue-50/70">📋 世界观规则</div>
          <div className="pb-2">{priorKnowledge.worldbuilding.slice(0, 5).map((rule) => (<div key={rule.id} className="px-4 py-2 mx-2 rounded-lg hover:bg-slate-50 transition-colors"><p className="text-sm text-slate-800">{rule.name}</p>{rule.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{rule.description.slice(0, 100)}</p>}</div>))}</div>
        </div>
      )}
    </div>
  );
}
