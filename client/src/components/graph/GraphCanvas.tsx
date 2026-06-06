// client/src/components/graph/GraphCanvas.tsx
// Cytoscape.js wrapper — Corporate Trust styled

import { useEffect, useRef, useCallback } from 'react';
import cytoscape from 'cytoscape';
import { useKnowledgeManagement } from '../../hooks/useKnowledgeManagement';
import NodeDetail from './NodeDetail';
import type { GraphNode, GraphEdge } from '../../services/knowledge';

const CATEGORY_COLORS: Record<string, string> = {
  characters: '#ef4444', techniques: '#3b82f6', locations: '#10b981',
  worldbuilding: '#8b5cf6', weapons: '#f59e0b', alchemy: '#ec4899', plot: '#6366f1',
};

const RELATION_LINE_STYLES: Record<string, 'solid' | 'dashed' | 'dotted'> = {
  belongs_to: 'solid', owns: 'solid', appears_in: 'dashed', causes: 'dashed',
  located_in: 'solid', related_to: 'dotted', conflicts_with: 'dashed', ally_of: 'solid',
};

const DEFAULT_LAYOUT = { name: 'cose', animate: true, animationDuration: 1000, nodeRepulsion: () => 8000, idealEdgeLength: () => 120, nodeOverlap: 40, gravity: 0.25, numIter: 2000 };
const LAYOUTS: Record<string, cytoscape.LayoutOptions> = {
  force: DEFAULT_LAYOUT, circle: { name: 'circle', animate: true, animationDuration: 500 },
  grid: { name: 'grid', rows: undefined, animate: true, animationDuration: 500 },
  breadthfirst: { name: 'breadthfirst', directed: false, animate: true, animationDuration: 500 },
};

interface Props { nodes: GraphNode[]; edges: GraphEdge[]; loading: boolean; layout?: string; onNodeClick?: (node: GraphNode) => void; }

