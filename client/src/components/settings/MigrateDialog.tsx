// client/src/components/settings/MigrateDialog.tsx
// Migration preview modal — orange accent

import { useState } from 'react';
import { useSettings, CATEGORY_LABELS } from '../../hooks/useSettings';
import { Modal } from '../ui/Modal';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import type { MigrationItem } from '../../services/settings';

export default function MigrateDialog() {
  const showMigrateDialog = useSettings((s) => s.showMigrateDialog);
  const toggleMigrateDialog = useSettings((s) => s.toggleMigrateDialog);
  const migrationPreview = useSettings((s) => s.migrationPreview);
  const migrationLoading = useSettings((s) => s.migrationLoading);
  const confirmMigration = useSettings((s) => s.confirmMigration);

  const [resolvedConflicts, setResolvedConflicts] = useState<Array<{ settingId: string; field: string; resolution: 'accept_new' | 'keep_old' }>>([]);

  const handleResolution = (settingId: string, field: string, resolution: 'accept_new' | 'keep_old') => {
    setResolvedConflicts((prev) => { const filtered = prev.filter((r) => !(r.settingId === settingId && r.field === field)); return [...filtered, { settingId, field, resolution }]; });
  };
  const getResolution = (settingId: string, field: string): string | null => resolvedConflicts.find((r) => r.settingId === settingId && r.field === field)?.resolution || null;
  const handleConfirm = async () => { await confirmMigration(resolvedConflicts); };

  if (!showMigrateDialog || !migrationPreview) return null;

  return (
    <Modal open={true} onClose={toggleMigrateDialog} title="📦 迁移预览" size="2xl" footer={<>
      <Button variant="secondary" onClick={toggleMigrateDialog}>取消</Button>
      <Button onClick={handleConfirm} disabled={migrationLoading} isLoading={migrationLoading} className="bg-orange-500 hover:bg-orange-600 from-orange-500 to-orange-500">确认迁移</Button>
    </>}>
      <div className="flex gap-4 mb-4">
        <Badge variant="success">新建 {migrationPreview.summary.willCreate} 个</Badge>
        <Badge variant="info">合并 {migrationPreview.summary.willMerge} 个</Badge>
        {migrationPreview.summary.totalConflicts > 0 && <Badge variant="error">{migrationPreview.summary.totalConflicts} 个冲突</Badge>}
      </div>
      <div className="space-y-4">
        {migrationPreview.items.map((item: MigrationItem) => (
          <Card key={item.settingId} padding="md">
            <div className="flex items-center justify-between mb-2">
              <div><h4 className="font-medium text-slate-800">{item.settingTitle}</h4><span className="text-xs text-slate-400">{CATEGORY_LABELS[item.category] || item.category}</span></div>
              {item.action === 'create' ? <Badge variant="success">新建条目</Badge> : <Badge variant="info">合并到 {item.matchedEntryName}{item.similarity !== undefined && ` (${(item.similarity * 100).toFixed(0)}% 匹配)`}</Badge>}
            </div>
            {item.extractedFields.length > 0 && (
              <div className="mb-2"><p className="text-xs text-slate-500 mb-1">提取的字段:</p>
                <div className="flex flex-wrap gap-1">{item.extractedFields.map((f) => (<span key={f.field} className="text-xs px-1.5 py-0.5 bg-slate-50 text-slate-600 rounded border border-slate-150 truncate max-w-[200px]" title={`${f.field}: ${String(f.value)}`}>{f.field}: {String(f.value).slice(0, 40)}</span>))}</div>
              </div>
            )}
            {item.conflicts.length > 0 && (
              <div>
                <p className="text-xs font-medium text-red-600 mb-1.5">⚠ 冲突 ({item.conflicts.length})</p>
                {item.conflicts.map((conflict) => {
                  const resolution = getResolution(item.settingId, conflict.field);
                  return (
                    <div key={conflict.field} className="border border-red-100 rounded-card p-2.5 mb-1.5 bg-red-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-xs font-medium text-slate-700">{conflict.field}</p>
                          <div className="text-xs text-slate-500 mt-0.5 space-y-0.5"><p>现有: <span className="text-slate-700">{String(conflict.existingValue).slice(0, 80)}</span></p><p>新增: <span className="text-slate-700">{String(conflict.incomingValue).slice(0, 80)}</span></p></div>
                        </div>
                        <div className="flex gap-1 ml-3">
                          <button onClick={() => handleResolution(item.settingId, conflict.field, 'accept_new')} className={`px-2 py-1 text-xs rounded-btn transition-colors ${resolution === 'accept_new' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'}`}>接受新值</button>
                          <button onClick={() => handleResolution(item.settingId, conflict.field, 'keep_old')} className={`px-2 py-1 text-xs rounded-btn transition-colors ${resolution === 'keep_old' ? 'bg-slate-500 text-white' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'}`}>保留旧值</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        ))}
      </div>
    </Modal>
  );
}
