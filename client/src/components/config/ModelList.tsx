// client/src/components/config/ModelList.tsx
// Model list component showing all presets (built-in + custom)
// with test connection and delete functionality.

import { useState } from 'react';
import { useConfig, PROVIDER_LABELS } from '../../hooks/useConfig';
import type { ModelPreset } from '../../services/config';

interface NewModelForm {
  id: string;
  name: string;
  provider: ModelPreset['provider'];
  modelId: string;
  apiKeyEnv: string;
  baseUrl: string;
  description: string;
}

const EMPTY_FORM: NewModelForm = {
  id: '',
  name: '',
  provider: 'claude',
  modelId: '',
  apiKeyEnv: '',
  baseUrl: '',
  description: '',
};

export default function ModelList() {
  const {
    models,
    testingModelId,
    testResult,
    showAddModelForm,
    saving,
    addModel,
    deleteModel,
    testModelConnection,
    setShowAddModelForm,
    clearMessages,
  } = useConfig();

  const [form, setForm] = useState<NewModelForm>(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!form.id || !form.name || !form.modelId || !form.apiKeyEnv) return;
    await addModel({
      id: form.id,
      name: form.name,
      provider: form.provider,
      modelId: form.modelId,
      apiKeyEnv: form.apiKeyEnv,
      baseUrl: form.baseUrl || undefined,
      description: form.description || undefined,
    });
    setForm(EMPTY_FORM);
  };

  const handleDelete = async (id: string) => {
    await deleteModel(id);
    setDeleteConfirm(null);
  };

  const isBuiltIn = (preset: ModelPreset) => {
    // Built-in presets have IDs like 'claude-opus', 'claude-sonnet', 'gpt-4o', 'ollama-local'
    const builtInIds = ['claude-opus', 'claude-sonnet', 'gpt-4o', 'ollama-local'];
    return builtInIds.includes(preset.id);
  };

  const getProviderBadgeClass = (provider: string) => {
    switch (provider) {
      case 'claude':
        return 'bg-purple-100 text-purple-700';
      case 'openai':
        return 'bg-green-100 text-green-700';
      case 'ollama':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">模型列表</h3>
        <button
          onClick={() => {
            setShowAddModelForm(!showAddModelForm);
            clearMessages();
          }}
          className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          {showAddModelForm ? '取消' : '+ 添加模型'}
        </button>
      </div>

      {/* Add model form */}
      {showAddModelForm && (
        <div className="border border-indigo-200 rounded-lg p-4 bg-indigo-50 space-y-3">
          <h4 className="font-medium text-indigo-800">添加自定义模型</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">ID (唯一标识)</label>
              <input
                type="text"
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                placeholder="my-custom-model"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">显示名称</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                placeholder="My Custom Model"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">提供商</label>
              <select
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value as ModelPreset['provider'] })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
              >
                <option value="claude">Claude (Anthropic)</option>
                <option value="openai">OpenAI</option>
                <option value="ollama">Ollama</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">模型 ID</label>
              <input
                type="text"
                value={form.modelId}
                onChange={(e) => setForm({ ...form, modelId: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                placeholder="gpt-4o"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">API Key 环境变量名</label>
              <input
                type="text"
                value={form.apiKeyEnv}
                onChange={(e) => setForm({ ...form, apiKeyEnv: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                placeholder="OPENAI_API_KEY"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Base URL (可选)</label>
              <input
                type="text"
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                placeholder="http://localhost:11434"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-600 mb-1">描述</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                placeholder="模型描述..."
              />
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={saving || !form.id || !form.name || !form.modelId}
            className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? '添加中...' : '确认添加'}
          </button>
        </div>
      )}

      {/* Test result banner */}
      {testResult && (
        <div
          className={`px-4 py-2 rounded-lg text-sm ${
            testResult.success
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {testResult.message}
          {testResult.latencyMs && (
            <span className="ml-2 text-gray-500">(延迟: {testResult.latencyMs}ms)</span>
          )}
        </div>
      )}

      {/* Model table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">名称</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">提供商</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">模型 ID</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">描述</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {models.map((preset) => (
              <tr key={preset.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-sm font-medium text-gray-800">{preset.name}</td>
                <td className="px-4 py-2">
                  <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${getProviderBadgeClass(preset.provider)}`}>
                    {PROVIDER_LABELS[preset.provider] || preset.provider}
                  </span>
                </td>
                <td className="px-4 py-2 text-sm text-gray-600 font-mono">{preset.modelId}</td>
                <td className="px-4 py-2 text-sm text-gray-500">{preset.description || '-'}</td>
                <td className="px-4 py-2">
                  <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                    isBuiltIn(preset) ? 'bg-gray-100 text-gray-600' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {isBuiltIn(preset) ? '内置' : '自定义'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right space-x-2">
                  <button
                    onClick={() => testModelConnection(preset.id)}
                    disabled={testingModelId === preset.id}
                    className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 transition-colors"
                  >
                    {testingModelId === preset.id ? '测试中...' : '测试连接'}
                  </button>
                  {!isBuiltIn(preset) && (
                    deleteConfirm === preset.id ? (
                      <span className="text-xs">
                        <button
                          onClick={() => handleDelete(preset.id)}
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          确认
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="ml-1 px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                        >
                          取消
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(preset.id)}
                        className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        删除
                      </button>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {models.length === 0 && !showAddModelForm && (
        <p className="text-center text-gray-500 py-8">暂无模型预设</p>
      )}
    </div>
  );
}
