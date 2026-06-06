// client/src/components/settings/ReferencePanel.tsx
// Knowledge base reference panel — using Drawer

import { useState, useCallback } from 'react';
import { useSettings, CATEGORY_LABELS } from '../../hooks/useSettings';

export default function ReferencePanel() {
  const knowledgeSearchResults = useSettings((s) => s.knowledgeSearchResults);
  const searchLoading = useSettings((s) => s.searchLoading);
  const searchKnowledge = useSettings((s) => s.searchKnowledge);
  const addReference = useSettings((s) => s.addReference);
  const currentSetting = useSettings((s) => s.currentSetting);
  const [query, setQuery] = useState('');

  const handleSearch = useCallback((value: string) => { setQuery(value); if (value.trim().length >= 1) searchKnowledge(value); }, [searchKnowledge]);

  return (
    <div className="w-80 border-l border-slate-100 bg-white flex flex-col h-full shadow-[0_0_30px_rgba(79,70,229,0.1)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">📚 知识库参考</h3>
      </div>

      {/* 搜索区 */}
      <div className="px-4 py-3 border-b border-slate-100">
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="搜索知识库条目..."
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-1 focus:border-transparent transition-all duration-200 placeholder:text-slate-400"
        />
      </div>

      {/* 结果列表 */}
      <div className="flex-1 overflow-auto p-3">
        {searchLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500" />
          </div>
        ) : knowledgeSearchResults.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-10">
            {query ? '未找到相关条目' : '输入关键词搜索知识库'}
          </p>
        ) : (
          <div className="space-y-2">
            {knowledgeSearchResults.map((item) => (
              <div
                key={item.id}
                className="p-3 border border-slate-100 rounded-xl hover:border-orange-200 hover:shadow-[0_4px_20px_-2px_rgba(249,115,22,0.08)] transition-all duration-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-slate-800 truncate">{item.name}</h4>
                    <span className="inline-block text-xs px-1.5 py-0.5 mt-1 rounded bg-slate-100 text-slate-500">
                      {CATEGORY_LABELS[item.category] || item.category}
                    </span>
                    {item.snippet && (
                      <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">
                        {item.snippet.replace(/<\/?b>/g, '')}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => addReference(item.id)}
                    disabled={!!currentSetting?.references.includes(item.id)}
                    className={`ml-2 px-2.5 py-1 text-xs rounded-lg flex-shrink-0 transition-all duration-200 font-medium ${
                      currentSetting?.references.includes(item.id)
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        : 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100 hover:-translate-y-0.5'
                    }`}
                    title={currentSetting?.references.includes(item.id) ? '已引用' : '引用此条目'}
                  >
                    {currentSetting?.references.includes(item.id) ? '已引用' : '引用'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部引用概览 */}
      {currentSetting && currentSetting.references.length > 0 && (
        <div className="border-t border-slate-200 px-4 py-3 bg-slate-50/50">
          <h4 className="text-xs font-semibold text-slate-600 mb-2">
            当前引用 ({currentSetting.references.length})
          </h4>
          <div className="space-y-1">
            {currentSetting.references.map((refId) => (
              <div
                key={refId}
                className="text-xs px-2.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100 truncate"
                title={refId}
              >
                📎 {refId}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
