// client/src/components/knowledge/KnowledgeDetail.tsx
// Entry detail modal with version timeline

import { useState } from 'react';
import { useKnowledgeManagement } from '../../hooks/useKnowledgeManagement';
import VersionTimeline from './VersionTimeline';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
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
    <Modal
      open={true}
      onClose={onClose}
      title={
        <div>
          <h2 className="text-heading font-bold text-slate-800">{entry.name}</h2>
          {entry.aliases && entry.aliases.length > 0 && (
            <p className="text-sm text-slate-500 mt-1">别名：{entry.aliases.join('、')}</p>
          )}
        </div>
      }
      size="3xl"
      position="top"
      footer={
        <>
          <Button variant="ghost" onClick={onDelete} className="text-red-600 hover:bg-red-50">
            删除
          </Button>
          <div className="flex gap-3 ml-auto">
            <Button variant="secondary" onClick={onClose}>关闭</Button>
            <Button onClick={onEdit}>编辑</Button>
          </div>
        </>
      }
    >
      <div className="space-y-6">
        {/* Category & Version */}
        <div className="flex items-center gap-3 text-sm">
          <Badge variant="info">{CATEGORY_NAMES[entry.category] || entry.category}</Badge>
          <span className="text-slate-400">v{entry.version}</span>
          {entry.manualEdited && <Badge variant="warning">手动编辑</Badge>}
        </div>

        {/* Description */}
        {entry.description && (
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">描述</h3>
            <p className="text-slate-600 text-sm whitespace-pre-wrap">{entry.description}</p>
          </div>
        )}

        {/* Attributes */}
        {entry.attributes && Object.keys(entry.attributes).length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">属性</h3>
            <div className="bg-slate-50 rounded-card p-4 grid grid-cols-2 gap-3">
              {Object.entries(entry.attributes).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs text-slate-400 mb-1">{key}</dt>
                  <dd className="text-sm text-slate-700">
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
            <h3 className="text-sm font-semibold text-slate-700 mb-2">
              关联关系 ({entry.relations.length})
            </h3>
            <div className="space-y-2">
              {entry.relations.map((rel, i) => (
                <div key={i} className="flex items-center gap-2 text-sm bg-indigo-50 rounded-card px-3 py-2">
                  <span className="text-indigo-600 font-medium">{rel.relationType}</span>
                  <span className="text-slate-400">→</span>
                  <span className="text-slate-700">{rel.targetName}</span>
                  {rel.description && (
                    <span className="text-slate-400 text-xs ml-auto">{rel.description}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Source chapters */}
        {entry.source && entry.source.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">
              来源章节 ({entry.source.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {entry.source.map((src, i) => (
                <a
                  key={i}
                  href={`#/chapters`}
                  className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100 hover:underline transition-colors cursor-pointer"
                  title={`跳转到章节管理页面，定位到第${src.chapter}章`}
                >
                  第{src.chapter}章: {src.chapterTitle}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="text-xs text-slate-400 space-y-1">
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
    </Modal>
  );
}
