// client/src/components/writing/AiToolbar.tsx
// Bottom AI operation toolbar for PRD-05

import { useState } from 'react';
import { useWriting } from '../../hooks/useWriting';

const OPERATION_LABELS: Record<string, string> = {
  generating: '正在撰写...',
  continuing: '正在续写...',
  polishing: '正在润色...',
  expanding: '正在扩写...',
  shortening: '正在缩写...',
  rewriting: '正在改写...',
  foreshadowing: '正在检查伏笔...',
};

export default function AiToolbar() {
  const {
    generateChapter,
    continueWriting,
    polishText,
    expandText,
    checkForeshadowing,
    cancelAiOperation,
    saveDraft,
    openDraftManager,
    retrieveKnowledge,
    aiLoading,
    aiOperation,
    aiError,
    clearAiError,
    outline,
    body,
    mode,
  } = useWriting();

  const [showForeshadowResults, setShowForeshadowResults] = useState(false);
  const foreshadowingFindings = useWriting((s) => s.foreshadowingFindings);

  const handleFullPolish = async () => {
    // Ask to retrieve knowledge first then polish
    await retrieveKnowledge();
    if (body.trim()) {
      await polishText(body);
    }
  };

  const handleFullExpand = async () => {
    await retrieveKnowledge();
    if (body.trim()) {
      await expandText(body);
    }
  };

  const handleGenerate = async () => {
    await retrieveKnowledge(outline || body);
    await generateChapter(outline || body);
  };

  const handleContinue = async () => {
    await retrieveKnowledge(undefined, body);
    await continueWriting();
  };

  const handleForeshadowing = async () => {
    await retrieveKnowledge(undefined, body);
    await checkForeshadowing();
    setShowForeshadowResults(true);
  };

  return (
    <div className="border-t border-gray-200 bg-white">
      {/* Error banner */}
      {aiError && (
        <div className="flex items-center justify-between px-4 py-2 bg-red-50 border-b border-red-200">
          <span className="text-xs text-red-600">{aiError}</span>
          <button
            type="button"
            onClick={clearAiError}
            className="text-xs text-red-400 hover:text-red-600 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Foreshadowing results */}
      {showForeshadowResults && foreshadowingFindings.length > 0 && (
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-amber-800">
              📖 伏笔检查结果 ({foreshadowingFindings.length})
            </span>
            <button
              type="button"
              onClick={() => setShowForeshadowResults(false)}
              className="text-xs text-amber-600 hover:text-amber-800 cursor-pointer"
            >
              收起
            </button>
          </div>
          {foreshadowingFindings.map((f, i) => (
            <div key={i} className="flex items-start gap-2 mb-1.5">
              <span
                className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  f.severity === 'error'
                    ? 'bg-red-500'
                    : f.severity === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-blue-500'
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-xs px-1 py-0 rounded ${
                      f.type === 'unresolved'
                        ? 'bg-red-100 text-red-700'
                        : f.type === 'contradiction'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {f.type === 'unresolved'
                      ? '未回收'
                      : f.type === 'contradiction'
                        ? '矛盾'
                        : '新伏笔'}
                  </span>
                  <span className="text-xs text-gray-600">{f.description}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  关联：{f.relatedPlot}
                  {f.chapterReference > 0 && `（第${f.chapterReference}章）`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar buttons */}
      <div className="flex items-center gap-1 px-4 py-2 flex-wrap">
        {/* Mode-dependent buttons */}
        {mode === 'outline' && (
          <ToolbarButton
            onClick={handleGenerate}
            loading={aiOperation === 'generating'}
            disabled={aiLoading || (!outline.trim() && !body.trim())}
            icon="📝"
            label="AI 撰写本章"
          />
        )}

        {body && body.trim().length > 0 && (
          <>
            <ToolbarButton
              onClick={handleContinue}
              loading={aiOperation === 'continuing'}
              disabled={aiLoading}
              icon="▶"
              label="AI 续写"
            />
            <ToolbarButton
              onClick={handleFullPolish}
              loading={aiOperation === 'polishing'}
              disabled={aiLoading}
              icon="✨"
              label="AI 润色全文"
            />
            <ToolbarButton
              onClick={handleFullExpand}
              loading={aiOperation === 'expanding'}
              disabled={aiLoading}
              icon="📄"
              label="AI 扩写"
            />
            <ToolbarButton
              onClick={handleForeshadowing}
              loading={aiOperation === 'foreshadowing'}
              disabled={aiLoading}
              icon="🔍"
              label="检查伏笔"
            />
          </>
        )}

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <ToolbarButton
          onClick={saveDraft}
          disabled={aiLoading}
          icon="💾"
          label="保存草稿"
        />
        <ToolbarButton
          onClick={openDraftManager}
          disabled={aiLoading}
          icon="📂"
          label="草稿管理"
        />

        {/* Cancel button */}
        {aiLoading && aiOperation && (
          <button
            type="button"
            onClick={cancelAiOperation}
            className="ml-2 px-3 py-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
          >
            取消 {OPERATION_LABELS[aiOperation] || ''}
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Word count display */}
        <span className="text-xs text-gray-400 ml-2">
          正文 {body.length.toLocaleString()} 字
        </span>
      </div>
    </div>
  );
}

function ToolbarButton({
  onClick,
  loading = false,
  disabled = false,
  icon,
  label,
}: {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg transition-colors cursor-pointer ${
        disabled
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : loading
            ? 'bg-indigo-100 text-indigo-600'
            : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-800 border border-gray-200'
      }`}
    >
      {loading ? (
        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-600" />
      ) : (
        <span>{icon}</span>
      )}
      <span>{label}</span>
    </button>
  );
}
