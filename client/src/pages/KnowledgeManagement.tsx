// client/src/pages/KnowledgeManagement.tsx
// Knowledge management page — browse, search, manage entries

import { useEffect, useState, useCallback } from 'react';
import { useKnowledgeManagement } from '../hooks/useKnowledgeManagement';
import KnowledgeList from '../components/knowledge/KnowledgeList';
import KnowledgeDetail from '../components/knowledge/KnowledgeDetail';
import ChangeBanner from '../components/knowledge/ChangeBanner';
import TrashPanel from '../components/knowledge/TrashPanel';
import { Card } from '../components/ui/Card';
import { Input, Select } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import type { KnowledgeEntry } from '../services/knowledge';

const CATEGORY_NAMES: Record<string, string> = {
  characters: '人物',
  techniques: '功法',
  locations: '地图',
  worldbuilding: '世界观',
  weapons: '武器',
  alchemy: '丹药',
  plot: '情节',
};

export default function KnowledgeManagementPage() {
  const {
    entries,
    totalEntries,
    page,
    totalPages,
    selectedCategory,
    viewMode,
    sortBy,
    searchQuery,
    categoryCounts,
    loading,
    saving,
    selectedEntry,
    detailOpen,
    editOpen,
    createOpen,
    trashOpen,
    recentChanges,
    changesLoading,
    exporting,
    importing,
    importResult,
    loadEntries,
    loadEntry,
    createEntry,
    updateEntry,
    deleteEntry,
    loadCategories,
    searchEntries,
    loadRecentChanges,
    doExport,
    doImport,
    setCategory,
    setViewMode,
    setSortBy,
    setSearchQuery,
    setPage,
    openDetail,
    closeDetail,
    openEdit,
    closeEdit,
    openCreate,
    closeCreate,
    openTrash,
    closeTrash,
  } = useKnowledgeManagement();

  // Edit/create form state
  const [editForm, setEditForm] = useState<{
    name: string;
    category: string;
    aliases: string;
    description: string;
    attributes: string;
  }>({ name: '', category: 'characters', aliases: '', description: '', attributes: '' });

  // Confirmation dialog state
  const [confirmDelete, setConfirmDelete] = useState<KnowledgeEntry | null>(null);
  const [showImportResult, setShowImportResult] = useState(false);
  const [showChangeBanner, setShowChangeBanner] = useState(true);

  useEffect(() => {
    loadEntries();
    loadCategories();
    loadRecentChanges();
  }, []);

  const handleSearch = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        searchEntries(searchQuery, selectedCategory || undefined);
      }
    },
    [searchQuery, selectedCategory, searchEntries],
  );

  const handleClearSearch = () => {
    setSearchQuery('');
    loadEntries(selectedCategory);
  };

  const handleEntryClick = (entry: KnowledgeEntry) => {
    openDetail(entry);
  };

  const handleEditOpen = (entry?: KnowledgeEntry) => {
    const target = entry || selectedEntry || undefined;
    setEditForm({
      name: target?.name || '',
      category: target?.category || 'characters',
      aliases: (target?.aliases || []).join('、'),
      description: target?.description || '',
      attributes: target?.attributes
        ? Object.entries(target.attributes)
            .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
            .join('\n')
        : '',
    });
    openEdit(entry);
  };

  const handleCreateOpen = () => {
    setEditForm({ name: '', category: 'characters', aliases: '', description: '', attributes: '' });
    openCreate();
  };

  const handleSave = async () => {
    const attrs: Record<string, unknown> = {};
    if (editForm.attributes.trim()) {
      editForm.attributes.split('\n').forEach((line) => {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const key = line.slice(0, colonIdx).trim();
          let value: unknown = line.slice(colonIdx + 1).trim();
          try {
            value = JSON.parse(value as string);
          } catch { /* keep as string */ }
          attrs[key] = value;
        }
      });
    }

    const aliases = editForm.aliases
      .split(/[,，、]/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (createOpen) {
      await createEntry({
        name: editForm.name,
        category: editForm.category,
        aliases,
        description: editForm.description,
        attributes: attrs,
      });
    } else if (editOpen && selectedEntry) {
      await updateEntry(selectedEntry.id, {
        name: editForm.name,
        category: editForm.category,
        aliases,
        description: editForm.description,
        attributes: attrs,
        editorNote: '手动编辑',
      });
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteEntry(confirmDelete.id);
    setConfirmDelete(null);
    closeDetail();
  };

  const handleExport = () => doExport();
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await doImport(file);
    setShowImportResult(true);
    e.target.value = '';
  };

  const total = totalEntries;
  const startEntry = (page - 1) * 20 + 1;
  const endEntry = Math.min(page * 20, total);

  const sortOptions = [
    { value: 'updatedAt', label: '最近更新' },
    { value: 'name', label: '名称排序' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex gap-6 h-full">
      {/* Left sidebar — categories */}
      <aside className="w-48 flex-shrink-0">
        <Card padding="sm" className="sticky top-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">分类</h3>
          <ul className="space-y-1">
            <li>
              <button
                onClick={() => setCategory(null)}
                className={`w-full text-left px-2 py-1.5 text-sm rounded transition-colors ${
                  selectedCategory === null
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                全部 ({Object.values(categoryCounts).reduce((a, b) => a + b, 0)})
              </button>
            </li>
            {Object.entries(CATEGORY_NAMES).map(([key, name]) => (
              <li key={key}>
                <button
                  onClick={() => setCategory(key)}
                  className={`w-full text-left px-2 py-1.5 text-sm rounded transition-colors ${
                    selectedCategory === key
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {name}
                  <span className="text-xs text-slate-400 ml-1">
                    ({categoryCounts[key] || 0})
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <hr className="my-3 border-slate-200" />
          <button
            onClick={openTrash}
            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            回收站
          </button>
        </Card>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Change banner */}
        <ChangeBanner
          changes={recentChanges}
          loading={changesLoading}
          visible={showChangeBanner}
          onEntryClick={(id) => {
            loadEntry(id).then(() => {
              const entry = useKnowledgeManagement.getState().selectedEntry;
              if (entry) openDetail(entry);
            });
          }}
          onRefresh={loadRecentChanges}
          onDismiss={() => setShowChangeBanner(false)}
        />

        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-4">
          {/* Search */}
          <div className="flex-1 relative">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
                placeholder="搜索条目名称、别名..."
                className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-input bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow duration-standard"
              />
              <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                &times;
              </button>
            )}
          </div>

          {/* Sort */}
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'updatedAt')}
            options={sortOptions}
            className="!w-auto"
          />

          {/* View toggle */}
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('card')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === 'card' ? 'bg-white shadow text-slate-800' : 'text-slate-500'
              }`}
            >
              卡片
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === 'table' ? 'bg-white shadow text-slate-800' : 'text-slate-500'
              }`}
            >
              表格
            </button>
          </div>

          {/* Actions */}
          <Button onClick={handleCreateOpen} size="sm">
            + 新建
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? '导出中...' : '导出'}
          </Button>
          <label className="px-3 py-1.5 text-sm border border-slate-200 text-slate-600 rounded-btn hover:bg-slate-50 transition-all duration-standard cursor-pointer font-medium">
            {importing ? '导入中...' : '导入'}
            <input type="file" accept=".zip" onChange={handleImport} className="hidden" />
          </label>
        </div>

        {/* Import result toast */}
        {showImportResult && importResult && (
          <Card padding="sm" className="mb-4 border-emerald-200 bg-emerald-50 flex items-center justify-between">
            <div className="text-sm text-emerald-800">
              导入完成：{importResult.imported} 个成功
              {importResult.skipped > 0 && `，${importResult.skipped} 个跳过`}
              {importResult.errors.length > 0 && `，${importResult.errors.length} 个错误`}
            </div>
            <button
              onClick={() => setShowImportResult(false)}
              className="text-sm text-emerald-600 hover:text-emerald-800"
            >
              关闭
            </button>
          </Card>
        )}

        {/* Entries count */}
        <div className="text-sm text-slate-500 mb-3">
          {total > 0 ? `显示 ${startEntry}-${endEntry} / 共 ${total} 个条目` : ''}
        </div>

        {/* Entry list */}
        <KnowledgeList
          entries={entries}
          loading={loading}
          viewMode={viewMode}
          onEntryClick={handleEntryClick}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
            >
              上一页
            </Button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (page <= 4) {
                pageNum = i + 1;
              } else if (page >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = page - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-8 h-8 text-sm rounded transition-colors ${
                    page === pageNum
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-btn'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
            >
              下一页
            </Button>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {detailOpen && selectedEntry && (
        <KnowledgeDetail
          entry={selectedEntry}
          onClose={closeDetail}
          onEdit={() => handleEditOpen()}
          onDelete={() => setConfirmDelete(selectedEntry)}
        />
      )}

      {/* Edit / Create Modal */}
      {(editOpen || createOpen) && (
        <EditCreateModal
          isCreate={createOpen}
          form={editForm}
          saving={saving}
          onChange={(updates) => setEditForm((prev) => ({ ...prev, ...updates }))}
          onSave={handleSave}
          onClose={() => {
            closeEdit();
            closeCreate();
          }}
        />
      )}

      {/* Delete Confirmation */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="确认删除"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
              取消
            </Button>
            <Button variant="danger" onClick={handleDelete} className="bg-red-600 text-white hover:bg-red-700 border-red-600">
              删除
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          确定要删除条目「{confirmDelete?.name}」吗？它将移至回收站，您可以稍后恢复。
        </p>
      </Modal>

      {/* Trash Panel */}
      {trashOpen && <TrashPanel onClose={closeTrash} />}
    </div>
  );
}

// ---- Edit/Create Modal (using shared Modal) ----
function EditCreateModal({
  isCreate,
  form,
  saving,
  onChange,
  onSave,
  onClose,
}: {
  isCreate: boolean;
  form: { name: string; category: string; aliases: string; description: string; attributes: string };
  saving: boolean;
  onChange: (updates: Partial<typeof form>) => void;
  onSave: () => Promise<void>;
  onClose: () => void;
}) {
  const categoryOptions = Object.entries(CATEGORY_NAMES).map(([key, name]) => ({
    value: key,
    label: name,
  }));

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={isCreate ? '新建条目' : '编辑条目'}
      size="xl"
      position="top"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={onSave}
            disabled={saving || !form.name.trim()}
            isLoading={saving}
          >
            保存
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="名称 *"
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <Select
          label="分类 *"
          value={form.category}
          onChange={(e) => onChange({ category: e.target.value })}
          options={categoryOptions}
        />
        <Input
          label="别名（用逗号分隔）"
          value={form.aliases}
          onChange={(e) => onChange({ aliases: e.target.value })}
          placeholder="如：林少侠, 林小子"
        />
        <Input
          label="描述"
          value={form.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
        <Input
          label="属性（每行格式：key: value）"
          value={form.attributes}
          onChange={(e) => onChange({ attributes: e.target.value })}
          placeholder="age: 25\ngender: 男\nlevel: 元婴期"
        />
      </div>
    </Modal>
  );
}
