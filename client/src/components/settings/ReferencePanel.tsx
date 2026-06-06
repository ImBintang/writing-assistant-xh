// client/src/components/settings/ReferencePanel.tsx
// Collapsible right panel for searching and referencing knowledge base entries

import { useState, useCallback } from 'react';
import { useSettings, CATEGORY_LABELS } from '../../hooks/useSettings';

export default function ReferencePanel() {
  const showReferencePanel = useSettings((s) => s.showReferencePanel);
  const toggleReferencePanel = useSettings((s) => s.toggleReferencePanel);
  const knowledgeSearchResults = useSettings((s) => s.knowledgeSearchResults);
  const searchLoading = useSettings((s) => s.searchLoading);
  const searchKnowledge = useSettings((s) => s.searchKnowledge);
  const addReference = useSettings((s) => s.addReference);
  const currentSetting = useSettings((s) => s.currentSetting);

  const [query, setQuery] = useState('');

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      if (value.trim().length >= 1) {
        searchKnowledge(value);
      }
    },
    [searchKnowledge],
  );

  if (!showReferencePanel) {
    return (
      <button
        onClick={toggleReferencePanel}
        className="fixed right-4 top-32 px-3 py-1.5 text-xs bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors border border-orange-300"
        title="打开知识库参考面板"
      >
        📚 参考
      </button>
    );
  }

  return (
    <div className="w-72 border-l border-orange-200 flex flex-col bg-white">
      {/* Header */}
      <div className="p-3 border-b border-orange-100">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">📚 知识库参考</h3>
          <button
            onClick={toggleReferencePanel}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            ×
          </button>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="搜索知识库条目..."
          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400"
        />
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto p-2">
        {searchLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500" />
          </div>
        ) : knowledgeSearchResults.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">
            {query ? '未找到相关条目' : '输入关键词搜索知识库'}
          </p>
        ) : (
          <div className="space-y-2">
            {knowledgeSearchResults.map((item) => (
              <div
                key={item.id}
                className="p-2.5 border border-gray-150 rounded-lg hover:border-orange-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-800 truncate">
                      {item.name}
                    </h4>
                    <span className="inline-block text-xs px-1.5 py-0.5 mt-0.5 rounded bg-gray-100 text-gray-500">
                      {CATEGORY_LABELS[item.category] || item.category}
                    </span>
                    {item.snippet && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                        {item.snippet.replace(/<\/?b>/g, '')}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => addReference(item.id)}
                    disabled={
                      !!currentSetting?.references.includes(item.id)
                    }
                    className={`ml-2 px-2 py-1 text-xs rounded flex-shrink-0 transition-colors ${
                      currentSetting?.references.includes(item.id)
                        ? 'bg-green-50 text-green-600 border border-green-200'
                        : 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100'
                    }`}
                    title={
                      currentSetting?.references.includes(item.id)
                        ? '已引用'
                        : '引用此条目'
                    }
                  >
                    {currentSetting?.references.includes(item.id) ? '已引用' : '引用'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Current references */}
      {currentSetting && currentSetting.references.length > 0 && (
        <div className="border-t border-orange-100 p-3">
          <h4 className="text-xs font-semibold text-gray-600 mb-1.5">
            当前引用 ({currentSetting.references.length})
          </h4>
          <div className="space-y-1">
            {currentSetting.references.map((refId) => (
              <div
                key={refId}
                className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded border border-green-100 truncate"
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
