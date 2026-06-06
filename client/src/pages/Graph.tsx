// client/src/pages/Graph.tsx
// Knowledge graph visualization page (PRD-04 Section 2.4)

import { useEffect, useState } from 'react';
import { useKnowledgeManagement } from '../hooks/useKnowledgeManagement';
import GraphCanvas from '../components/graph/GraphCanvas';
import GraphFilter from '../components/graph/GraphFilter';

export default function GraphPage() {
  const { graphData, graphLoading, loadGraph, loadRelationTypes, doExport } =
    useKnowledgeManagement();
  const [filterCollapsed, setFilterCollapsed] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadGraph();
    loadRelationTypes();
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      await doExport();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex gap-4 h-full">
      {/* Filter sidebar */}
      <div className="flex-shrink-0">
        {filterCollapsed ? (
          <div className="pt-2">
            <GraphFilter
              collapsed={true}
              onToggle={() => setFilterCollapsed(false)}
            />
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-4 w-64">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">图谱筛选</h3>
              <button
                onClick={() => setFilterCollapsed(true)}
                className="text-xs text-gray-400 hover:text-gray-600"
                title="收起筛选面板"
              >
                &times;
              </button>
            </div>
            <GraphFilter />
          </div>
        )}
      </div>

      {/* Graph area */}
      <div className="flex-1 min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-800">知识图谱</h2>
            {graphData && (
              <p className="text-sm text-gray-500">
                {graphData.nodes.length} 个节点 · {graphData.edges.length} 条边
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-3 py-1.5 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {exporting ? '导出中...' : '导出 JSON'}
            </button>
            <button
              onClick={() => loadGraph()}
              className="px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              刷新
            </button>
          </div>
        </div>

        {/* Graph Canvas */}
        <GraphCanvas
          nodes={graphData?.nodes || []}
          edges={graphData?.edges || []}
          loading={graphLoading}
          layout="force"
        />
      </div>
    </div>
  );
}
