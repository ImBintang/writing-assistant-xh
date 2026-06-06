// client/src/components/editor/DiffView.tsx
// Diff view for AI suggestions — Corporate Trust styled

import type { DiffItem } from '../../services/writing';
import { Button } from '../ui/Button';

interface DiffViewProps {
  original: string; modified: string; changes: DiffItem[];
  onAccept: () => void; onReject: () => void;
  mode?: 'polish' | 'generate' | 'continue' | 'expand' | 'shorten' | 'rewrite';
}

const MODE_LABELS: Record<string, string> = { polish: 'AI 润色', generate: 'AI 撰写', continue: 'AI 续写', expand: 'AI 扩写', shorten: 'AI 缩写', rewrite: 'AI 改写' };

export default function DiffView({ modified, changes, onAccept, onReject, mode = 'polish' }: DiffViewProps) {
  const hasDetailedChanges = changes && changes.length > 0;

  return (
    <div className="border-2 border-indigo-200 rounded-card overflow-hidden bg-white shadow-card">
      <div className="flex items-center justify-between px-4 py-2 bg-indigo-50 border-b border-indigo-200">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-sm font-medium text-indigo-800">{MODE_LABELS[mode] || 'AI 建议'}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onReject}>拒绝</Button>
          <Button size="sm" onClick={onAccept}>接受</Button>
        </div>
      </div>
      <div className="p-4 max-h-[500px] overflow-y-auto">
        {hasDetailedChanges ? (
          <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans">
            {changes.map((part, i) => {
              let className = '';
              if (part.type === 'add') className = 'bg-emerald-100 text-emerald-800';
              else if (part.type === 'remove') className = 'bg-red-100 text-red-800 line-through';
              return <span key={i} className={className}>{part.value}</span>;
            })}
          </div>
        ) : (
          <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans text-slate-800">{modified}</div>
        )}
      </div>
      <div className="px-4 py-1.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-400">
        接受后将替换{mode === 'generate' ? '正文区域' : mode === 'continue' ? '续写后的内容' : '选中文本'}
      </div>
    </div>
  );
}
