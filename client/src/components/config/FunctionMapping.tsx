// client/src/components/config/FunctionMapping.tsx
// Function-to-model mapping — Corporate Trust styled

import { useConfig, FUNCTION_LABELS } from '../../hooks/useConfig';
import { Select } from '../ui/Input';
import type { ModelPreset } from '../../services/config';

export default function FunctionMapping() {
  const { models, functionMapping, saving, saveFunctionMapping } = useConfig();

  const handleChange = async (func: string, modelId: string) => {
    const newMapping = { ...functionMapping, [func]: modelId };
    await saveFunctionMapping(newMapping);
  };

  const getModelName = (presetId: string): string => {
    const preset = models.find((m: ModelPreset) => m.id === presetId);
    return preset ? preset.name : presetId;
  };

  const modelOptions = [{ value: '', label: '选择模型...', disabled: true }, ...models.map((m: ModelPreset) => ({ value: m.id, label: `${m.name} (${m.provider})` }))];

  return (
    <div className="space-y-4">
      <h3 className="text-section font-bold text-slate-900">功能-模型绑定</h3>
      <p className="text-sm text-slate-500">为不同功能选择使用的 AI 模型。知识提取等复杂任务建议使用能力更强的模型。</p>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase w-1/3">功能</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">使用模型</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">当前模型</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {Object.entries(FUNCTION_LABELS).map(([func, label]) => (
              <tr key={func} className="hover:bg-slate-50">
                <td className="px-4 py-2 text-sm font-medium text-slate-800">{label}</td>
                <td className="px-4 py-2">
                  <Select value={functionMapping[func] || ''} onChange={(e) => handleChange(func, e.target.value)} disabled={saving} options={modelOptions} className="!w-auto max-w-xs" />
                </td>
                <td className="px-4 py-2 text-sm text-slate-500">{functionMapping[func] ? getModelName(functionMapping[func]) : '未设置'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {saving && <p className="text-sm text-indigo-600">保存中...</p>}
    </div>
  );
}
