// client/src/components/writing/OutlineEditor.tsx
// Collapsible outline editor panel

import TipTapEditor from '../editor/TipTapEditor';
import { useWriting } from '../../hooks/useWriting';
import { Button } from '../ui/Button';

export default function OutlineEditor() {
  const mode = useWriting((s) => s.mode);
  const outline = useWriting((s) => s.outline);
  const setOutline = useWriting((s) => s.setOutline);
  const generateChapter = useWriting((s) => s.generateChapter);
  const retrieveKnowledge = useWriting((s) => s.retrieveKnowledge);
  const aiLoading = useWriting((s) => s.aiLoading);

  if (mode === 'body') return null;

  const handleGenerateFromOutline = async () => {
    if (!outline.trim()) return;
    await retrieveKnowledge(outline);
    await generateChapter(outline);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-4 py-2 bg-amber-50 border-b-2 border-amber-300 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-amber-900 font-bold">📋</span>
          <span className="text-sm font-bold text-amber-900">大纲 / 要点</span>
          <span className="text-xs font-semibold text-amber-700">作者在此写大纲要点</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => retrieveKnowledge(outline)} className="border-amber-300 text-amber-700 hover:bg-amber-100">检索知识</Button>
          <Button size="sm" onClick={handleGenerateFromOutline} disabled={aiLoading || !outline.trim()} isLoading={aiLoading} className="bg-amber-600 hover:bg-amber-700 from-amber-600 to-amber-600">基于大纲撰写正文</Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <TipTapEditor content={outline} onUpdate={(_html, text) => setOutline(text)} placeholder="输入章节大纲或要点..." editorId="outline" showFormattingToolbar={true} minHeight="min-h-[480px]" />
      </div>
    </div>
  );
}
