// client/src/components/graph/GraphFilter.tsx
// Graph filter panel — category and relation type filtering (PRD-04 Section 2.4.2)

import { useState } from 'react';
import { useKnowledgeManagement } from '../../hooks/useKnowledgeManagement';

const CATEGORY_NAMES: Record<string, string> = {
  characters: '人物',
  techniques: '功法',
  locations: '地图',
  worldbuilding: '世界观',
  weapons: '武器',
  alchemy: '丹药',
  plot: '情节',
};

const ALL_CATEGORIES = Object.keys(CATEGORY_NAMES);

interface Props {
  collapsed?: boolean;
  onToggle?: () => void;
}

export default function GraphFilter({ collapsed, onToggle }: Props) {
  const { graphFilters, setGraphFilters, relationTypes, loadGraph } = useKnowledgeManagement();
  const [searchNode, setSearchNode] = useState('');

  const toggleCategory = (cat: string) => {
    const current = graphFilters.categories || [];
    const next = current.includes(cat)
      ? current.filter((c) => c !== cat)
      : [...current, cat];
    setGraphFilters({ categories: next });
  };

  const toggleRelationType = (typeId: string) => {
    const current = graphFilters.relationTypes || [];
    const next = current.includes(typeId)
      ? current.filter((t) => t !== typeId)
      : [...current, typeId];
    setGraphFilters({ relationTypes: next });
  };

  const handleReset = () => {
    setGraphFilters({ categories: [], relationTypes: [] });
  };

  const handleSearch = () => {
    if (searchNode.trim()) {
      loadGraph({ categories: graphFilters.categories, relationTypes: graphFilters.relationTypes });
    }
  };

  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
        title="展开筛选"
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="space-y-5">
      {/* Node search */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">搜索节点</label>
        <div className="flex gap-1">
          <input
            type="text"
            value={searchNode}
            onChange={(e) => setSearchNode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="节点名称..."
            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            onClick={handleSearch}
            className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            搜索
          </button>
        </div>
      </div>

      {/* Category filter */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">按分类筛选</label>
        <div className="space-y-1">
          {ALL_CATEGORIES.map((cat) => {
            const isSelected = (graphFilters.categories || []).length === 0 || graphFilters.categories.includes(cat);
            return (
              <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleCategory(cat)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-gray-700">{CATEGORY_NAMES[cat] || cat}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Relation type filter */}
      {relationTypes.length > 0 && (
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">按关系类型筛选</label>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {relationTypes.map((rt) => {
              const isSelected = (graphFilters.relationTypes || []).length === 0 || graphFilters.relationTypes.includes(rt.id);
              return (
                <label key={rt.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleRelationType(rt.id)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-gray-700">{rt.name}</span>
                  <span className="text-xs text-gray-400 ml-auto">{rt.id}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Reset button */}
      <button
        onClick={handleReset}
        className="w-full px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
      >
        重置筛选
      </button>
    </div>
  );
}
