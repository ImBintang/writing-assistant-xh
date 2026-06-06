// client/src/pages/Settings.tsx
// Setting Conception page (PRD-06)
// Layout: category sidebar + editor + reference panel + bottom archive

import { useEffect, useState } from 'react';
import { useSettings, CATEGORY_LABELS, CATEGORY_COLORS } from '../hooks/useSettings';
import SettingEditor from '../components/settings/SettingEditor';
import ReferencePanel from '../components/settings/ReferencePanel';
import MigrateDialog from '../components/settings/MigrateDialog';

const CATEGORIES = [
  { key: 'characters', icon: '👤' },
  { key: 'techniques', icon: '⚔️' },
  { key: 'plot', icon: '📖' },
  { key: 'alchemy', icon: '🧪' },
  { key: 'map', icon: '🗺️' },
  { key: 'organization', icon: '🏛️' },
  { key: 'other', icon: '📋' },
];

export default function SettingsPage() {
  const settings = useSettings((s) => s.settings);
  const settingsLoading = useSettings((s) => s.settingsLoading);
  const currentSetting = useSettings((s) => s.currentSetting);
  const selectedSettingIds = useSettings((s) => s.selectedSettingIds);
  const loadSettings = useSettings((s) => s.loadSettings);
  const selectSetting = useSettings((s) => s.selectSetting);
  const createSetting = useSettings((s) => s.createSetting);
  const previewMigration = useSettings((s) => s.previewMigration);
  const toggleSelectForMigration = useSettings((s) => s.toggleSelectForMigration);

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTemplate, setNewTemplate] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const filteredSettings = activeCategory
    ? settings.filter((s) => s.category === activeCategory)
    : settings;

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    const category = activeCategory || 'other';
    await createSetting({
      title: newTitle.trim(),
      category,
      template: newTemplate || undefined,
    });
    setShowNewDialog(false);
    setNewTitle('');
    setNewTemplate('');
  };

  const handleMigrate = () => {
    if (selectedSettingIds.length > 0) {
      previewMigration(selectedSettingIds);
    }
  };

  return (
    <div className="flex h-full" style={{ minHeight: 'calc(100vh - 140px)' }}>
      {/* Left sidebar — categories */}
      <div className="w-48 border-r border-gray-200 flex flex-col bg-gray-50">
        <div className="p-3 border-b border-gray-200">
          <button
            onClick={() => {
              setActiveCategory(activeCategory || 'other');
              setShowNewDialog(true);
            }}
            className="w-full px-3 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
          >
            ＋ 新建设定
          </button>
        </div>

        <div className="flex-1 overflow-auto p-2 space-y-0.5">
          <button
            onClick={() => setActiveCategory(null)}
            className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors ${
              activeCategory === null
                ? 'bg-orange-100 text-orange-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            📂 全部 ({settings.length})
          </button>
          {CATEGORIES.map(({ key, icon }) => {
            const count = settings.filter((s) => s.category === key).length;
            return (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors flex items-center justify-between ${
                  activeCategory === key
                    ? 'bg-orange-100 text-orange-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span>
                  {icon} {CATEGORY_LABELS[key] || key}
                </span>
                {count > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-500">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Migration button */}
        <div className="p-3 border-t border-gray-200">
          <button
            onClick={handleMigrate}
            disabled={selectedSettingIds.length === 0}
            className={`w-full px-3 py-2 text-xs rounded-lg font-medium transition-colors ${
              selectedSettingIds.length === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
          >
            📦 迁移到知识库
            {selectedSettingIds.length > 0 && ` (${selectedSettingIds.length})`}
          </button>
        </div>
      </div>

      {/* Main editor area */}
      <div className="flex-1 flex flex-col">
        {/* Warning banner */}
        <div className="px-4 py-2 bg-orange-50 border-b border-orange-200 text-xs text-orange-600 flex items-center gap-2">
          <span>⚠</span>
          <span>以下设定尚未在正文章节中出现，不会影响知识库</span>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <SettingEditor />
          <ReferencePanel />
        </div>

        {/* Bottom archive bar */}
        <div className="border-t border-gray-200 bg-gray-50 px-3 py-2">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-xs text-gray-400 flex-shrink-0">存档:</span>
            {settingsLoading ? (
              <span className="text-xs text-gray-400">加载中...</span>
            ) : filteredSettings.length === 0 ? (
              <span className="text-xs text-gray-400">暂无设定</span>
            ) : (
              filteredSettings.map((setting) => (
                <button
                  key={setting.id}
                  onClick={() => {
                    selectSetting(setting);
                    // Also toggle selection for migration with Ctrl/Meta click
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    toggleSelectForMigration(setting.id);
                  }}
                  className={`flex-shrink-0 px-2.5 py-1 text-xs rounded-lg border transition-colors truncate max-w-[200px] ${
                    currentSetting?.id === setting.id
                      ? CATEGORY_COLORS[setting.category] || 'bg-gray-100 border-gray-300'
                      : selectedSettingIds.includes(setting.id)
                        ? 'bg-green-50 border-green-300 text-green-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                  title={`${setting.title} (${setting.status === 'migrated' ? '已迁移' : '草稿'})\n右键选择用于迁移`}
                >
                  {setting.status === 'migrated' && '✅ '}
                  {setting.title}
                </button>
              ))
            )}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            💡 右键点击设定可选择用于迁移 | 已选 {selectedSettingIds.length} 个
          </div>
        </div>
      </div>

      {/* New setting dialog */}
      {showNewDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-96 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">新建设定</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">标题</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="设定标题"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">模板（可选）</label>
                <select
                  value={newTemplate}
                  onChange={(e) => setNewTemplate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400"
                >
                  <option value="">不使用模板</option>
                  <option value="character">角色模板</option>
                  <option value="technique">功法模板</option>
                  <option value="plot">情节模板</option>
                  <option value="alchemy">丹药模板</option>
                  <option value="map">地图模板</option>
                  <option value="organization">组织模板</option>
                  <option value="other">空白模板</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setShowNewDialog(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim()}
                className={`px-4 py-2 text-sm rounded-lg font-medium text-white transition-colors ${
                  newTitle.trim()
                    ? 'bg-orange-500 hover:bg-orange-600'
                    : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Migration dialog */}
      <MigrateDialog />
    </div>
  );
}
