// client/src/components/knowledge/ConflictResolver.tsx
// Conflict resolution modal — with PRD-10: risk prescan, coexist, import next chapter

import { useState, useRef, useEffect } from 'react';
import type { ConflictWithEntry, ConflictRecord, AiMergeMode } from '../../services/knowledge';
import { aiMergeConflict } from '../../services/knowledge';
import { useKnowledge, CATEGORY_NAMES } from '../../hooks/useKnowledge';
import { useToast } from '../../hooks/useToast';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface ConflictResolverProps {
  onClose: () => void;
}

const MERGE_MODE_LABELS: Record<AiMergeMode, string> = {
  prefer_old: '旧版为主',
  prefer_new: '新版为主',
  balanced: '综合考量',
};

export default function ConflictResolver({ onClose }: ConflictResolverProps) {
  const {
    conflicts, conflictEntryId, resolveConflict, batchResolveConflicts,
    loadImportProgress, prescanConflicts, prescanLoading,
    batchMergeLowRisk, resolveConflictCoexist,
  } = useKnowledge();
  const { addToast } = useToast();

  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [resolutions, setResolutions] = useState<Record<string, 'accept_new' | 'keep_old' | 'manual' | 'use_merged'>>({});
  const [aiLoadingKey, setAiLoadingKey] = useState<string | null>(null);
  const [mergeModeMenu, setMergeModeMenu] = useState<string | null>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  // PRD-10 state
  const [importProgressLoaded, setImportProgressLoaded] = useState(false);
  const [prescanDone, setPrescanDone] = useState(false);
  const [coexistLoadingKey, setCoexistLoadingKey] = useState<string | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!mergeModeMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setMergeModeMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mergeModeMenu]);

  // Load import progress on mount
  useEffect(() => {
    if (!importProgressLoaded) {
      loadImportProgress();
      setImportProgressLoaded(true);
    }
  }, [importProgressLoaded, loadImportProgress]);

  const displayConflicts: ConflictWithEntry[] = conflictEntryId
    ? conflicts.filter((c) => c.entry.id === conflictEntryId)
    : conflicts;

  const getConflictKey = (entryId: string, field: string) => `${entryId}/${field}`;

  // Track prescan state
  useEffect(() => {
    const scanned = displayConflicts.some((c) =>
      c.conflicts.some((cf) => cf.riskLevel !== undefined),
    );
    setPrescanDone(scanned);
  }, [conflicts]);

  // Sync manualValues for low-risk conflicts that default to use_merged
  useEffect(() => {
    const updates: Record<string, string> = {};
    for (const { entry, conflicts: entryConflicts } of displayConflicts) {
      for (const conflict of entryConflicts) {
        if (conflict.resolved) continue;
        const key = getConflictKey(entry.id, conflict.field);
        if (conflict.riskLevel === 'low' && conflict.aiMergedText && !manualValues[key]) {
          updates[key] = conflict.aiMergedText;
        }
      }
    }
    if (Object.keys(updates).length > 0) {
      setManualValues((prev) => ({ ...prev, ...updates }));
    }
  }, [conflicts]);

  const handleResolveSingle = async (entryId: string, field: string) => {
    const key = getConflictKey(entryId, field);
    let resolution = resolutions[key] || 'accept_new';
    let manualValue: string | undefined;

    // use_merged resolves as manual with the aiMergedText value
    if (resolution === 'use_merged') {
      resolution = 'manual';
      manualValue = manualValues[key] || '';
    }

    setResolvingId(key);
    try {
      const success = await resolveConflict(entryId, field, resolution, resolution === 'manual' ? (manualValue || manualValues[key]) : undefined);
      if (success) {
        addToast('success', '冲突已解决');
        const newRes = { ...resolutions };
        delete newRes[key];
        setResolutions(newRes);
      } else {
        addToast('error', '冲突解决失败，请重试');
      }
    } catch {
      addToast('error', '网络错误，请重试');
    } finally {
      setResolvingId(null);
    }
  };

  const handleBatchAcceptNew = async () => {
    const batchResolutions = displayConflicts.flatMap((c) =>
      c.conflicts.filter((cf: ConflictRecord) => !cf.resolved).map((cf: ConflictRecord) => ({
        entryId: c.entry.id, field: cf.field, resolution: 'accept_new' as const,
      }))
    );
    if (batchResolutions.length === 0) return;
    const count = await batchResolveConflicts(batchResolutions);
    addToast('success', `已解决 ${count} 个冲突`);
  };

  const handleAiMerge = async (entryId: string, field: string, oldValue: unknown, newValue: unknown, mode: AiMergeMode) => {
    setMergeModeMenu(null);
    const key = getConflictKey(entryId, field);

    if (typeof oldValue !== 'string' || typeof newValue !== 'string') {
      addToast('error', 'AI 合并仅支持文本类型的字段');
      return;
    }

    setAiLoadingKey(key);
    try {
      const merged = await aiMergeConflict(oldValue, newValue, mode);
      setManualValues((prev) => ({ ...prev, [key]: merged }));
      setResolutions((prev) => ({ ...prev, [key]: 'manual' }));
      addToast('success', 'AI 合并完成，结果已填入手动编辑框');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI 合并失败';
      addToast('error', msg);
    } finally {
      setAiLoadingKey(null);
    }
  };

  const isStringValue = (v: unknown): boolean => typeof v === 'string';

  const totalConflicts = displayConflicts.reduce(
    (sum, c) => sum + c.conflicts.filter((cf) => !cf.resolved).length, 0,
  );

  const renderValue = (value: unknown): string => {
    if (value === null || value === undefined) return '（空）';
    if (typeof value === 'object') return JSON.stringify(value, null, 1);
    return String(value);
  };

  // ---- PRD-10 Handlers ----


  const handlePrescan = async () => {
    try {
      await prescanConflicts();
      addToast('success', '已完成评估');
    } catch {
      addToast('error', '预扫描失败');
    }
  };

  const handleBatchMergeLow = async () => {
    // If prescan hasn't been done yet, run it first
    if (!prescanDone) {
      addToast('info', '正在预扫描冲突风险…');
      try {
        await prescanConflicts();
      } catch {
        addToast('error', '预扫描失败，请重试');
        return;
      }
    }
    const count = await batchMergeLowRisk();
    if (count > 0) {
      addToast('success', `已合并 ${count} 个低风险冲突`);
    } else {
      addToast('info', '没有可合并的低风险冲突');
    }
  };

  const handleCoexist = async (
    entryId: string,
    field: string,
    oldChapterIndex: number,
    oldChapterTitle: string,
    newChapterIndex: number,
    newChapterTitle: string,
  ) => {
    const key = getConflictKey(entryId, field);
    setCoexistLoadingKey(key);
    try {
      const success = await resolveConflictCoexist(
        entryId, field, oldChapterIndex, oldChapterTitle, newChapterIndex, newChapterTitle,
      );
      if (success) {
        addToast('success', '已以并行共存方式解决');
      } else {
        addToast('error', '并行共存处理失败');
      }
    } catch {
      addToast('error', '网络错误');
    } finally {
      setCoexistLoadingKey(null);
    }
  };

  const getDefaultResolution = (conflict: ConflictRecord): 'accept_new' | 'keep_old' | 'manual' | 'use_merged' => {
    // For low risk conflicts with AI merged text, default to "使用合并文本"
    if (conflict.riskLevel === 'low' && conflict.aiMergedText) {
      return 'use_merged';
    }
    return 'accept_new';
  };

  const getChapterInfo = (conflict: ConflictRecord, entry: { source: Array<{ chapter: number; chapterTitle: string }> }) => {
    const oldChapterIndex = conflict.sourceChapter;
    const newChapterSource = entry.source.find((s) => s.chapter > oldChapterIndex);
    return {
      oldChapterIndex,
      oldChapterTitle: `第${oldChapterIndex}章`,
      newChapterIndex: newChapterSource?.chapter || oldChapterIndex + 1,
      newChapterTitle: newChapterSource?.chapterTitle || `第${oldChapterIndex + 1}章`,
    };
  };


  return (
    <Modal
      open={true}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <span>冲突裁决</span>
          <Badge variant="warning">{totalConflicts} 个待裁决</Badge>
        </div>
      }
      size="4xl"
      footer={
        <div className="flex items-center justify-between w-full">
          {totalConflicts > 0 && (
            <Button size="sm" onClick={handleBatchAcceptNew} className="bg-emerald-600 hover:bg-emerald-700 from-emerald-600 to-emerald-600">
              一键接受全部新版
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>关闭</Button>
        </div>
      }
    >
      {/* Top toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {/* AI risk assessment button */}
        <Button size="sm" onClick={handlePrescan} isLoading={prescanLoading} disabled={prescanLoading}>
          {prescanLoading ? '评估中…' : 'AI风险评估'}
        </Button>

        {/* 一键合并低风险 — always available; triggers prescan first if needed */}
        <Button
          size="sm"
          onClick={handleBatchMergeLow}
          disabled={totalConflicts === 0}
          isLoading={prescanLoading}
          className={totalConflicts > 0 ? 'bg-amber-600 hover:bg-amber-700 from-amber-600 to-amber-600 text-white' : ''}
        >
          一键合并低风险
        </Button>

        <div className="flex-1" />
      </div>

      {displayConflicts.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-slate-500">暂无待裁决的冲突</p>
        </div>
      ) : (
        <div className="space-y-6">
          {displayConflicts.map(({ entry, conflicts: entryConflicts }) => (
            <div key={entry.id} className="border border-slate-200 rounded-card overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                <span className="font-medium text-slate-800">{entry.name}</span>
                <span className="text-slate-400 text-sm ml-2">— {CATEGORY_NAMES[entry.category] || entry.category} · 版本 {entry.version}</span>
              </div>

              <div className="divide-y divide-slate-100">
                {entryConflicts.filter((c: ConflictRecord) => !c.resolved).map((conflict: ConflictRecord) => {
                  const rowKey = `${conflict.field}/${conflict.sourceChapter}/${conflict.detectedAt}`;
                  const resolutionKey = getConflictKey(entry.id, conflict.field);
                  const currentResolution = resolutions[resolutionKey] || getDefaultResolution(conflict);
                  const chapterInfo = getChapterInfo(conflict, entry);

                  return (
                    <div key={rowKey} className="px-4 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-slate-700">{conflict.field}</span>
                        <span className="text-xs text-slate-400">(来源: 第{conflict.sourceChapter}章)</span>
                        {/* PRD-10: Risk level badge */}
                        {conflict.riskLevel === 'low' && (
                          <Badge variant="success">低风险</Badge>
                        )}
                        {conflict.riskLevel === 'high' && (
                          <Badge variant="error">高风险</Badge>
                        )}
                        {!conflict.riskLevel && (
                          <span className="text-xs text-slate-300">未扫描</span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="border border-red-200 bg-red-50 rounded-card p-2">
                          <div className="text-xs text-red-500 font-medium mb-1">旧值</div>
                          <pre className="text-xs text-red-700 whitespace-pre-wrap font-sans">
                            {renderValue(conflict.oldValue)}
                          </pre>
                        </div>
                        <div className="border border-emerald-200 bg-emerald-50 rounded-card p-2">
                          <div className="text-xs text-emerald-500 font-medium mb-1">新值</div>
                          <pre className="text-xs text-emerald-700 whitespace-pre-wrap font-sans">
                            {renderValue(conflict.newValue)}
                          </pre>
                        </div>
                      </div>

                      {/* PRD-10: AI merged text preview for low risk */}
                      {conflict.riskLevel === 'low' && conflict.aiMergedText && (
                        <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-card">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-amber-600 font-medium">AI 建议合并文本</span>
                            <button
                              onClick={() => {
                                setResolutions((prev) => ({ ...prev, [resolutionKey]: 'use_merged' }));
                                setManualValues((prev) => ({ ...prev, [resolutionKey]: conflict.aiMergedText! }));
                              }}
                              className={`px-2 py-0.5 text-xs rounded-btn border transition-colors ${
                                currentResolution === 'use_merged'
                                  ? 'bg-amber-600 text-white border-amber-600'
                                  : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'
                              }`}
                            >
                              使用合并文本
                            </button>
                          </div>
                          <pre className="text-xs text-amber-800 whitespace-pre-wrap font-sans">
                            {conflict.aiMergedText}
                          </pre>
                        </div>
                      )}

                      {/* PRD-10: Risk reason */}
                      {conflict.riskReason && (
                        <div className="mb-2 text-xs text-slate-400 italic">
                          {conflict.riskReason}
                        </div>
                      )}

                      <div className="flex items-center gap-2 flex-wrap">
                        {(['accept_new', 'keep_old', 'manual'] as const).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setResolutions((prev) => ({ ...prev, [resolutionKey]: opt }))}
                            className={`px-2.5 py-1 text-xs rounded-btn border transition-colors ${
                              currentResolution === opt
                                ? opt === 'accept_new' ? 'bg-emerald-600 text-white border-emerald-600'
                                : opt === 'keep_old' ? 'bg-red-600 text-white border-red-600'
                                : 'bg-blue-600 text-white border-blue-600'
                                : opt === 'accept_new' ? 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                                : opt === 'keep_old' ? 'bg-white text-red-700 border-red-300 hover:bg-red-50'
                                : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50'
                            }`}
                          >
                            {opt === 'accept_new' ? '接受新版' : opt === 'keep_old' ? '保留旧版' : '手动编辑'}
                          </button>
                        ))}

                        {currentResolution === 'manual' && (
                          <input
                            type="text"
                            value={manualValues[resolutionKey] || ''}
                            onChange={(e) => setManualValues((prev) => ({ ...prev, [resolutionKey]: e.target.value }))}
                            placeholder="输入自定义值..."
                            className="flex-1 min-w-[200px] px-2 py-1 text-xs border border-slate-200 rounded-input focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        )}

                        {/* AI Merge button — only for string values */}
                        {isStringValue(conflict.oldValue) && isStringValue(conflict.newValue) && (
                          <div className="relative" data-merge-menu-container>
                            <button
                              type="button"
                              onClick={() => setMergeModeMenu(mergeModeMenu === resolutionKey ? null : resolutionKey)}
                              disabled={aiLoadingKey === resolutionKey}
                              className={`px-2.5 py-1 text-xs rounded-btn border border-indigo-300 transition-colors ${
                                aiLoadingKey === resolutionKey
                                  ? 'bg-indigo-100 text-indigo-400 cursor-wait'
                                  : 'bg-white text-indigo-600 hover:bg-indigo-50'
                              }`}
                            >
                              {aiLoadingKey === resolutionKey ? 'AI 合并中…' : 'AI 合并'}
                            </button>
                            {mergeModeMenu === resolutionKey && (
                              <div ref={menuContainerRef} className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-card shadow-[0_10px_25px_-5px_rgba(79,70,229,0.15)] z-10 py-1 min-w-[140px]">
                                {(Object.entries(MERGE_MODE_LABELS) as [AiMergeMode, string][]).map(([mode, label]) => (
                                  <button
                                    key={mode}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAiMerge(entry.id, conflict.field, conflict.oldValue, conflict.newValue, mode);
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* PRD-10: Coexist button — available for ANY risk level */}
                        {conflict.riskLevel && (
                          <button
                            type="button"
                            onClick={() => handleCoexist(
                              entry.id,
                              conflict.field,
                              chapterInfo.oldChapterIndex,
                              chapterInfo.oldChapterTitle,
                              chapterInfo.newChapterIndex,
                              chapterInfo.newChapterTitle,
                            )}
                            disabled={coexistLoadingKey === resolutionKey}
                            className={`px-2.5 py-1 text-xs rounded-btn border border-purple-300 transition-colors ${
                              coexistLoadingKey === resolutionKey
                                ? 'bg-purple-100 text-purple-400 cursor-wait'
                                : 'bg-white text-purple-600 hover:bg-purple-50'
                            }`}
                          >
                            {coexistLoadingKey === resolutionKey ? '处理中…' : '并行共存'}
                          </button>
                        )}

                        <Button
                          size="sm"
                          onClick={() => handleResolveSingle(entry.id, conflict.field)}
                          disabled={resolvingId === resolutionKey}
                          isLoading={resolvingId === resolutionKey}
                        >
                          确认
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
