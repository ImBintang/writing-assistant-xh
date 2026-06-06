// client/src/components/settings/MigrateDialog.tsx
// Migration preview modal with conflict resolution

import { useState } from 'react';
import { useSettings, CATEGORY_LABELS } from '../../hooks/useSettings';
import type { MigrationItem } from '../../services/settings';

export default function MigrateDialog() {
  const showMigrateDialog = useSettings((s) => s.showMigrateDialog);
  const toggleMigrateDialog = useSettings((s) => s.toggleMigrateDialog);
  const migrationPreview = useSettings((s) => s.migrationPreview);
  const migrationLoading = useSettings((s) => s.migrationLoading);
  const confirmMigration = useSettings((s) => s.confirmMigration);

  const [resolvedConflicts, setResolvedConflicts] = useState<
    Array<{ settingId: string; field: string; resolution: 'accept_new' | 'keep_old' }>
  >([]);

  const handleResolution = (
    settingId: string,
    field: string,
    resolution: 'accept_new' | 'keep_old',
  ) => {
    setResolvedConflicts((prev) => {
      const filtered = prev.filter(
        (r) => !(r.settingId === settingId && r.field === field),
      );
      return [...filtered, { settingId, field, resolution }];
    });
  };

  const getResolution = (settingId: string, field: string): string | null => {
    const r = resolvedConflicts.find(
      (r) => r.settingId === settingId && r.field === field,
    );
    return r?.resolution || null;
  };

  const handleConfirm = async () => {
    await confirmMigration(resolvedConflicts);
  };

  if (!showMigrateDialog || !migrationPreview) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[640px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">📦 迁移预览</h2>
            <button
              onClick={toggleMigrateDialog}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              ×
            </button>
          </div>
          <div className="flex gap-4 mt-2">
            <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded border border-green-200">
              新建 {migrationPreview.summary.willCreate} 个
            </span>
            <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
              合并 {migrationPreview.summary.willMerge} 个
            </span>
            {migrationPreview.summary.totalConflicts > 0 && (
              <span className="text-xs px-2 py-0.5 bg-red-50 text-red-700 rounded border border-red-200">
                {migrationPreview.summary.totalConflicts} 个冲突
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {migrationPreview.items.map((item: MigrationItem) => (
            <div
              key={item.settingId}
              className="border border-gray-200 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="font-medium text-gray-800">{item.settingTitle}</h4>
                  <span className="text-xs text-gray-400">
                    {CATEGORY_LABELS[item.category] || item.category}
                  </span>
                </div>
                {item.action === 'create' ? (
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                    新建条目
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                    合并到 {item.matchedEntryName}
                    {item.similarity !== undefined && ` (${(item.similarity * 100).toFixed(0)}% 匹配)`}
                  </span>
                )}
              </div>

              {/* Extracted fields */}
              {item.extractedFields.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-gray-500 mb-1">提取的字段:</p>
                  <div className="flex flex-wrap gap-1">
                    {item.extractedFields.map((f) => (
                      <span
                        key={f.field}
                        className="text-xs px-1.5 py-0.5 bg-gray-50 text-gray-600 rounded border border-gray-150 truncate max-w-[200px]"
                        title={`${f.field}: ${String(f.value)}`}
                      >
                        {f.field}: {String(f.value).slice(0, 40)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Conflicts */}
              {item.conflicts.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-red-600 mb-1.5">
                    ⚠ 冲突 ({item.conflicts.length})
                  </p>
                  {item.conflicts.map((conflict) => {
                    const resolution = getResolution(item.settingId, conflict.field);
                    return (
                      <div
                        key={conflict.field}
                        className="border border-red-100 rounded p-2.5 mb-1.5 bg-red-50"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-xs font-medium text-gray-700">
                              {conflict.field}
                            </p>
                            <div className="text-xs text-gray-500 mt-0.5 space-y-0.5">
                              <p>
                                现有: <span className="text-gray-700">{String(conflict.existingValue).slice(0, 80)}</span>
                              </p>
                              <p>
                                新增: <span className="text-gray-700">{String(conflict.incomingValue).slice(0, 80)}</span>
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-1 ml-3">
                            <button
                              onClick={() =>
                                handleResolution(item.settingId, conflict.field, 'accept_new')
                              }
                              className={`px-2 py-1 text-xs rounded transition-colors ${
                                resolution === 'accept_new'
                                  ? 'bg-green-500 text-white'
                                  : 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'
                              }`}
                            >
                              接受新值
                            </button>
                            <button
                              onClick={() =>
                                handleResolution(item.settingId, conflict.field, 'keep_old')
                              }
                              className={`px-2 py-1 text-xs rounded transition-colors ${
                                resolution === 'keep_old'
                                  ? 'bg-gray-500 text-white'
                                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              保留旧值
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={toggleMigrateDialog}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={migrationLoading}
            className={`px-4 py-2 text-sm rounded-lg font-medium text-white transition-colors ${
              migrationLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-orange-500 hover:bg-orange-600'
            }`}
          >
            {migrationLoading ? '迁移中...' : '确认迁移'}
          </button>
        </div>
      </div>
    </div>
  );
}
