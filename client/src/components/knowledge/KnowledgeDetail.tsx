// client/src/components/knowledge/KnowledgeDetail.tsx
// Entry detail modal with version timeline and edit capability (PRD-04 Section 2.1.3)

import { useState } from 'react';
import { useKnowledgeManagement } from '../../hooks/useKnowledgeManagement';
import VersionTimeline from './VersionTimeline';
import type { KnowledgeEntry } from '../../services/knowledge';

const CATEGORY_NAMES: Record<string, string> = {
  characters: '人物',
  techniques: '功法',
  locations: '地图',
  worldbuilding: '世界观',
  weapons: '武器',
  alchemy: '丹药',
  plot: '情节',
};

interface Props {
  entry: KnowledgeEntry;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function KnowledgeDetail({ entry, onClose, onEdit, onDelete }: Props) {
  const [showVersions, setShowVersions] = useState(false);
  const { versions, loadVersions } = useKnowledgeManagement();

  const handleShowVersions = () => {
    setShowVersions(!showVersions);
    if (!showVersions && versions.length === 0) {
      loadVersions(entry.id);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 pt-10 pb-10">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{entry.name}</h2>
            {entry.aliases && entry.aliases.length > 0 && (
              <p className="text-sm text-gray-500 mt-1">
                别名：{entry.aliases.join('、')}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Category & Version */}
          <div className="flex items-center gap-3 text-sm">
            <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full">
              {CATEGORY_NAMES[entry.category] || entry.category}
            </span>
            <span className="text-gray-400">v{entry.version}</span>
            {entry.manualEdited && (
              <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-xs">手动编辑</span>
            )}
          </div>

          {/* Description */}
          {entry.description && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">描述</h3>
              <p className="text-gray-600 text-sm whitespace-pre-wrap">{entry.description}</p>
            </div>
          )}

          {/* Attributes */}
          {entry.attributes && Object.keys(entry.attributes).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">属性</h3>
              <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-3">
                {Object.entries(entry.attributes).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs text-gray-400 mb-1">{key}</dt>
                    <dd className="text-sm text-gray-700">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </dd>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Relations */}
          {entry.relations && entry.relations.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                关联关系 ({entry.relations.length})
              </h3>
              <div className="space-y-2">
                {entry.relations.map((rel, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm bg-blue-50 rounded-lg px-3 py-2">
                    <span className="text-blue-600 font-medium">{rel.relationType}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-gray-700">{rel.targetName}</span>
                    {rel.description && (
                      <span className="text-gray-400 text-xs ml-auto">{rel.description}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Source chapters */}
          {entry.source && entry.source.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                来源章节 ({entry.source.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {entry.source.map((src, i) => (
                  <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    第{src.chapter}章: {src.chapterTitle}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="text-xs text-gray-400 space-y-1">
            <p>创建于: {new Date(entry.createdAt).toLocaleString('zh-CN')}</p>
            <p>更新于: {new Date(entry.updatedAt).toLocaleString('zh-CN')}</p>
          </div>

          {/* Version history toggle */}
          <div>
            <button
              onClick={handleShowVersions}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              {showVersions ? '隐藏版本历史' : '查看版本历史'} →
            </button>
            {showVersions && <VersionTimeline versions={versions} />}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between">
          <button
            onClick={onDelete}
            className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            删除
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              关闭
            </button>
            <button
              onClick={onEdit}
              className="px-4 py-2 text-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors"
            >
              编辑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
