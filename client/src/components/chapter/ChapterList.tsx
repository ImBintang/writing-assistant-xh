import { useState } from 'react';
import { useChapters } from '../../hooks/useChapters';
import AnomalyBadge from './AnomalyBadge';
import type { ChapterMeta, AnomalyRecord } from '../../services/chapters';

export default function ChapterList() {
  const {
    chapters,
    anomalies,
    loading,
    status,
    selectedChapterId,
    selectedIds,
    selectChapter,
    toggleSelect,
    clearSelection,
    openEditor,
    openMergeModal,
    openConfirmDialog,
    openAnomalyDetail,
  } = useChapters();

  const [filter, setFilter] = useState<'all' | 'anomaly'>('all');

  // Build a map of anomaly type by chapter index
  const anomalyMap: Map<number, AnomalyRecord> = new Map();
  for (const a of anomalies) {
    if (!anomalyMap.has(a.chapterIndex)) {
      anomalyMap.set(a.chapterIndex, a);
    }
  }

  const filteredChapters =
    filter === 'anomaly'
      ? chapters.filter((ch) => anomalyMap.has(ch.index))
      : chapters;

  const canMerge =
    selectedIds.length >= 2 &&
    selectedIds.every(
      (id, i) =>
        i === 0 || id === selectedIds[i - 1] + 1,
    );

  const isConfirmed = status === 'confirmed';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (chapters.length === 0 && status !== 'empty') {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-lg mb-2">暂无章节</p>
        <p className="text-sm">请先上传 txt 文件进行拆分</p>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Filter toggle */}
          <div className="flex bg-gray-100 rounded-md p-0.5">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 text-sm rounded ${
                filter === 'all'
                  ? 'bg-white shadow text-gray-800 font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setFilter('anomaly')}
              className={`px-3 py-1 text-sm rounded ${
                filter === 'anomaly'
                  ? 'bg-white shadow text-gray-800 font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              仅异常
              {anomalies.length > 0 && (
                <span className="ml-1 text-xs bg-yellow-500 text-white rounded-full px-1.5 py-0.5">
                  {anomalies.length}
                </span>
              )}
            </button>
          </div>

          {/* Actions */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={canMerge ? openMergeModal : undefined}
                disabled={!canMerge}
                className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  !canMerge ? '请选择连续的章节进行合并' : '合并选中章节'
                }
              >
                合并 ({selectedIds.length})
              </button>
              <button
                onClick={clearSelection}
                className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700"
              >
                取消选择
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {!isConfirmed && chapters.length > 0 && (
            <button
              onClick={openConfirmDialog}
              className="px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
            >
              确认拆分
            </button>
          )}
          {isConfirmed && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              已确认
            </span>
          )}
        </div>
      </div>

      {/* Chapter table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-y-auto max-h-[calc(100vh-20rem)]">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    disabled
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                  序号
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  标题
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                  字数
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-36">
                  状态
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredChapters.map((ch: ChapterMeta) => {
                const isSelected = selectedChapterId === ch.index;
                const isChecked = selectedIds.includes(ch.index);
                const anomaly = anomalyMap.get(ch.index);

                return (
                  <tr
                    key={ch.index}
                    onClick={() => selectChapter(ch.index)}
                    onDoubleClick={() => openEditor(ch.index)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50'
                        : anomaly
                          ? 'bg-yellow-50 hover:bg-yellow-100'
                          : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelect(ch.index)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {ch.index}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800 font-medium max-w-md truncate">
                      {ch.title}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 text-right">
                      {ch.charCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {anomaly ? (
                          <>
                            <AnomalyBadge
                              type={anomaly.type}
                              severity={anomaly.severity}
                              message={anomaly.message}
                              onClick={() => openAnomalyDetail(anomaly)}
                            />
                            {anomaly.type === 'oversized_chapter' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditor(ch.index, { splitOpen: true });
                                }}
                                className="text-yellow-600 hover:text-yellow-800 text-xs underline"
                                title="快速拆分此超长章节"
                              >
                                拆分
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            正常
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredChapters.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    {filter === 'anomaly'
                      ? '没有检测到异常的章节'
                      : '暂无章节数据'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
