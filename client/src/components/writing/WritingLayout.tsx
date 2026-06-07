// client/src/components/writing/WritingLayout.tsx
// Main writing window layout — Corporate Trust styled

import { useEffect, useRef, useCallback, useState } from 'react';
import TipTapEditor from '../editor/TipTapEditor';
import DiffView from '../editor/DiffView';
import OutlineEditor from './OutlineEditor';
import PriorKnowledgePanel from './PriorKnowledgePanel';
import AiToolbar from './AiToolbar';
import WritingSidebar from './WritingSidebar';
import DraftManager from './DraftManager';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { useWriting } from '../../hooks/useWriting';


export default function WritingLayout() {
  const {
    mode, setMode, body, setBody, title, setTitle,
    targetChapter, setTargetChapter, isDirty, saveDraft,
    editSource, linkedChapterIndex, loadChapter,
    showDiff, diffOriginal, diffModified, diffChanges, diffMode,
    acceptSuggestion, rejectSuggestion,
    drawerTab, openDrawer,
    retrieveKnowledge, outline, generateChapter, aiLoading,
  } = useWriting();

  const [chapterLoadInput, setChapterLoadInput] = useState<string>('');

  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  useEffect(() => {
    autoSaveTimerRef.current = setInterval(() => {
      if (isDirtyRef.current) saveDraft();
    }, 30000);
    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
      if (isDirtyRef.current) saveDraft();
    };
  }, [saveDraft]);

  const handleBlur = useCallback(() => {
    if (isDirtyRef.current) {
      setTimeout(() => { if (isDirtyRef.current) saveDraft(); }, 200);
    }
  }, [saveDraft]);

  const handleBodyUpdate = useCallback((_html: string, text: string) => { setBody(text); }, [setBody]);

  const handleGenerateFromOutline = useCallback(async () => {
    if (!outline.trim()) return;
    await retrieveKnowledge(outline);
    await generateChapter(outline);
  }, [outline, retrieveKnowledge, generateChapter]);

  const handleAccept = () => {
    if (diffMode === 'generate' || diffMode === 'continue') acceptSuggestion(diffModified);
    else acceptSuggestion(diffModified);
  };

  const handleLoadChapter = useCallback(() => {
    const idx = parseInt(chapterLoadInput, 10);
    if (isNaN(idx) || idx < 1) return;
    loadChapter(idx);
    setChapterLoadInput('');
  }, [chapterLoadInput, loadChapter]);

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]" onBlur={handleBlur} tabIndex={-1}>
      {/* Header — Corporate Trust styled */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 bg-white shadow-[0_2px_8px_-2px_rgba(79,70,229,0.06)]">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="章节标题（可选）"
          className="w-48 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:border-transparent transition-all duration-200 placeholder:text-slate-400"
        />
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500 font-medium">第</label>
          <input
            type="number"
            value={targetChapter || ''}
            onChange={(e) => { const v = parseInt(e.target.value, 10); setTargetChapter(isNaN(v) ? null : v); }}
            placeholder="?" min={1}
            className="w-16 px-2 py-1.5 text-sm text-center border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 transition-all duration-200"
          />
          <label className="text-xs text-slate-500 font-medium">章</label>
        </div>

        {/* 从章节系统加载已有章节 */}
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={chapterLoadInput}
            onChange={(e) => setChapterLoadInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleLoadChapter(); }}
            placeholder="加载章节"
            min={1}
            className="w-24 px-2 py-1.5 text-sm text-center border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 transition-all duration-200 placeholder:text-slate-400"
          />
          <Button size="sm" variant="secondary" onClick={handleLoadChapter}>加载</Button>
        </div>

        {/* 编辑状态指示 */}
        {editSource === 'chapter' && linkedChapterIndex !== null && (
          <span className="text-xs text-indigo-600 font-medium bg-indigo-50 px-2 py-1 rounded-md">
            📄 第{linkedChapterIndex}章
          </span>
        )}

        {/* Mode toggle — Corporate Trust gradient active state */}
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => { setMode('outline'); if (outline) retrieveKnowledge(outline); }}
            className={`px-3 py-1.5 text-xs rounded-md transition-all duration-200 cursor-pointer ${
              mode === 'outline'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-medium shadow-[0_2px_8px_rgba(79,70,229,0.3)]'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >大纲模式</button>
          <button
            type="button"
            onClick={() => { setMode('body'); if (body) retrieveKnowledge(undefined, body); }}
            className={`px-3 py-1.5 text-xs rounded-md transition-all duration-200 cursor-pointer ${
              mode === 'body'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-medium shadow-[0_2px_8px_rgba(79,70,229,0.3)]'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >正文模式</button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {mode === 'outline' ? (
            /* 大纲模式：左右双栏布局 */
            <div className="flex-1 flex flex-row overflow-hidden">
              {/* 左栏：作者写大纲 */}
              <div className="flex-1 flex flex-col border-r border-slate-200 overflow-hidden min-w-0">
                <OutlineEditor />
              </div>
              {/* 右栏：AI 润色扩写为正文 */}
              <div className="flex-1 flex flex-col overflow-hidden bg-white min-w-0">
                <div className="flex items-center justify-between px-4 py-2 bg-indigo-50 border-b-2 border-indigo-300 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-900 font-bold">📝</span>
                    <span className="text-sm font-bold text-indigo-900">正文预览</span>
                    <span className="text-xs font-semibold text-indigo-700">AI 根据左侧大纲自动润色扩写为正文</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleGenerateFromOutline}
                      disabled={aiLoading || !outline.trim()}
                      className="px-3 py-1.5 text-xs font-medium text-indigo-800 bg-indigo-200 hover:bg-indigo-300 rounded-lg shadow-[0_2px_8px_rgba(79,70,229,0.35)] transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >基于大纲撰写正文</button>
                  </div>
                </div>
                {showDiff && (
                  <div className="mx-4 mt-3">
                    <DiffView original={diffOriginal} modified={diffModified} changes={diffChanges} onAccept={handleAccept} onReject={rejectSuggestion} mode={diffMode} />
                  </div>
                )}
                <div className="flex-1 overflow-y-auto p-4">
                  <TipTapEditor
                    content={body}
                    onUpdate={handleBodyUpdate}
                    placeholder="AI 将根据左侧大纲生成正文..."
                    editorId="body"
                    showFormattingToolbar={true}
                    minHeight="min-h-[480px]"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* 正文模式：上下布局（保持原样） */
            <>
              <OutlineEditor />
              {showDiff && (
                <div className="mx-6 mt-3">
                  <DiffView original={diffOriginal} modified={diffModified} changes={diffChanges} onAccept={handleAccept} onReject={rejectSuggestion} mode={diffMode} />
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-6">
                <TipTapEditor
                  content={body}
                  onUpdate={handleBodyUpdate}
                  placeholder="开始写作..."
                  editorId="body"
                  showFormattingToolbar={true}
                  minHeight="min-h-[540px]"
                />
              </div>
            </>
          )}
          <AiToolbar />
        </div>

        {/* 右侧面板 — 常驻展开 Drawer */}
        <Drawer
          open={true}
          width="w-80"
          title={
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => openDrawer('assistant')}
                className={`px-3 py-1.5 text-xs rounded-lg transition-all duration-200 cursor-pointer ${
                  drawerTab === 'assistant'
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-medium shadow-[0_2px_8px_rgba(79,70,229,0.3)]'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >写作辅助</button>
              <button
                type="button"
                onClick={() => openDrawer('knowledge')}
                className={`px-3 py-1.5 text-xs rounded-lg transition-all duration-200 cursor-pointer ${
                  drawerTab === 'knowledge'
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-medium shadow-[0_2px_8px_rgba(79,70,229,0.3)]'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >先验知识</button>
            </div>
          }
        >
          {drawerTab === 'assistant' ? <WritingSidebar /> : <PriorKnowledgePanel />}
        </Drawer>
      </div>

      <DraftManager />
    </div>
  );
}
