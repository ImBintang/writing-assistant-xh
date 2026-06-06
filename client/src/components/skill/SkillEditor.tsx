// client/src/components/skill/SkillEditor.tsx
// Skill editor modal — Corporate Trust styled

import { useState } from 'react';
import { useKnowledge } from '../../hooks/useKnowledge';
import { Modal } from '../ui/Modal';
import { Input, Select } from '../ui/Input';
import { Button } from '../ui/Button';
import type { CreateSkillRequest, UpdateSkillRequest } from '../../services/knowledge';

interface SkillEditorProps { onClose: () => void; }

export default function SkillEditor({ onClose }: SkillEditorProps) {
  const { editingSkill, createSkill, updateSkill, deleteSkill, generateSkillPrompt } = useKnowledge();
  const isEditing = !!editingSkill;
  const isBuiltIn = editingSkill?.isBuiltIn ?? false;

  const [name, setName] = useState(editingSkill?.name || '');
  const [category, setCategory] = useState(editingSkill?.category || '');
  const [description, setDescription] = useState(editingSkill?.description || '');
  const [promptTemplate, setPromptTemplate] = useState(editingSkill?.promptTemplate || '');
  const [outputSchemaStr, setOutputSchemaStr] = useState(editingSkill?.outputSchema ? JSON.stringify(editingSkill.outputSchema, null, 2) : '{\n  "type": "object",\n  "properties": {\n    "entries": {\n      "type": "array",\n      "items": {\n        "type": "object",\n        "properties": {\n          "name": { "type": "string" },\n          "attributes": { "type": "object" }\n        },\n        "required": ["name", "attributes"]\n      }\n    }\n  },\n  "required": ["entries"]\n}');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [enabled, setEnabled] = useState(editingSkill?.enabled !== false);

  const categoryOptions = [
    { value: 'characters', label: '人物' }, { value: 'techniques', label: '功法' },
    { value: 'locations', label: '地图' }, { value: 'worldbuilding', label: '世界观' },
    { value: 'weapons', label: '武器' }, { value: 'alchemy', label: '丹药' }, { value: 'plot', label: '情节' },
  ];

  const handleSave = async () => {
    if (!name.trim()) { setError('请输入技能名称'); return; }
    if (!category) { setError('请选择分类'); return; }
    if (!description.trim()) { setError('请输入技能描述'); return; }
    let outputSchema: Record<string, unknown> | undefined;
    try { outputSchema = JSON.parse(outputSchemaStr); } catch { setError('输出Schema不是有效的JSON'); return; }
    setSaving(true); setError('');
    try {
      if (isEditing && editingSkill) {
        await updateSkill(editingSkill.id, { name, category, description, promptTemplate, outputSchema, enabled } as UpdateSkillRequest);
      } else {
        await createSkill({ name, category, description, promptTemplate, outputSchema, enabled } as CreateSkillRequest);
      }
      onClose();
    } catch { setError('保存失败，请重试'); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!editingSkill) return;
    if (!confirm(`确定要删除技能"${editingSkill.name}"吗？此操作不可撤销。`)) return;
    setDeleting(true);
    try { await deleteSkill(editingSkill.id); onClose(); } catch { setError('删除失败'); } finally { setDeleting(false); }
  };

  const handleGenerate = async () => {
    if (!name.trim() || !category || !description.trim()) { setError('请先填写名称、分类和描述，再进行AI生成'); return; }
    setGenerating(true); setError('');
    try {
      let skillId = editingSkill?.id;
      if (!skillId) { const tempSkill = await createSkill({ name, category, description }); if (!tempSkill) throw new Error('创建失败'); skillId = tempSkill.id; }
      const result = await generateSkillPrompt(skillId, { name, category, description });
      if (result) { setPromptTemplate(result.promptTemplate); setOutputSchemaStr(JSON.stringify(result.outputSchema, null, 2)); }
    } catch { setError('AI生成失败，请检查API配置'); } finally { setGenerating(false); }
  };

  const title = isEditing ? (isBuiltIn ? `查看内置技能: ${editingSkill?.name}` : `编辑技能: ${editingSkill?.name}`) : '创建新技能';

  return (
    <Modal open={true} onClose={onClose} title={title} size="3xl"
      footer={
        <>
          <div>{isEditing && !isBuiltIn && <Button variant="danger" onClick={handleDelete} disabled={deleting} isLoading={deleting}>删除技能</Button>}</div>
          <div className="flex items-center gap-3 ml-auto">
            <Button variant="secondary" onClick={onClose}>{isBuiltIn ? '关闭' : '取消'}</Button>
            {!isBuiltIn && <Button onClick={handleSave} disabled={saving} isLoading={saving}>保存</Button>}
          </div>
        </>
      }
    >
      <div className="space-y-4">
        <Input label={<span>技能名称 <span className="text-red-500">*</span></span>} value={name} onChange={(e) => setName(e.target.value)} disabled={isBuiltIn} placeholder="如：灵兽提取" maxLength={50} />
        <Select label={<span>分类 <span className="text-red-500">*</span></span>} value={category} onChange={(e) => setCategory(e.target.value)} disabled={isBuiltIn} options={[{ value: '', label: '选择分类' }, ...categoryOptions]} />
        <Input label={<span>描述 <span className="text-red-500">*</span></span>} value={description} onChange={(e) => setDescription(e.target.value)} disabled={isBuiltIn} placeholder="描述此技能提取什么类型的信息..." />
        {!isBuiltIn && (
          <div className="flex items-center justify-between py-2">
            <label className="text-sm font-medium text-slate-700">启用状态</label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <div className={`w-9 h-5 rounded-full peer transition-colors ${enabled ? 'bg-indigo-600' : 'bg-slate-300'} peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300`} />
              <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
            </label>
          </div>
        )}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-slate-700">Prompt 模板</label>
            <Button variant="secondary" size="sm" onClick={handleGenerate} disabled={generating || isBuiltIn} isLoading={generating}>🤖 AI 生成</Button>
          </div>
          <textarea value={promptTemplate} onChange={(e) => setPromptTemplate(e.target.value)} disabled={isBuiltIn} placeholder="使用 {{chapterContent}} 和 {{chapterTitle}} 作为占位符..." rows={10} className="w-full px-3 py-2 border border-slate-200 rounded-input focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-mono disabled:bg-slate-100" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">输出 JSON Schema</label>
          <textarea value={outputSchemaStr} onChange={(e) => setOutputSchemaStr(e.target.value)} disabled={isBuiltIn} rows={8} className="w-full px-3 py-2 border border-slate-200 rounded-input focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-mono disabled:bg-slate-100" />
        </div>
        {error && <div className="bg-red-50 border border-red-200 rounded-card p-2"><p className="text-sm text-red-600">{error}</p></div>}
      </div>
    </Modal>
  );
}
