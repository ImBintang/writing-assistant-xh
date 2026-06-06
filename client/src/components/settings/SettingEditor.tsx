// client/src/components/settings/SettingEditor.tsx
// TipTap-powered Markdown editor — orange accent page

import { useMemo } from 'react';
import { useSettings, CATEGORY_LABELS } from '../../hooks/useSettings';
import TipTapEditor from '../editor/TipTapEditor';
import { Button } from '../ui/Button';

export default function SettingEditor() {
  const currentSetting = useSettings((s) => s.currentSetting);
  const editorContent = useSettings((s) => s.editorContent);
  const saving = useSettings((s) => s.saving);
  const updateEditorContent = useSettings((s) => s.updateEditorContent);
  const saveCurrentSetting = useSettings((s) => s.saveCurrentSetting);

  const templateInfo = useMemo(() => {
    if (!currentSetting?.template) return null;
    const nameMap: Record<string, string> = { character: '角色模板', technique: '功法模板', plot: '情节模板', alchemy: '丹药模板', map: '地图模板', organization: '组织模板', other: '空模板' };
    return nameMap[currentSetting.template] || currentSetting.template;
  }, [currentSetting?.template]);

  if (!currentSetting) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          <p>选择一个设定开始编辑，或点击"新建设定"</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-orange-200 bg-orange-50">
        <div>
          <h2 className="font-semibold text-slate-800">{currentSetting.title}</h2>
          <div className="flex gap-2 mt-0.5">
            <span className="text-xs px-2 py-0.5 rounded-full border bg-white text-slate-500">{CATEGORY_LABELS[currentSetting.category] || currentSetting.category}</span>
            {templateInfo && <span className="text-xs px-2 py-0.5 rounded-full border bg-orange-100 text-orange-600">{templateInfo}</span>}
            {currentSetting.status === 'migrated' && <span className="text-xs px-2 py-0.5 rounded-full border bg-emerald-100 text-emerald-600">已迁移</span>}
          </div>
        </div>
        <Button size="sm" onClick={saveCurrentSetting} disabled={saving} isLoading={saving} className="bg-orange-500 hover:bg-orange-600 from-orange-500 to-orange-500">保存</Button>
      </div>
      <div className="flex-1 overflow-auto">
        <TipTapEditor content={editorContent} onUpdate={(_html, text) => updateEditorContent(text)} placeholder="在此编辑设定内容..." />
      </div>
    </div>
  );
}
