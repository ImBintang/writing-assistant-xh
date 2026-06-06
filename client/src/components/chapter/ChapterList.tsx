import { useState } from 'react';
import { useChapters } from '../../hooks/useChapters';
import AnomalyBadge from './AnomalyBadge';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
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
    selectedIds.every((id, i) => i === 0 || id === selectedIds[i - 1] + 1);

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
      <div className="text-center py-12 text-slate-400">
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
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filter === 'all'
                  ? 'bg-white shadow text-slate-800 font-medium'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setFilter('anomaly')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filter === 'anomaly'
                  ? 'bg-white shadow text-slate-800 font-medium'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              仅异常
              {anomalies.length > 0 && (
                <Badge variant="warning" className="ml-1 py-0 px-1.5 text-[10px]">
                  {anomalies.length}
                </Badge>
              )}
            </button>
          </div>

          {/* Actions */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={canMerge ? openMergeModal : undefined}
                disabled={!canMerge}
                className={canMerge ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100' : ''}
                title={!canMerge ? '请选择连续的章节进行合并' : '合并选中章节'}
              >
                合并 ({selectedIds.length})
              </Button>
              <button
                onClick={clearSelection}
                className="px-3 py-1 text-sm text-slate-500 hover:text-slate-700"
              >
                取消选择
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {!isConfirmed && chapters.length > 0 && (
            <Button onClick={openConfirmDialog} size="sm">
              确认拆分
            </Button>
          )}
          {isConfirmed && <Badge variant="success">已确认</Badge>}
        </div>
      </div>

      {/* Chapter table */}
      <div className="bg-white border border-slate-200 rounded-card overflow-hidden">
        <div className="overflow-y-auto max-h-[calc(100vh-20rem)]">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" className="rounded border-slate-300" disabled />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-20">
                  序号
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  标题
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-24">
                  字数
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider w-36">
                  状态
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
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
                        ? 'bg-indigo-50/70'
                        : anomaly
                          ? 'bg-amber-50 hover:bg-amber-100'
                          : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelect(ch.index)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{ch.index}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 font-medium max-w-md truncate">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditor(ch.index);
                        }}
                        className="hover:text-indigo-600 transition-colors"
                        title="点击编辑标题"
                      >
                        {ch.title}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 text-right">
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
                                className="text-amber-600 hover:text-amber-800 text-xs underline"
                                title="快速拆分此超长章节"
                              >
                                拆分
                              </button>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Badge variant="success">正常</Badge>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditor(ch.index, { splitOpen: true });
                              }}
                              className="text-amber-600 hover:text-amber-800 text-xs underline"
                              title="拆分此章节"
                            >
                              拆分
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredChapters.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    {filter === 'anomaly' ? '没有检测到异常的章节' : '暂无章节数据'}
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
