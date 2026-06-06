// client/src/components/config/ApiKeyInput.tsx
// API Key status display — Corporate Trust styled

import { useConfig } from '../../hooks/useConfig';
import { Card } from '../ui/Card';

export default function ApiKeyInput() {
  const { config } = useConfig();
  const apiKeyStatus = config?.apiKeyStatus || {};
  const providers = [
    { key: 'claude', label: 'Claude (Anthropic)', icon: '🧠' },
    { key: 'openai', label: 'OpenAI', icon: '🤖' },
    { key: 'ollama', label: 'Ollama (本地)', icon: '💻' },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-section font-bold text-slate-900">API Key 状态</h3>
      <p className="text-sm text-slate-500">API Key 通过环境变量配置，不会在页面中显示完整值。设置后需重启服务器生效。</p>
      <div className="space-y-3">
        {providers.map(({ key, label, icon }) => {
          const status = (apiKeyStatus as Record<string, { configured: boolean; envVar: string }>)[key];
          const configured = status?.configured ?? false;
          const envVar = status?.envVar || '';
          return (
            <Card key={key} padding="md" className={`${configured ? 'border-emerald-200 bg-emerald-50/50' : ''} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{icon}</span>
                <div>
                  <p className="font-medium text-slate-800">{label}</p>
                  <p className="text-xs text-slate-500 font-mono">{envVar}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-block w-2 h-2 rounded-full ${configured ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                <span className={`text-sm ${configured ? 'text-emerald-700' : 'text-slate-500'}`}>{configured ? '已配置' : '未配置'}</span>
              </div>
            </Card>
          );
        })}
      </div>
      <div className="mt-4 p-3 bg-slate-50 rounded-card text-xs text-slate-500">
        <p className="font-medium mb-1">配置方法：</p>
        <ol className="list-decimal list-inside space-y-0.5">
          <li>在项目根目录创建 <code className="bg-slate-200 px-1 rounded">.env</code> 文件</li>
          <li>添加 <code className="bg-slate-200 px-1 rounded">ANTHROPIC_API_KEY=sk-ant-...</code> 等环境变量</li>
          <li>或在 <code className="bg-slate-200 px-1 rounded">workspace/user-config.json</code> 中设置 API Key</li>
        </ol>
      </div>
    </div>
  );
}
