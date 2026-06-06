// client/src/components/graph/GraphFilter.tsx
// Graph filter panel — Corporate Trust styled

import { useState } from 'react';
import { useKnowledgeManagement } from '../../hooks/useKnowledgeManagement';
import { Button } from '../ui/Button';

const CATEGORY_NAMES: Record<string, string> = {
  characters: '人物', techniques: '功法', locations: '地图',
  worldbuilding: '世界观', weapons: '武器', alchemy: '丹药', plot: '情节',
};
const ALL_CATEGORIES = Object.keys(CATEGORY_NAMES);

interface Props { collapsed?: boolean; onToggle?: () => void; }

export default function GraphFilter({ collapsed, onToggle }: Props) {
  const { graphFilters, setGraphFilters, relationTypes, loadGraph } = useKnowledgeManagement();
  const [searchNode, setSearchNode] = useState('');

  const toggleCategory = (cat: string) => {
    const current = graphFilters.categories || [];
    const next = current.includes(cat) ? current.filter((c) => c !== cat) : [...current, cat];
    setGraphFilters({ categories: next });
  };
  const toggleRelationType = (typeId: string) => {
    const current = graphFilters.relationTypes || [];
    const next = current.includes(typeId) ? current.filter((t) => t !== typeId) : [...current, typeId];
    setGraphFilters({ relationTypes: next });
  };
  const handleReset = () => { setGraphFilters({ categories: [], relationTypes: [] }); };
  const handleSearch = () => { if (searchNode.trim()) loadGraph({ categories: graphFilters.categories, relationTypes: graphFilters.relationTypes }); };

  if (collapsed) {
    return (
      <button onClick={onToggle} className="p-2 bg-white border border-slate-200 rounded-card hover:bg-slate-50" title="展开筛选">
        <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
      </button>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="text-xs font-medium text-slate-600 block mb-1">搜索节点</label>
        <div className="flex gap-1.5">
          <input type="text" value={searchNode} onChange={(e) => setSearchNode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder="节点名称..." className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-slate-200 rounded-input focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <Button size="sm" onClick={handleSearch} className="flex-shrink-0">搜索</Button>
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600 block mb-1">按分类筛选</label>
        <div className="space-y-1">
          {ALL_CATEGORIES.map((cat) => {
            const isSelected = (graphFilters.categories || []).length === 0 || graphFilters.categories.includes(cat);
            return (
              <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5">
                <input type="checkbox" checked={isSelected} onChange={() => toggleCategory(cat)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                <span className="text-slate-700">{CATEGORY_NAMES[cat] || cat}</span>
              </label>
            );
          })}
        </div>
      </div>
      {relationTypes.length > 0 && (
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">按关系类型筛选</label>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {relationTypes.map((rt) => {
              const isSelected = (graphFilters.relationTypes || []).length === 0 || graphFilters.relationTypes.includes(rt.id);
              return (
                <label key={rt.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5">
                  <input type="checkbox" checked={isSelected} onChange={() => toggleRelationType(rt.id)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-slate-700">{rt.name}</span><span className="text-xs text-slate-400 ml-auto">{rt.id}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
      <Button variant="secondary" size="sm" onClick={handleReset} className="w-full">重置筛选</Button>
    </div>
  );
}
