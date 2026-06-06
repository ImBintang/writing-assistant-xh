// client/src/pages/Graph.tsx
// Knowledge graph visualization page

import { useEffect, useState } from 'react';
import { useKnowledgeManagement } from '../hooks/useKnowledgeManagement';
import GraphCanvas from '../components/graph/GraphCanvas';
import GraphFilter from '../components/graph/GraphFilter';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex gap-4 h-full">
      {/* Filter sidebar */}
      <div className="flex-shrink-0">
        {filterCollapsed ? (
          <div className="pt-2">
            <GraphFilter collapsed={true} onToggle={() => setFilterCollapsed(false)} />
          </div>
        ) : (
          <Card padding="md" className="w-64">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700">图谱筛选</h3>
              <button
                onClick={() => setFilterCollapsed(true)}
                className="text-xs text-slate-400 hover:text-slate-600"
                title="收起筛选面板"
              >
                &times;
              </button>
            </div>
            <GraphFilter />
          </Card>
        )}
      </div>

      {/* Graph area */}
      <div className="flex-1 min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-heading font-bold text-slate-900">知识图谱</h2>
            {graphData && (
              <p className="text-sm text-slate-500 mt-0.5">
                {graphData.nodes.length} 个节点 · {graphData.edges.length} 条边
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? '导出中...' : '导出 JSON'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadGraph()}
            >
              刷新
            </Button>
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
