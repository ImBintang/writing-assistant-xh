// client/src/components/skill/SkillEditor.tsx
// Skill editor modal — create/edit custom extraction skills

import { useState } from 'react';
import { useKnowledge } from '../../hooks/useKnowledge';
import type { CreateSkillRequest, UpdateSkillRequest } from '../../services/knowledge';

interface SkillEditorProps {
  onClose: () => void;
}

export default function SkillEditor({ onClose }: SkillEditorProps) {
  const { editingSkill, createSkill, updateSkill, deleteSkill, generateSkillPrompt } =
    useKnowledge();

  const isEditing = !!editingSkill;
  const isBuiltIn = editingSkill?.isBuiltIn ?? false;

  const [name, setName] = useState(editingSkill?.name || '');
  const [category, setCategory] = useState(editingSkill?.category || '');
  const [description, setDescription] = useState(editingSkill?.description || '');
  const [promptTemplate, setPromptTemplate] = useState(editingSkill?.promptTemplate || '');
  const [outputSchemaStr, setOutputSchemaStr] = useState(
    editingSkill?.outputSchema
      ? JSON.stringify(editingSkill.outputSchema, null, 2)
      : '{\n  "type": "object",\n  "properties": {\n    "entries": {\n      "type": "array",\n      "items": {\n        "type": "object",\n        "properties": {\n          "name": { "type": "string" },\n          "attributes": { "type": "object" }\n        },\n        "required": ["name", "attributes"]\n      }\n    }\n  },\n  "required": ["entries"]\n}',
  );
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const allCategories = [
    { key: 'characters', label: '人物' },
    { key: 'techniques', label: '功法' },
    { key: 'locations', label: '地图' },
    { key: 'worldbuilding', label: '世界观' },
    { key: 'weapons', label: '武器' },
    { key: 'alchemy', label: '丹药' },
    { key: 'plot', label: '情节' },
  ];

  const handleSave = async () => {
    if (!name.trim()) {
      setError('请输入技能名称');
      return;
    }
    if (!category) {
      setError('请选择分类');
      return;
    }
    if (!description.trim()) {
      setError('请输入技能描述');
      return;
    }

    let outputSchema: Record<string, unknown> | undefined;
    try {
      outputSchema = JSON.parse(outputSchemaStr);
    } catch {
      setError('输出Schema不是有效的JSON');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (isEditing && editingSkill) {
        const updateData: UpdateSkillRequest = {
          name,
          category,
          description,
          promptTemplate,
          outputSchema,
        };
        await updateSkill(editingSkill.id, updateData);
      } else {
        const createData: CreateSkillRequest = {
          name,
          category,
          description,
          promptTemplate,
          outputSchema,
        };
        await createSkill(createData);
      }
      onClose();
    } catch {
      setError('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingSkill) return;
    if (!confirm(`确定要删除技能"${editingSkill.name}"吗？此操作不可撤销。`)) return;

    setDeleting(true);
    try {
      await deleteSkill(editingSkill.id);
      onClose();
    } catch {
      setError('删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const handleGenerate = async () => {
    // For generation, we need a temporary skill ID — use 'generate-temp'
    if (!name.trim() || !category || !description.trim()) {
      setError('请先填写名称、分类和描述，再进行AI生成');
      return;
    }

    setGenerating(true);
    setError('');

    try {
      // First create the skill to get an ID, then generate
      let skillId = editingSkill?.id;
      if (!skillId) {
        const tempSkill = await createSkill({ name, category, description });
        if (!tempSkill) throw new Error('创建失败');
        skillId = tempSkill.id;
      }

      const result = await generateSkillPrompt(skillId, { name, category, description });
      if (result) {
        setPromptTemplate(result.promptTemplate);
        setOutputSchemaStr(JSON.stringify(result.outputSchema, null, 2));
      }
    } catch {
      setError('AI生成失败，请检查API配置');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">
            {isEditing
              ? isBuiltIn
                ? `查看内置技能: ${editingSkill?.name}`
                : `编辑技能: ${editingSkill?.name}`
              : '创建新技能'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              技能名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isBuiltIn}
              placeholder="如：灵兽提取"
              maxLength={50}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-gray-100"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              分类 <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isBuiltIn}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-gray-100"
            >
              <option value="">选择分类</option>
              {allCategories.map((cat) => (
                <option key={cat.key} value={cat.key}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              描述 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isBuiltIn}
              placeholder="描述此技能提取什么类型的信息..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-gray-100"
            />
          </div>

          {/* Prompt Template */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Prompt 模板
              </label>
              <button
                onClick={handleGenerate}
                disabled={generating || isBuiltIn}
                className="px-3 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <span className="flex items-center gap-1">
                    <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-600" />
                    AI生成中...
                  </span>
                ) : (
                  '🤖 AI 生成'
                )}
              </button>
            </div>
            <textarea
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              disabled={isBuiltIn}
              placeholder="使用 {{chapterContent}} 和 {{chapterTitle}} 作为占位符..."
              rows={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm font-mono disabled:bg-gray-100"
            />
          </div>

          {/* Output Schema */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              输出 JSON Schema
            </label>
            <textarea
              value={outputSchemaStr}
              onChange={(e) => setOutputSchemaStr(e.target.value)}
              disabled={isBuiltIn}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm font-mono disabled:bg-gray-100"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-2">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 rounded-b-lg">
          <div>
            {isEditing && !isBuiltIn && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? '删除中...' : '删除技能'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              {isBuiltIn ? '关闭' : '取消'}
            </button>
            {!isBuiltIn && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
