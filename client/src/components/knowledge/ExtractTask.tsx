// client/src/components/knowledge/ExtractTask.tsx
// Extraction task configuration modal and progress display

import { useEffect, useRef } from 'react';
import { useKnowledge } from '../../hooks/useKnowledge';
import { useChapters } from '../../hooks/useChapters';
import { useExtractionWebSocket } from '../../hooks/useExtractionWebSocket';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { ProgressUpdate, MergeCompleteUpdate, TaskCompleteUpdate } from '../../hooks/useExtractionWebSocket';

interface ExtractTaskProps {
  onClose: () => void;
}

export default function ExtractTask({ onClose }: ExtractTaskProps) {
  const {
    taskId,
    taskStatus,
    progress,
    extractionErrors,
    selectedCategories,
    selectedChapterIds,
    startExtraction,
    cancelExtraction,
    fetchTaskStatus,
    resetExtraction,
    toggleCategory,
    toggleChapter,
    selectAllChapters,
    loadConflicts,
  } = useKnowledge();

  const chaptersData = useChapters();
  const chapters = chaptersData.chapters;
  const pollingRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const usePolling = useRef(false);

  const confirmedChapters = chapters;
  const confirmedIds = confirmedChapters.map((ch) => ch.index);

  const { connected } = useExtractionWebSocket({
    taskId: taskStatus === 'running' ? taskId : null,
    onProgress: (data: ProgressUpdate) => {
      useKnowledge.setState({ progress: data });
    },
    onMergeComplete: (_data: MergeCompleteUpdate) => {},
    onTaskComplete: (data: TaskCompleteUpdate) => {
      useKnowledge.setState({ taskStatus: data.status as 'completed' | 'failed' | 'cancelled' });
      loadConflicts();
    },
    onError: (error) => {
      console.error('Extraction error:', error.message);
    },
    onFallbackToPolling: () => {
      usePolling.current = true;
    },
  });

  useEffect(() => {
    if (usePolling.current && taskId && taskStatus === 'running') {
      pollingRef.current = setInterval(() => {
        fetchTaskStatus(taskId);
      }, 2000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [usePolling.current, taskId, taskStatus, fetchTaskStatus]);

  const handleStart = async () => {
    if (selectedChapterIds.length === 0 || selectedCategories.length === 0) return;
    await startExtraction(selectedChapterIds, selectedCategories);
  };

  const handleCancel = async () => {
    await cancelExtraction();
  };

  const handleClose = () => {
    if (taskStatus === 'running') {
      if (!confirm('提取任务正在进行中，关闭窗口不会停止任务。确定要关闭吗？')) return;
    }
    resetExtraction();
    onClose();
  };

  const allCategories = [
    { key: 'characters', label: '人物' },
    { key: 'techniques', label: '功法' },
    { key: 'locations', label: '地图' },
    { key: 'worldbuilding', label: '世界观' },
    { key: 'weapons', label: '武器' },
    { key: 'alchemy', label: '丹药' },
    { key: 'plot', label: '情节' },
  ];

  const allSelected = confirmedIds.length > 0 && selectedChapterIds.length === confirmedIds.length;

  const title =
    taskStatus === 'running' ? '提取进度' :
    taskStatus === 'completed' ? '提取完成' :
    taskStatus === 'failed' ? '提取失败' :
    '知识提取任务';

  return (
    <Modal
      open={true}
      onClose={handleClose}
      title={title}
      size="2xl"
      footer={
        <>
          <div>
            {taskStatus === 'idle' && (
              <span className="text-xs text-slate-400">
                {selectedChapterIds.length === 0
                  ? '请选择章节'
                  : selectedCategories.length === 0
                    ? '请选择分类'
                    : `将对 ${selectedChapterIds.length} 章进行 ${selectedCategories.length} 个分类的提取`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 ml-auto">
            {taskStatus === 'running' && (
              <Button variant="danger" onClick={handleCancel}>
                取消提取
              </Button>
            )}
            {taskStatus === 'idle' && (
              <>
                <Button variant="secondary" onClick={handleClose}>取消</Button>
                <Button
                  onClick={handleStart}
                  disabled={selectedChapterIds.length === 0 || selectedCategories.length === 0}
                >
                  开始提取
                </Button>
              </>
            )}
            {(taskStatus === 'completed' || taskStatus === 'failed' || taskStatus === 'cancelled') && (
              <Button variant="secondary" onClick={handleClose}>关闭</Button>
            )}
          </div>
        </>
      }
    >
      {/* Configuration */}
      {taskStatus === 'idle' && (
        <>
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-slate-700">选择章节</h4>
              <button
                onClick={() => selectAllChapters(confirmedIds)}
                className="text-xs text-indigo-600 hover:text-indigo-800"
              >
                {allSelected ? '取消全选' : '全选'}
              </button>
            </div>
            {confirmedChapters.length === 0 ? (
              <p className="text-sm text-slate-500">暂无章节。请先在章节管理页面上传并确认拆分。</p>
            ) : (
              <div className="grid grid-cols-5 gap-2 max-h-40 overflow-y-auto">
                {confirmedChapters.map((ch) => (
                  <label
                    key={ch.index}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs cursor-pointer border transition-colors ${
                      selectedChapterIds.includes(ch.index)
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedChapterIds.includes(ch.index)}
                      onChange={() => toggleChapter(ch.index)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="truncate">{ch.index}. {ch.title}</span>
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-400 mt-1">
              已选择 {selectedChapterIds.length} / {confirmedChapters.length} 章
            </p>
          </div>

          <div className="mb-6">
            <h4 className="text-sm font-medium text-slate-700 mb-2">选择知识分类</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {allCategories.map((cat) => (
                <label
                  key={cat.key}
                  className={`flex items-center gap-2 px-3 py-2 rounded-card text-sm cursor-pointer border transition-colors ${
                    selectedCategories.includes(cat.key)
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(cat.key)}
                    onChange={() => toggleCategory(cat.key)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="whitespace-nowrap">{cat.label}</span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Progress display */}
      {taskStatus !== 'idle' && progress && (
        <div className="mb-6">
          <div className="mb-3">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-600">
                {taskStatus === 'running' ? '提取中...' : taskStatus === 'completed' ? '提取完成' : taskStatus === 'failed' ? '提取失败' : '已取消'}
              </span>
              <span className="text-slate-500">{progress.completedSteps} / {progress.totalSteps}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  taskStatus === 'failed' ? 'bg-red-500' :
                  taskStatus === 'completed' ? 'bg-emerald-500' :
                  'bg-indigo-600'
                }`}
                style={{ width: `${progress.totalSteps > 0 ? Math.round((progress.completedSteps / progress.totalSteps) * 100) : 0}%` }}
              />
            </div>
          </div>

          {taskStatus === 'running' && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-card p-3 mb-3">
              <div className="flex items-center gap-2 text-sm">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600" />
                <span className="text-indigo-700">
                  正在处理 <span className="font-medium">{progress.currentChapterTitle || '—'}</span>
                  {progress.currentCategory && <><span> — </span><span className="font-medium">{progress.currentCategory}</span></>}
                </span>
              </div>
            </div>
          )}

          {taskStatus === 'running' && (
            <p className="text-xs text-slate-400">
              {connected ? '🟢 WebSocket 已连接' : '🟡 使用轮询获取进度'}
            </p>
          )}
        </div>
      )}

      {/* Errors */}
      {extractionErrors.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-red-700 mb-2">提取错误 ({extractionErrors.length})</h4>
          <div className="bg-red-50 border border-red-200 rounded-card p-3 max-h-32 overflow-y-auto">
            {extractionErrors.map((err, i) => (
              <div key={i} className="text-xs text-red-700 mb-1">
                <span className="font-medium">{err.chapterTitle}</span>
                {err.category !== 'system' && <span className="text-red-500"> — {err.category}</span>}
                : {err.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {taskStatus === 'completed' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-card p-3">
          <p className="text-sm text-emerald-700 mb-1">✅ 知识提取任务已完成</p>
          <p className="text-xs text-emerald-600">请检查是否有需要裁决的冲突。</p>
        </div>
      )}
    </Modal>
  );
}
