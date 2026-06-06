// client/src/pages/Config.tsx
// System configuration page for PRD-07
// Tabs: 模型配置 | 功能绑定 | API Key | 上下文使用

import { useEffect, useState } from 'react';
import { useConfig } from '../hooks/useConfig';
import ModelList from '../components/config/ModelList';
import FunctionMapping from '../components/config/FunctionMapping';
import ApiKeyInput from '../components/config/ApiKeyInput';

type TabKey = 'models' | 'mapping' | 'apikey' | 'context';

interface Tab {
  key: TabKey;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { key: 'models', label: '模型配置', icon: '🔧' },
  { key: 'mapping', label: '功能绑定', icon: '🔗' },
  { key: 'apikey', label: 'API Key', icon: '🔑' },
  { key: 'context', label: '上下文', icon: '📊' },
];

export default function ConfigPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('models');
  const {
    config,
    contextUsage,
    loading,
    saving,
    error,
    successMessage,
    loadConfig,
    loadContextUsage,
    saveConfig,
  } = useConfig();

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (activeTab === 'context') {
      loadContextUsage();
    }
  }, [activeTab, loadContextUsage]);

  const handleContextUpdate = async (field: string, value: number) => {
    if (!config) return;
    await saveConfig({
      context: {
        maxInputTokens: config.context.maxInputTokens,
        maxOutputTokens: config.context.maxOutputTokens,
        knowledgeContextBudget: config.context.knowledgeContextBudget,
        [field]: value,
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">系统配置</h2>
        <div className="flex items-center gap-3">
          {saving && (
            <span className="text-sm text-indigo-600">保存中...</span>
          )}
          {successMessage && (
            <span className="text-sm text-green-600">✓ {successMessage}</span>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.key
                ? 'bg-white border border-gray-200 border-b-white text-indigo-700 -mb-px'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        {activeTab === 'models' && <ModelList />}

        {activeTab === 'mapping' && <FunctionMapping />}

        {activeTab === 'apikey' && <ApiKeyInput />}

        {activeTab === 'context' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800">上下文设置</h3>
            <p className="text-sm text-gray-500">
              配置大模型上下文窗口限制，防止 token 溢出。
            </p>

            {/* Context config */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border border-gray-200 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  最大输入 Token
                </label>
                <input
                  type="number"
                  value={config?.context.maxInputTokens || 100000}
                  onChange={(e) => handleContextUpdate('maxInputTokens', parseInt(e.target.value) || 100000)}
                  disabled={saving}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  min={1000}
                  max={1000000}
                  step={1000}
                />
                <p className="text-xs text-gray-400 mt-1">默认: 100,000</p>
              </div>

              <div className="p-4 border border-gray-200 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  最大输出 Token
                </label>
                <input
                  type="number"
                  value={config?.context.maxOutputTokens || 4096}
                  onChange={(e) => handleContextUpdate('maxOutputTokens', parseInt(e.target.value) || 4096)}
                  disabled={saving}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  min={100}
                  max={100000}
                  step={100}
                />
                <p className="text-xs text-gray-400 mt-1">默认: 4,096</p>
              </div>

              <div className="p-4 border border-gray-200 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  知识库上下文预算
                </label>
                <input
                  type="number"
                  value={config?.context.knowledgeContextBudget || 30000}
                  onChange={(e) => handleContextUpdate('knowledgeContextBudget', parseInt(e.target.value) || 30000)}
                  disabled={saving}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  min={1000}
                  max={500000}
                  step={1000}
                />
                <p className="text-xs text-gray-400 mt-1">默认: 30,000</p>
              </div>
            </div>

            {/* Context usage stats */}
            {contextUsage && (
              <div className="mt-6">
                <h4 className="text-md font-semibold text-gray-700 mb-3">上下文使用统计</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="p-3 bg-indigo-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-indigo-700">{contextUsage.summary.totalCalls}</p>
                    <p className="text-xs text-indigo-500">总调用次数</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-purple-700">{contextUsage.summary.totalInputTokens.toLocaleString()}</p>
                    <p className="text-xs text-purple-500">总输入 Token</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-green-700">{contextUsage.summary.totalOutputTokens.toLocaleString()}</p>
                    <p className="text-xs text-green-500">总输出 Token</p>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-amber-700">{contextUsage.summary.averageInputTokens.toLocaleString()}</p>
                    <p className="text-xs text-amber-500">平均输入 Token</p>
                  </div>
                </div>

                {/* Per-function breakdown */}
                {Object.keys(contextUsage.byFunction).length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">功能</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">调用次数</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">输入 Token</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">输出 Token</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {Object.entries(contextUsage.byFunction).map(([func, stats]) => (
                          <tr key={func} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-800">{func}</td>
                            <td className="px-4 py-2 text-sm text-gray-600 text-right">{stats.calls}</td>
                            <td className="px-4 py-2 text-sm text-gray-600 text-right">{stats.totalInputTokens.toLocaleString()}</td>
                            <td className="px-4 py-2 text-sm text-gray-600 text-right">{stats.totalOutputTokens.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Recent calls */}
                {contextUsage.recentCalls.length > 0 && (
                  <details className="mt-4">
                    <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                      最近 {contextUsage.recentCalls.length} 次调用记录
                    </summary>
                    <div className="mt-2 overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-1.5 text-left text-gray-500">时间</th>
                            <th className="px-3 py-1.5 text-left text-gray-500">功能</th>
                            <th className="px-3 py-1.5 text-right text-gray-500">输入</th>
                            <th className="px-3 py-1.5 text-right text-gray-500">输出</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {contextUsage.recentCalls.map((call, i) => (
                            <tr key={i}>
                              <td className="px-3 py-1 text-gray-500">{new Date(call.timestamp).toLocaleTimeString()}</td>
                              <td className="px-3 py-1 text-gray-700">{call.function}</td>
                              <td className="px-3 py-1 text-right text-gray-500">{call.inputTokens.toLocaleString()}</td>
                              <td className="px-3 py-1 text-right text-gray-500">{call.outputTokens.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
