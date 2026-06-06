// client/src/pages/KnowledgeManagement.tsx
// Knowledge management page — browse, search, manage entries (PRD-04)

import { useEffect, useState, useCallback } from 'react';
import { useKnowledgeManagement } from '../hooks/useKnowledgeManagement';
import KnowledgeList from '../components/knowledge/KnowledgeList';
import KnowledgeDetail from '../components/knowledge/KnowledgeDetail';
import ChangeBanner from '../components/knowledge/ChangeBanner';
import TrashPanel from '../components/knowledge/TrashPanel';
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
          // Try to parse JSON values
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

  // Derive total for display
  const total = totalEntries;
  const startEntry = (page - 1) * 20 + 1;
  const endEntry = Math.min(page * 20, total);

  return (
    <div className="flex h-full gap-6">
      {/* Left sidebar — categories */}
      <aside className="w-48 flex-shrink-0">
        <div className="bg-white rounded-lg border border-gray-200 p-3 sticky top-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">分类</h3>
          <ul className="space-y-1">
            <li>
              <button
                onClick={() => setCategory(null)}
                className={`w-full text-left px-2 py-1.5 text-sm rounded transition-colors ${
                  selectedCategory === null
                    ? 'bg-indigo-100 text-indigo-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
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
                      ? 'bg-indigo-100 text-indigo-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {name}
                  <span className="text-xs text-gray-400 ml-1">
                    ({categoryCounts[key] || 0})
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <hr className="my-3" />
          <button
            onClick={openTrash}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            回收站
          </button>
        </div>
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
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
              placeholder="搜索条目名称、别名..."
              className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                &times;
              </button>
            )}
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'updatedAt')}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="updatedAt">最近更新</option>
            <option value="name">名称排序</option>
          </select>

          {/* View toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('card')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === 'card' ? 'bg-white shadow text-gray-800' : 'text-gray-500'
              }`}
            >
              卡片
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === 'table' ? 'bg-white shadow text-gray-800' : 'text-gray-500'
              }`}
            >
              表格
            </button>
          </div>

          {/* Actions */}
          <button
            onClick={handleCreateOpen}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1"
          >
            + 新建
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {exporting ? '导出中...' : '导出'}
          </button>
          <label className="px-4 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
            {importing ? '导入中...' : '导入'}
            <input type="file" accept=".zip" onChange={handleImport} className="hidden" />
          </label>
        </div>

        {/* Import result toast */}
        {showImportResult && importResult && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
            <div className="text-sm text-green-800">
              导入完成：{importResult.imported} 个成功
              {importResult.skipped > 0 && `，${importResult.skipped} 个跳过`}
              {importResult.errors.length > 0 && `，${importResult.errors.length} 个错误`}
            </div>
            <button
              onClick={() => setShowImportResult(false)}
              className="text-sm text-green-600 hover:text-green-800"
            >
              关闭
            </button>
          </div>
        )}

        {/* Entries count */}
        <div className="text-sm text-gray-500 mb-3">
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
            <button
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一页
            </button>
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
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一页
            </button>
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
      {confirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg w-full max-w-sm p-6 mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-2">确认删除</h3>
            <p className="text-sm text-gray-600 mb-4">
              确定要删除条目「{confirmDelete.name}」吗？它将移至回收站，您可以稍后恢复。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm bg-red-600 text-white hover:bg-red-700 rounded-lg"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trash Panel */}
      {trashOpen && <TrashPanel onClose={closeTrash} />}
    </div>
  );
}

// ---- Edit/Create Modal ----
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
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 pt-16 pb-10">
      <div className="bg-white rounded-lg w-full max-w-xl mx-4 max-h-[80vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">
            {isCreate ? '新建条目' : '编辑条目'}
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">名称 *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => onChange({ name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">分类 *</label>
            <select
              value={form.category}
              onChange={(e) => onChange({ category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {Object.entries(CATEGORY_NAMES).map(([key, name]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">别名（用逗号分隔）</label>
            <input
              type="text"
              value={form.aliases}
              onChange={(e) => onChange({ aliases: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="如：林少侠, 林小子"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
            <textarea
              value={form.description}
              onChange={(e) => onChange({ description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              属性（每行格式：key: value）
            </label>
            <textarea
              value={form.attributes}
              onChange={(e) => onChange({ attributes: e.target.value })}
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="age: 25\ngender: 男\nlevel: 元婴期"
            />
          </div>
        </div>
        <div className="px-6 py-3 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            取消
          </button>
          <button
            onClick={onSave}
            disabled={saving || !form.name.trim()}
            className="px-4 py-2 text-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