export default function GraphCanvas({ nodes, edges, loading, layout = 'force', onNodeClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const layoutRef = useRef<string>(layout);
  const { selectedNode, nodeDetailOpen, selectNode, closeNodeDetail, loadNodeGraph } = useKnowledgeManagement();

  useEffect(() => {
    if (!containerRef.current || nodes.length === 0) return;
    if (cyRef.current) cyRef.current.destroy();
    const elements: cytoscape.ElementDefinition[] = [
      ...nodes.map((n) => ({ data: { id: n.id, label: n.name, category: n.category, group: n.group, version: n.version, ...n.attributes }, classes: `category-${n.category}` })),
      ...edges.map((e) => ({ data: { id: e.id, source: e.source, target: e.target, label: e.label, relationType: e.relationType, description: e.description }, classes: `relation-${e.relationType}` })),
    ];
    const cy = cytoscape({
      container: containerRef.current, elements,
      style: [
        { selector: 'node', style: { 'background-color': '#94a3b8', label: 'data(label)', 'text-valign': 'bottom', 'text-halign': 'center', 'font-size': '11px', color: '#374151', 'text-margin-y': 6, 'text-max-width': '120px', 'text-wrap': 'ellipsis', width: 'mapData(version, 1, 10, 24, 48)', height: 'mapData(version, 1, 10, 24, 48)', 'border-width': 2, 'border-color': '#fff' } },
        ...Object.entries(CATEGORY_COLORS).map(([cat, color]) => ({ selector: `node.category-${cat}`, style: { 'background-color': color } })),
        { selector: 'edge', style: { width: 1.5, 'line-color': '#94a3b8', 'target-arrow-color': '#94a3b8', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier', label: 'data(label)', 'font-size': '9px', color: '#9ca3af', 'text-rotation': 'autorotate' } },
        ...Object.entries(RELATION_LINE_STYLES).map(([relType, lineStyle]) => ({ selector: `edge.relation-${relType}`, style: { 'line-style': lineStyle } })),
        { selector: 'node:selected', style: { 'border-width': 3, 'border-color': '#4f46e5', 'z-index': 10 } },
      ],
      layout: LAYOUTS[layout] || DEFAULT_LAYOUT, minZoom: 0.1, maxZoom: 5, wheelSensitivity: 0.3,
    });
    cy.on('tap', 'node', (evt) => { const nodeData = evt.target.data() as Record<string, unknown>; const graphNode: GraphNode = { id: nodeData.id as string, name: nodeData.label as string, category: nodeData.category as string, group: nodeData.group as string, version: nodeData.version as number, attributes: nodeData }; selectNode(graphNode); onNodeClick?.(graphNode); });
    cy.on('dbltap', 'node', (evt) => { const nodeData = evt.target.data() as Record<string, unknown>; loadNodeGraph(nodeData.id as string, 2); });
    cy.on('tap', (evt) => { if (evt.target === cy) closeNodeDetail(); });
    cyRef.current = cy; layoutRef.current = layout;
    return () => { cy.destroy(); cyRef.current = null; };
  }, [nodes, edges, layout]);

  const applyLayout = useCallback((newLayout: string) => { if (!cyRef.current) return; const options = LAYOUTS[newLayout] || DEFAULT_LAYOUT; cyRef.current.layout(options).run(); layoutRef.current = newLayout; }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-slate-50 rounded-card">
        <div className="text-center"><div className="animate-spin inline-block rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2" /><p className="text-sm text-slate-500">加载图谱数据...</p></div>
      </div>
    );
  }
  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-slate-50 rounded-card">
        <div className="text-center text-slate-400">
          <svg className="mx-auto h-12 w-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>
          <p>暂无图谱数据</p><p className="text-xs mt-1">请先提取知识条目并添加关联关系</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute top-2 right-2 z-10 flex gap-1 bg-white rounded-card shadow-card p-1">
        {Object.keys(LAYOUTS).map((name) => {
          const labels: Record<string, string> = { force: '力导向', circle: '圆形', grid: '网格', breadthfirst: '层级' };
          const isActive = layoutRef.current === name;
          return (
            <button key={name} onClick={() => applyLayout(name)} className={`px-3 py-1 text-xs rounded transition-colors ${isActive ? 'bg-indigo-600 text-white shadow-btn' : 'text-slate-600 hover:bg-slate-100'}`}>{labels[name] || name}</button>
          );
        })}
      </div>
      <div ref={containerRef} className="w-full bg-slate-50 rounded-card border border-slate-200" style={{ height: '600px' }} />
      <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-1 bg-white rounded-card shadow-card p-1">
        <button onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.2)} className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded text-lg">+</button>
        <button onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 0.8)} className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded text-lg">−</button>
        <button onClick={() => cyRef.current?.fit(undefined, 50)} className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded text-xs">⊡</button>
      </div>
      <div className="absolute bottom-4 right-4 z-10 bg-white rounded-card shadow-card p-3 text-xs">
        <p className="font-medium text-slate-600 mb-1">图例</p>
        {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
          <div key={cat} className="flex items-center gap-2 py-0.5"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} /><span className="text-slate-500">{{ characters: '人物', techniques: '功法', locations: '地图', worldbuilding: '世界观', weapons: '武器', alchemy: '丹药', plot: '情节' }[cat]}</span></div>
        ))}
        <button
          onClick={() => {
            if (!cyRef.current) return;
            const pngDataUrl = cyRef.current.png({ full: true, bg: '#ffffff', output: 'blob' });
            if (pngDataUrl instanceof Blob) {
              const url = URL.createObjectURL(pngDataUrl);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'knowledge-graph.png';
              a.click();
              URL.revokeObjectURL(url);
            }
          }}
          className="mt-2 w-full text-center text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded py-1 transition-colors"
        >
          📸 导出 PNG 图片
        </button>
      </div>
      {nodeDetailOpen && selectedNode && <NodeDetail node={selectedNode} onClose={closeNodeDetail} />}
    </div>
  );
}
