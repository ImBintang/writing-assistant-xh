// client/src/pages/Settings.tsx
// Setting Conception page — category sidebar + editor + reference panel

import { useEffect, useState } from 'react';
import { useSettings, CATEGORY_LABELS, CATEGORY_COLORS } from '../hooks/useSettings';
import SettingEditor from '../components/settings/SettingEditor';
import ReferencePanel from '../components/settings/ReferencePanel';
import MigrateDialog from '../components/settings/MigrateDialog';
import { Modal } from '../components/ui/Modal';
import { Input, Select } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

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

  const templateOptions = [
    { value: '', label: '不使用模板' },
    { value: 'character', label: '角色模板' },
    { value: 'technique', label: '功法模板' },
    { value: 'plot', label: '情节模板' },
    { value: 'alchemy', label: '丹药模板' },
    { value: 'map', label: '地图模板' },
    { value: 'organization', label: '组织模板' },
    { value: 'other', label: '空白模板' },
  ];

  return (
    <div className="flex h-full" style={{ minHeight: 'calc(100vh - 56px)' }}>
      {/* Left sidebar — categories */}
      <div className="w-48 border-r border-slate-200 flex flex-col bg-slate-50">
        <div className="p-3 border-b border-slate-200 space-y-2">
          <Button
            onClick={() => {
              setActiveCategory(activeCategory || 'other');
              setShowNewDialog(true);
            }}
            className="w-full bg-orange-500 hover:bg-orange-600 from-orange-500 to-orange-500"
          >
            ＋ 新建设定
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              if (filteredSettings.length > 0) {
                const first = filteredSettings[0];
                selectSetting(first);
              }
            }}
            disabled={filteredSettings.length === 0}
            className="w-full"
            title="打开最近一个已选分类中的设定"
          >
            📂 打开已有
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-2 space-y-0.5">
          <button
            onClick={() => setActiveCategory(null)}
            className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors ${
              activeCategory === null
                ? 'bg-orange-100 text-orange-700 font-medium'
                : 'text-slate-600 hover:bg-slate-100'
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
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>
                  {icon} {CATEGORY_LABELS[key] || key}
                </span>
                {count > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-500">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Migration button */}
        <div className="p-3 border-t border-slate-200">
          <button
            onClick={handleMigrate}
            disabled={selectedSettingIds.length === 0}
            className={`w-full px-3 py-2 text-xs rounded-btn font-medium transition-colors ${
              selectedSettingIds.length === 0
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-500 text-white hover:bg-emerald-600'
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
        <div className="px-4 py-2 bg-orange-50 border-b-2 border-orange-300 text-xs font-semibold text-orange-700 flex items-center gap-2">
          <span>⚠</span>
          <span>以下设定尚未在正文章节中出现，不会影响知识库</span>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <SettingEditor />
          <ReferencePanel />
        </div>

        {/* Bottom archive bar */}
        <div className="border-t border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-xs text-slate-400 flex-shrink-0">存档:</span>
            {settingsLoading ? (
              <span className="text-xs text-slate-400">加载中...</span>
            ) : filteredSettings.length === 0 ? (
              <span className="text-xs text-slate-400">暂无设定</span>
            ) : (
              filteredSettings.map((setting) => (
                <button
                  key={setting.id}
                  onClick={() => {
                    selectSetting(setting);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    toggleSelectForMigration(setting.id);
                  }}
                  className={`flex-shrink-0 px-2.5 py-1 text-xs rounded-lg border transition-colors truncate max-w-[200px] ${
                    currentSetting?.id === setting.id
                      ? CATEGORY_COLORS[setting.category] || 'bg-slate-100 border-slate-300'
                      : selectedSettingIds.includes(setting.id)
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                  title={`${setting.title} (${setting.status === 'migrated' ? '已迁移' : '草稿'})\n右键选择用于迁移`}
                >
                  {setting.status === 'migrated' && '✅ '}
                  {setting.title}
                </button>
              ))
            )}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            💡 右键点击设定可选择用于迁移 | 已选 {selectedSettingIds.length} 个
          </div>
        </div>
      </div>

      {/* New setting dialog */}
      <Modal
        open={showNewDialog}
        onClose={() => setShowNewDialog(false)}
        title="新建设定"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowNewDialog(false)}>
              取消
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newTitle.trim()}
              className="bg-orange-500 hover:bg-orange-600 from-orange-500 to-orange-500"
            >
              创建
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="标题"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="设定标题"
          />
          <Select
            label="模板（可选）"
            value={newTemplate}
            onChange={(e) => setNewTemplate(e.target.value)}
            options={templateOptions}
          />
        </div>
      </Modal>

      {/* Migration dialog */}
      <MigrateDialog />
    </div>
  );
}
