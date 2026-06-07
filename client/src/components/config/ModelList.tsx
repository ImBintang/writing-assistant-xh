// client/src/components/config/ModelList.tsx
// Model list component — Corporate Trust styled

import { useState } from 'react';
import { useConfig, PROVIDER_LABELS } from '../../hooks/useConfig';
import { Card } from '../ui/Card';
import { Input, Select } from '../ui/Input';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import type { ModelPreset } from '../../services/config';

interface NewModelForm {
  id: string; name: string; provider: ModelPreset['provider'];
  modelId: string; apiKeyEnv: string; baseUrl: string; description: string;
}
const EMPTY_FORM: NewModelForm = { id: '', name: '', provider: 'claude', modelId: '', apiKeyEnv: '', baseUrl: '', description: '' };

export default function ModelList() {
  const { config, models, testingModelId, testResult, showAddModelForm, saving, addModel, deleteModel, testModelConnection, setShowAddModelForm, clearMessages } = useConfig();
  const [form, setForm] = useState<NewModelForm>(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const apiKeyStatus = (config?.apiKeyStatus || {}) as Record<string, { configured: boolean; envVar: string; source: 'env' | 'user-config' | 'none' }>;

  // Build env var options with configuration status
  const envVarToProvider: Record<string, string> = {
    ANTHROPIC_API_KEY: 'claude',
    OPENAI_API_KEY: 'openai',
    OLLAMA_API_KEY: 'ollama',
  };
  const envVarOptions = (['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'OLLAMA_API_KEY'] as const).map((envVar) => {
    const status = apiKeyStatus[envVarToProvider[envVar]];
    const configured = status?.configured;
    const source = status?.source;
    let statusLabel = '';
    if (configured) {
      statusLabel = source === 'env' ? '（✓ 环境变量已配置）' : '（✓ 用户设置已配置）';
    } else {
      statusLabel = '（✗ 未配置）';
    }
    return { value: envVar, label: `${envVar}  ${statusLabel}` };
  });

  const handleProviderChange = (provider: ModelPreset['provider']) => {
    const envVarMap: Record<string, string> = { claude: 'ANTHROPIC_API_KEY', openai: 'OPENAI_API_KEY', ollama: 'OLLAMA_API_KEY' };
    setForm({ ...form, provider, apiKeyEnv: envVarMap[provider] || form.apiKeyEnv });
  };

  const handleAdd = async () => { if (!form.id || !form.name || !form.modelId || !form.apiKeyEnv) return; await addModel({ id: form.id, name: form.name, provider: form.provider, modelId: form.modelId, apiKeyEnv: form.apiKeyEnv, baseUrl: form.baseUrl || undefined, description: form.description || undefined }); setForm(EMPTY_FORM); };
  const handleDelete = async (id: string) => { await deleteModel(id); setDeleteConfirm(null); };

  const isBuiltIn = (preset: ModelPreset) => ['claude-opus', 'claude-sonnet', 'gpt-4o', 'ollama-local'].includes(preset.id);

  const getProviderBadgeClass = (provider: string) => {
    switch (provider) { case 'claude': return 'bg-violet-100 text-violet-700'; case 'openai': return 'bg-emerald-100 text-emerald-700'; case 'ollama': return 'bg-blue-100 text-blue-700'; default: return 'bg-slate-100 text-slate-700'; }
  };

  const providerOptions = [{ value: 'claude', label: 'Claude (Anthropic)' }, { value: 'openai', label: 'OpenAI' }, { value: 'ollama', label: 'Ollama' }];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-section font-bold text-slate-900">模型列表</h3>
        <Button size="sm" onClick={() => { setShowAddModelForm(!showAddModelForm); clearMessages(); }}>{showAddModelForm ? '取消' : '+ 添加模型'}</Button>
      </div>

      {showAddModelForm && (
        <Card variant="feature" padding="md" className="space-y-3">
          <h4 className="font-medium text-indigo-800">添加自定义模型</h4>
          <div className="grid grid-cols-2 gap-3">
            <Input label="ID (唯一标识)" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="my-custom-model" />
            <Input label="显示名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My Custom Model" />
            <Select label="提供商" value={form.provider} onChange={(e) => handleProviderChange(e.target.value as ModelPreset['provider'])} options={providerOptions} />
            <Input label="模型 ID" value={form.modelId} onChange={(e) => setForm({ ...form, modelId: e.target.value })} placeholder="gpt-4o" />
            <Select label="API Key 环境变量" value={form.apiKeyEnv} onChange={(e) => setForm({ ...form, apiKeyEnv: e.target.value })} options={envVarOptions} />
            <Input label="Base URL (可选)" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="http://localhost:11434" />
            <div className="col-span-2">
              <Input label="描述" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="模型描述..." />
            </div>
          </div>
          <Button size="sm" onClick={handleAdd} disabled={saving || !form.id || !form.name || !form.modelId} isLoading={saving}>确认添加</Button>
        </Card>
      )}

      {testResult && (
        <div className={`px-4 py-2 rounded-card text-sm ${testResult.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {testResult.message}
          {testResult.latencyMs && <span className="ml-2 text-slate-500">(延迟: {testResult.latencyMs}ms)</span>}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">名称</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">提供商</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">模型 ID</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">描述</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">类型</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {models.map((preset) => (
              <tr key={preset.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 text-sm font-medium text-slate-800">{preset.name}</td>
                <td className="px-4 py-2"><span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${getProviderBadgeClass(preset.provider)}`}>{PROVIDER_LABELS[preset.provider] || preset.provider}</span></td>
                <td className="px-4 py-2 text-sm text-slate-600 font-mono">{preset.modelId}</td>
                <td className="px-4 py-2 text-sm text-slate-500">{preset.description || '-'}</td>
                <td className="px-4 py-2">{isBuiltIn(preset) ? <Badge variant="default">内置</Badge> : <Badge variant="warning">自定义</Badge>}</td>
                <td className="px-4 py-2 text-right space-x-2">
                  <Button variant="secondary" size="sm" onClick={() => testModelConnection(preset.id)} disabled={testingModelId === preset.id} isLoading={testingModelId === preset.id}>测试连接</Button>
                  {!isBuiltIn(preset) && (
                    deleteConfirm === preset.id ? (
                      <span className="text-xs">
                        <Button variant="danger" size="sm" onClick={() => handleDelete(preset.id)}>确认</Button>
                        <Button variant="secondary" size="sm" onClick={() => setDeleteConfirm(null)} className="ml-1">取消</Button>
                      </span>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(preset.id)} className="text-red-600 hover:bg-red-50">删除</Button>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {models.length === 0 && !showAddModelForm && <p className="text-center text-slate-500 py-8">暂无模型预设</p>}
    </div>
  );
}
