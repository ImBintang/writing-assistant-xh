// client/src/components/writing/WritingLayout.tsx
// Main writing window layout for PRD-05
// Orchestrates all writing sub-components and manages auto-save.

import { useEffect, useRef, useCallback } from 'react';
import TipTapEditor from '../editor/TipTapEditor';
import DiffView from '../editor/DiffView';
import OutlineEditor from './OutlineEditor';
import PriorKnowledgePanel from './PriorKnowledgePanel';
import AiToolbar from './AiToolbar';
import WritingSidebar from './WritingSidebar';
import DraftManager from './DraftManager';
import { useWriting } from '../../hooks/useWriting';

export default function WritingLayout() {
  const {
    mode,
    setMode,
    body,
    setBody,
    title,
    setTitle,
    targetChapter,
    setTargetChapter,
    isDirty,
    saveDraft,
    showDiff,
    diffOriginal,
    diffModified,
    diffChanges,
    diffMode,
    acceptSuggestion,
    rejectSuggestion,
    knowledgePanelOpen,
    sidebarOpen,
    toggleKnowledgePanel,
    toggleSidebar,
    retrieveKnowledge,
    outline,
  } = useWriting();

  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // Auto-save every 30 seconds
  useEffect(() => {
    autoSaveTimerRef.current = setInterval(() => {
      if (isDirtyRef.current) {
        saveDraft();
      }
    }, 30000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
      // Save on unmount if dirty
      if (isDirtyRef.current) {
        saveDraft();
      }
    };
  }, [saveDraft]);

  // Blur-based save
  const handleBlur = useCallback(() => {
    if (isDirtyRef.current) {
      // Small delay to allow state to settle
      setTimeout(() => {
        if (isDirtyRef.current) {
          saveDraft();
        }
      }, 200);
    }
  }, [saveDraft]);

  const handleBodyUpdate = useCallback(
    (_html: string, text: string) => {
      setBody(text);
    },
    [setBody],
  );

  const handleAccept = () => {
    if (diffMode === 'generate' || diffMode === 'continue') {
      acceptSuggestion(diffModified);
    } else {
      acceptSuggestion(diffModified);
    }
  };

  return (
    <div
      className="flex flex-col h-[calc(100vh-120px)]"
      onBlur={handleBlur}
      tabIndex={-1}
    >
      {/* Header: title + mode toggle + chapter number */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 bg-white">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="章节标题（可选）"
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />

        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500">第</label>
          <input
            type="number"
            value={targetChapter || ''}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              setTargetChapter(isNaN(v) ? null : v);
            }}
            placeholder="?"
            min={1}
            className="w-16 px-2 py-1.5 text-sm text-center border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <label className="text-xs text-gray-500">章</label>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => {
              setMode('outline');
              // Retrieve knowledge when switching to outline mode
              if (outline) retrieveKnowledge(outline);
            }}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors cursor-pointer ${
              mode === 'outline'
                ? 'bg-white text-indigo-700 font-medium shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            大纲模式
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('body');
              // Retrieve knowledge when switching to body mode
              if (body) retrieveKnowledge(undefined, body);
            }}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors cursor-pointer ${
              mode === 'body'
                ? 'bg-white text-indigo-700 font-medium shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            正文模式
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Center column: editors */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Outline editor (only visible in outline mode) */}
          <OutlineEditor />

          {/* Diff view for AI suggestions */}
          {showDiff && (
            <div className="mx-4 mt-3">
              <DiffView
                original={diffOriginal}
                modified={diffModified}
                changes={diffChanges}
                onAccept={handleAccept}
                onReject={rejectSuggestion}
                mode={diffMode}
              />
            </div>
          )}

          {/* Body editor (TipTap) */}
          <div className={`flex-1 overflow-y-auto ${mode === 'outline' ? 'p-4' : 'p-4'}`}>
            <div className={mode === 'body' ? 'max-w-3xl mx-auto' : ''}>
              <TipTapEditor
                content={body}
                onUpdate={handleBodyUpdate}
                placeholder={
                  mode === 'outline'
                    ? '输入正文内容...（也可以在上方大纲区输入大纲后点击"基于大纲撰写正文"）'
                    : '开始写作...'
                }
                editorId="body"
                showFormattingToolbar={true}
              />
            </div>
          </div>

          {/* Bottom AI toolbar */}
          <AiToolbar />
        </div>

        {/* Right panels */}
        <div className="flex">
          {/* Prior Knowledge Panel */}
          {knowledgePanelOpen && <PriorKnowledgePanel />}

          {/* Writing Sidebar */}
          {sidebarOpen && <WritingSidebar />}

          {/* Floating reopen buttons — always visible when panels are closed */}
          {!knowledgePanelOpen && (
            <button
              type="button"
              onClick={toggleKnowledgePanel}
              className="fixed right-0 top-1/2 -translate-y-1/2 bg-white border border-gray-300 rounded-l-lg px-2 py-4 text-xs text-gray-500 hover:bg-gray-50 cursor-pointer z-20"
              title="展开先验知识面板"
            >
              知识
            </button>
          )}
          {!sidebarOpen && (
            <button
              type="button"
              onClick={toggleSidebar}
              className="fixed right-0 top-[60%] -translate-y-1/2 bg-white border border-gray-300 rounded-l-lg px-2 py-4 text-xs text-gray-500 hover:bg-gray-50 cursor-pointer z-20"
              title="展开写作辅助"
            >
              辅助
            </button>
          )}
        </div>
      </div>

      {/* Draft Manager Modal */}
      <DraftManager />
    </div>
  );
}
