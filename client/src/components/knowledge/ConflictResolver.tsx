// client/src/components/knowledge/ConflictResolver.tsx
// Conflict resolution modal — compare old vs new values and resolve

import { useState } from 'react';
import type { ConflictWithEntry, ConflictRecord } from '../../services/knowledge';
import { useKnowledge } from '../../hooks/useKnowledge';

interface ConflictResolverProps {
  onClose: () => void;
}

export default function ConflictResolver({ onClose }: ConflictResolverProps) {
  const { conflicts, conflictEntryId, resolveConflict, batchResolveConflicts, loadConflicts } =
    useKnowledge();

  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [resolutions, setResolutions] = useState<Record<string, 'accept_new' | 'keep_old' | 'manual'>>({});

  // Filter to show either a specific entry's conflicts or all
  const displayConflicts: ConflictWithEntry[] = conflictEntryId
    ? conflicts.filter((c) => c.entry.id === conflictEntryId)
    : conflicts;

  const getConflictKey = (entryId: string, conflictIdx: number) =>
    `${entryId}/${conflictIdx}`;

  const handleResolveSingle = async (
    entryId: string,
    conflictIndex: number,
  ) => {
    const key = getConflictKey(entryId, conflictIndex);
    const resolution = resolutions[key] || 'accept_new';

    setResolvingId(key);
    try {
      await resolveConflict(
        entryId,
        conflictIndex,
        resolution,
        resolution === 'manual' ? manualValues[key] : undefined,
      );
      const newRes = { ...resolutions };
      delete newRes[key];
      setResolutions(newRes);
    } catch {
      // Error handled by store
    } finally {
      setResolvingId(null);
    }
  };

  const handleBatchAcceptNew = async () => {
    const batchResolutions = displayConflicts.flatMap((c) =>
      c.conflicts
        .filter((cf: ConflictRecord) => !cf.resolved)
        .map((_cf: ConflictRecord, idx: number) => ({
          entryId: c.entry.id,
          conflictIndex: idx,
          resolution: 'accept_new' as const,
        })),
    );
    if (batchResolutions.length === 0) return;
    await batchResolveConflicts(batchResolutions);
    await loadConflicts();
  };

  const totalConflicts = displayConflicts.reduce(
    (sum, c) => sum + c.conflicts.filter((cf) => !cf.resolved).length,
    0,
  );

  const renderValue = (value: unknown): string => {
    if (value === null || value === undefined) return '（空）';
    if (typeof value === 'object') return JSON.stringify(value, null, 1);
    return String(value);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-800">冲突裁决</h3>
            <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
              {totalConflicts} 个待裁决
            </span>
          </div>
          <div className="flex items-center gap-2">
            {totalConflicts > 0 && (
              <button
                onClick={handleBatchAcceptNew}
                className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
              >
                一键接受全部新版
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {displayConflicts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">暂无待裁决的冲突</p>
            </div>
          ) : (
            <div className="space-y-6">
              {displayConflicts.map(({ entry, conflicts: entryConflicts }) => (
                <div
                  key={entry.id}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  <div className="bg-gray-50 px-4 py-2 border-b">
                    <span className="font-medium text-gray-800">{entry.name}</span>
                    <span className="text-gray-400 text-sm ml-2">
                      — {entry.category} · 版本 {entry.version}
                    </span>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {entryConflicts.filter((c: ConflictRecord) => !c.resolved).map((conflict: ConflictRecord, idx: number) => {
                      const key = getConflictKey(entry.id, idx);
                      const currentResolution = resolutions[key] || 'accept_new';

                      return (
                        <div key={key} className="px-4 py-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-gray-700">
                              {conflict.field}
                            </span>
                            <span className="text-xs text-gray-400">
                              (来源: 第{conflict.sourceChapter}章)
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="border border-red-200 bg-red-50 rounded-md p-2">
                              <div className="text-xs text-red-500 font-medium mb-1">旧值</div>
                              <pre className="text-xs text-red-700 whitespace-pre-wrap font-sans">
                                {renderValue(conflict.oldValue)}
                              </pre>
                            </div>
                            <div className="border border-green-200 bg-green-50 rounded-md p-2">
                              <div className="text-xs text-green-500 font-medium mb-1">新值</div>
                              <pre className="text-xs text-green-700 whitespace-pre-wrap font-sans">
                                {renderValue(conflict.newValue)}
                              </pre>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {(['accept_new', 'keep_old', 'manual'] as const).map((opt) => (
                              <button
                                key={opt}
                                onClick={() =>
                                  setResolutions((prev) => ({ ...prev, [key]: opt }))
                                }
                                className={`px-2.5 py-1 text-xs rounded-md border ${
                                  currentResolution === opt
                                    ? opt === 'accept_new'
                                      ? 'bg-green-600 text-white border-green-600'
                                      : opt === 'keep_old'
                                        ? 'bg-red-600 text-white border-red-600'
                                        : 'bg-blue-600 text-white border-blue-600'
                                    : opt === 'accept_new'
                                      ? 'bg-white text-green-700 border-green-300 hover:bg-green-50'
                                      : opt === 'keep_old'
                                        ? 'bg-white text-red-700 border-red-300 hover:bg-red-50'
                                        : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50'
                                }`}
                              >
                                {opt === 'accept_new' ? '接受新版' : opt === 'keep_old' ? '保留旧版' : '手动编辑'}
                              </button>
                            ))}

                            {currentResolution === 'manual' && (
                              <input
                                type="text"
                                value={manualValues[key] || ''}
                                onChange={(e) =>
                                  setManualValues((prev) => ({
                                    ...prev,
                                    [key]: e.target.value,
                                  }))
                                }
                                placeholder="输入自定义值..."
                                className="flex-1 min-w-[200px] px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                              />
                            )}

                            <button
                              onClick={() => handleResolveSingle(entry.id, idx)}
                              disabled={resolvingId === key}
                              className="ml-auto px-3 py-1 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                            >
                              {resolvingId === key ? '...' : '确认'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
