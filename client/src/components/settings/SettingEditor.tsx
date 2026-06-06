// client/src/components/settings/SettingEditor.tsx
// TipTap-powered Markdown editor with template selection for settings

import { useMemo } from 'react';
import { useSettings, CATEGORY_LABELS } from '../../hooks/useSettings';
import TipTapEditor from '../editor/TipTapEditor';

export default function SettingEditor() {
  const currentSetting = useSettings((s) => s.currentSetting);
  const editorContent = useSettings((s) => s.editorContent);
  const saving = useSettings((s) => s.saving);
  const updateEditorContent = useSettings((s) => s.updateEditorContent);
  const saveCurrentSetting = useSettings((s) => s.saveCurrentSetting);

  const templateInfo = useMemo(() => {
    if (!currentSetting?.template) return null;
    const nameMap: Record<string, string> = {
      character: '角色模板',
      technique: '功法模板',
      plot: '情节模板',
      alchemy: '丹药模板',
      map: '地图模板',
      organization: '组织模板',
      other: '空模板',
    };
    return nameMap[currentSetting.template] || currentSetting.template;
  }, [currentSetting?.template]);

  if (!currentSetting) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <svg
            className="w-16 h-16 mx-auto mb-3 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          <p>选择一个设定开始编辑，或点击"新建设定"</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-orange-200 bg-orange-50 rounded-t-lg">
        <div>
          <h2 className="font-semibold text-gray-800">{currentSetting.title}</h2>
          <div className="flex gap-2 mt-0.5">
            <span className="text-xs px-2 py-0.5 rounded-full border bg-white text-gray-500">
              {CATEGORY_LABELS[currentSetting.category] || currentSetting.category}
            </span>
            {templateInfo && (
              <span className="text-xs px-2 py-0.5 rounded-full border bg-orange-100 text-orange-600">
                {templateInfo}
              </span>
            )}
            {currentSetting.status === 'migrated' && (
              <span className="text-xs px-2 py-0.5 rounded-full border bg-green-100 text-green-600">
                已迁移
              </span>
            )}
          </div>
        </div>
        <button
          onClick={saveCurrentSetting}
          disabled={saving}
          className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors ${
            saving
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-orange-500 text-white hover:bg-orange-600'
          }`}
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-auto">
        <TipTapEditor
          content={editorContent}
          onUpdate={(_html, text) => updateEditorContent(text)}
          placeholder="在此编辑设定内容..."
        />
      </div>
    </div>
  );
}
