// client/src/components/editor/DiffView.tsx
// Diff view for showing AI suggestions (accept/reject) — PRD-05

import type { DiffItem } from '../../services/writing';

interface DiffViewProps {
  original: string;
  modified: string;
  changes: DiffItem[];
  onAccept: () => void;
  onReject: () => void;
  mode?: 'polish' | 'generate' | 'continue' | 'expand' | 'shorten' | 'rewrite';
}

const MODE_LABELS: Record<string, string> = {
  polish: 'AI 润色',
  generate: 'AI 撰写',
  continue: 'AI 续写',
  expand: 'AI 扩写',
  shorten: 'AI 缩写',
  rewrite: 'AI 改写',
};

export default function DiffView({
  modified,
  changes,
  onAccept,
  onReject,
  mode = 'polish',
}: DiffViewProps) {
  const hasDetailedChanges = changes && changes.length > 0;

  return (
    <div className="border-2 border-indigo-300 rounded-lg overflow-hidden bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-indigo-50 border-b border-indigo-200">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-sm font-medium text-indigo-800">
            {MODE_LABELS[mode] || 'AI 建议'}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onReject}
            className="px-3 py-1 text-xs text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors cursor-pointer"
          >
            拒绝
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="px-3 py-1 text-xs text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            接受
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-h-[500px] overflow-y-auto">
        {hasDetailedChanges ? (
          // Word-level diff rendering (for polish)
          <div className="text-sm leading-relaxed whitespace-pre-wrap font-serif">
            {changes.map((part, i) => {
              let className = '';
              if (part.type === 'add') {
                className = 'bg-green-100 text-green-800';
              } else if (part.type === 'remove') {
                className = 'bg-red-100 text-red-800 line-through';
              }
              return (
                <span key={i} className={className}>
                  {part.value}
                </span>
              );
            })}
          </div>
        ) : (
          // Simple before/after for generate, continue, expand, etc.
          <div className="text-sm leading-relaxed whitespace-pre-wrap font-serif text-gray-800">
            {modified}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-1.5 bg-gray-50 border-t border-gray-200 text-xs text-gray-400">
        接受后将替换{mode === 'generate' ? '正文区域' : mode === 'continue' ? '续写后的内容' : '选中文本'}
      </div>
    </div>
  );
}
