// client/src/components/knowledge/ConflictResolver.tsx
// Conflict resolution modal

import { useState } from 'react';
import type { ConflictWithEntry, ConflictRecord } from '../../services/knowledge';
import { useKnowledge } from '../../hooks/useKnowledge';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface ConflictResolverProps {
  onClose: () => void;
}

export default function ConflictResolver({ onClose }: ConflictResolverProps) {
  const { conflicts, conflictEntryId, resolveConflict, batchResolveConflicts, loadConflicts } =
    useKnowledge();

  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [resolutions, setResolutions] = useState<Record<string, 'accept_new' | 'keep_old' | 'manual'>>({});

  const displayConflicts: ConflictWithEntry[] = conflictEntryId
    ? conflicts.filter((c) => c.entry.id === conflictEntryId)
    : conflicts;

  const getConflictKey = (entryId: string, conflictIdx: number) => `${entryId}/${conflictIdx}`;

  const handleResolveSingle = async (entryId: string, conflictIndex: number) => {
    const key = getConflictKey(entryId, conflictIndex);
    const resolution = resolutions[key] || 'accept_new';
    setResolvingId(key);
    try {
      await resolveConflict(entryId, conflictIndex, resolution, resolution === 'manual' ? manualValues[key] : undefined);
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
      c.conflicts.filter((cf: ConflictRecord) => !cf.resolved).map((_cf: ConflictRecord, idx: number) => ({
        entryId: c.entry.id, conflictIndex: idx, resolution: 'accept_new' as const,
      }))
    );
    if (batchResolutions.length === 0) return;
    await batchResolveConflicts(batchResolutions);
    await loadConflicts();
  };

  const totalConflicts = displayConflicts.reduce(
    (sum, c) => sum + c.conflicts.filter((cf) => !cf.resolved).length, 0,
  );

  const renderValue = (value: unknown): string => {
    if (value === null || value === undefined) return '（空）';
    if (typeof value === 'object') return JSON.stringify(value, null, 1);
    return String(value);
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
                <span className="text-slate-400 text-sm ml-2">— {entry.category} · 版本 {entry.version}</span>
              </div>

              <div className="divide-y divide-slate-100">
                {entryConflicts.filter((c: ConflictRecord) => !c.resolved).map((conflict: ConflictRecord, idx: number) => {
                  const key = getConflictKey(entry.id, idx);
                  const currentResolution = resolutions[key] || 'accept_new';

                  return (
                    <div key={key} className="px-4 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-slate-700">{conflict.field}</span>
                        <span className="text-xs text-slate-400">(来源: 第{conflict.sourceChapter}章)</span>
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

                      <div className="flex items-center gap-2 flex-wrap">
                        {(['accept_new', 'keep_old', 'manual'] as const).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setResolutions((prev) => ({ ...prev, [key]: opt }))}
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
                            value={manualValues[key] || ''}
                            onChange={(e) => setManualValues((prev) => ({ ...prev, [key]: e.target.value }))}
                            placeholder="输入自定义值..."
                            className="flex-1 min-w-[200px] px-2 py-1 text-xs border border-slate-200 rounded-input focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        )}

                        <Button
                          size="sm"
                          onClick={() => handleResolveSingle(entry.id, idx)}
                          disabled={resolvingId === key}
                          isLoading={resolvingId === key}
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
