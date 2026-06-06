// client/src/components/writing/OutlineEditor.tsx
// Collapsible outline editor panel for PRD-05

import TipTapEditor from '../editor/TipTapEditor';
import { useWriting } from '../../hooks/useWriting';

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
    // First refresh knowledge
    await retrieveKnowledge(outline);
    // Then generate
    await generateChapter(outline);
  };

  return (
    <div className="border-b border-gray-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-amber-50 border-b border-amber-200">
        <div className="flex items-center gap-2">
          <span className="text-amber-700">📋</span>
          <span className="text-sm font-medium text-amber-800">大纲 / 要点</span>
          <span className="text-xs text-amber-500">输入大纲，AI 自动扩写为正文</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => retrieveKnowledge(outline)}
            className="px-2.5 py-1 text-xs text-amber-700 bg-white border border-amber-300 rounded hover:bg-amber-100 transition-colors cursor-pointer"
          >
            检索知识
          </button>
          <button
            type="button"
            onClick={handleGenerateFromOutline}
            disabled={aiLoading || !outline.trim()}
            className={`px-3 py-1 text-xs text-white rounded transition-colors cursor-pointer ${
              aiLoading || !outline.trim()
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {aiLoading ? (
              <span className="flex items-center gap-1">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                撰写中...
              </span>
            ) : (
              '基于大纲撰写正文'
            )}
          </button>
        </div>
      </div>

      {/* TipTap Outline Editor */}
      <div className="p-2">
        <TipTapEditor
          content={outline}
          onUpdate={(_html, text) => setOutline(text)}
          placeholder="输入章节大纲或要点，每行一条。支持标题层级。&#10;例如：&#10;## 林动参加宗门大比&#10;- 到达青云宗，报名参赛&#10;- 初赛对阵..."
          editorId="outline"
          showFormattingToolbar={true}
        />
      </div>
    </div>
  );
}
