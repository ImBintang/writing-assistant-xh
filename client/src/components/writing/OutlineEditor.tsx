// client/src/components/writing/OutlineEditor.tsx
// Collapsible outline editor panel

import TipTapEditor from '../editor/TipTapEditor';
import { useWriting } from '../../hooks/useWriting';

export default function OutlineEditor() {
  const mode = useWriting((s) => s.mode);
  const outline = useWriting((s) => s.outline);
  const setOutline = useWriting((s) => s.setOutline);
  const retrieveKnowledge = useWriting((s) => s.retrieveKnowledge);

  if (mode === 'body') return null;

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-4 py-2 bg-amber-50 border-b-2 border-amber-300 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-amber-900 font-bold">📋</span>
          <span className="text-sm font-bold text-amber-900">大纲 / 要点</span>
          <span className="text-xs font-semibold text-amber-700">作者在此写大纲要点</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => retrieveKnowledge(outline)}
            className="px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-200 hover:bg-amber-300 rounded-lg shadow-[0_2px_8px_rgba(217,119,6,0.3)] transition-all duration-200 cursor-pointer"
          >检索知识</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <TipTapEditor content={outline} onUpdate={(_html, text) => setOutline(text)} placeholder="输入章节大纲或要点..." editorId="outline" showFormattingToolbar={true} minHeight="min-h-[480px]" />
      </div>
    </div>
  );
}
