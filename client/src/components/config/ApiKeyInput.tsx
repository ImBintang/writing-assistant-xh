// client/src/components/config/ApiKeyInput.tsx
// Interactive API Key configuration — Corporate Trust styled
//
// Three states per provider:
// - 'env':       Configured via .env (read-only, restart required to change)
// - 'user-config': Configured via UI (can be changed/removed in-app)
// - 'none':      Not configured (can be set)
//
// Security: keys are write-only — never pre-filled or returned from the server.
// Input is always empty when editing starts.

import { useConfig } from '../../hooks/useConfig';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';

interface ProviderInfo {
  key: string;
  label: string;
  icon: string;
}

const PROVIDERS: ProviderInfo[] = [
  { key: 'claude', label: 'Claude (Anthropic)', icon: '🧠' },
  { key: 'openai', label: 'OpenAI', icon: '🤖' },
  { key: 'ollama', label: 'Ollama (本地)', icon: '💻' },
];

export default function ApiKeyInput() {
  const {
    config,
    editingProvider,
    apiKeyInput,
    showApiKeyInput,
    saving,
    setEditingProvider,
    setApiKeyInput,
    toggleShowApiKey,
    saveApiKey,
    removeApiKey,
    reloadEnvVars,
  } = useConfig();

  const apiKeyStatus = (config?.apiKeyStatus || {}) as Record<
    string,
    { configured: boolean; envVar: string; source: 'env' | 'user-config' | 'none' }
  >;

  const handleStartEdit = (provider: string) => {
    setEditingProvider(provider);
  };

  const handleCancel = () => {
    setEditingProvider(null);
  };

  const handleSave = async (provider: string) => {
    if (!apiKeyInput.trim()) return;
    await saveApiKey(provider, apiKeyInput.trim());
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-section font-bold text-slate-900">API Key 配置</h3>
          <p className="text-sm text-slate-500 mt-1">
            设置 AI 服务商的 API Key，配置后即时生效，无需重启。Key 仅可写入，不可回读。
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => reloadEnvVars()}
          isLoading={saving}
          title="重新读取 .env 文件中的环境变量"
        >
          <span className="flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            刷新缓存
          </span>
        </Button>
      </div>

      <div className="space-y-3">
        {PROVIDERS.map(({ key, label, icon }) => {
          const status = apiKeyStatus[key];
          const configured = status?.configured ?? false;
          const source = status?.source ?? 'none';
          const envVar = status?.envVar || '';
          const isEditing = editingProvider === key;
          const isEnvSource = source === 'env';
          const isUserConfigSource = source === 'user-config';

          return (
            <Card
              key={key}
              padding="md"
              className={`${
                configured ? 'border-emerald-200 bg-emerald-50/50' : ''
              } transition-all duration-200`}
            >
              {/* Provider header row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{icon}</span>
                  <div>
                    <p className="font-medium text-slate-800">{label}</p>
                    <p className="text-xs text-slate-500 font-mono">{envVar}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Status badge */}
                  {configured ? (
                    isEnvSource ? (
                      <Badge variant="info">已配置（环境变量）</Badge>
                    ) : (
                      <Badge variant="success">已配置（用户设置）</Badge>
                    )
                  ) : (
                    <Badge variant="muted">未配置</Badge>
                  )}

                  {/* Action buttons */}
                  {isEnvSource ? (
                    // .env source: read-only
                    <span className="text-xs text-slate-400 ml-1">通过 .env 配置</span>
                  ) : isUserConfigSource && !isEditing ? (
                    // user-config source: change / remove
                    <div className="flex items-center gap-1.5 ml-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStartEdit(key)}
                        disabled={saving}
                      >
                        更改
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => removeApiKey(key)}
                        isLoading={saving && editingProvider === null}
                      >
                        移除
                      </Button>
                    </div>
                  ) : !isEditing ? (
                    // not configured: set key
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleStartEdit(key)}
                      disabled={saving}
                    >
                      设置 Key
                    </Button>
                  ) : null}
                </div>
              </div>

              {/* env source hint */}
              {isEnvSource && (
                <div className="mt-2 flex items-center gap-3">
                  <p className="text-xs text-slate-400 flex-1">
                    通过 <code className="bg-slate-200 px-1 rounded text-slate-600">.env</code>{' '}
                    文件配置。如需更改，请编辑 .env 文件后点击"刷新缓存"按钮即时生效。
                  </p>
                </div>
              )}

              {/* Edit row */}
              {isEditing && (
                <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <Input
                        type={showApiKeyInput ? 'text' : 'password'}
                        placeholder={`输入 ${label} 的 API Key`}
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && apiKeyInput.trim()) {
                            handleSave(key);
                          }
                        }}
                        autoFocus
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={toggleShowApiKey}
                      className="shrink-0"
                    >
                      {showApiKeyInput ? '隐藏' : '显示'}
                    </Button>
                  </div>

                  <p className="text-xs text-slate-400">
                    出于安全原因，已有的 Key 值不可见。输入新 Key 以覆盖或重新配置。
                  </p>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      isLoading={saving}
                      onClick={() => handleSave(key)}
                      disabled={!apiKeyInput.trim()}
                    >
                      保存
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleCancel}
                      disabled={saving}
                    >
                      取消
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Bottom hint */}
      <div className="mt-4 p-3 bg-slate-50 rounded-card text-xs text-slate-500 space-y-1">
        <p className="font-medium">配置说明：</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>通过此页面设置的 Key 保存在 <code className="bg-slate-200 px-1 rounded">user-config.json</code>，即时生效</li>
          <li>
            通过 <code className="bg-slate-200 px-1 rounded">.env</code> 文件配置的 Key{' '}
            <strong>优先级更高</strong>，编辑文件后点击"刷新缓存"即时生效
          </li>
          <li>Key 仅可写入，无法从此页面读取完整值</li>
        </ul>
      </div>
    </div>
  );
}
