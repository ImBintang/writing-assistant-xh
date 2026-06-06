// client/src/pages/Knowledge.tsx
// Knowledge extraction page — container for extraction, skills, and conflict resolution

import { useEffect } from 'react';
import { useKnowledge, CATEGORY_NAMES } from '../hooks/useKnowledge';
import { useChapters } from '../hooks/useChapters';
import ExtractTask from '../components/knowledge/ExtractTask';
import SkillEditor from '../components/skill/SkillEditor';
import ConflictResolver from '../components/knowledge/ConflictResolver';
import type { ConflictWithEntry, ConflictRecord, SkillInfo } from '../services/knowledge';

export default function KnowledgePage() {
  const {
    taskStatus,
    progress,
    skills,
    skillsLoading,
    conflicts,
    conflictsLoading,
    selectedCategories,
    extractConfigOpen,
    skillEditorOpen,
    conflictResolverOpen,
    loadSkills,
    loadConflicts,
    openExtractConfig,
    closeExtractConfig,
    openSkillEditor,
    closeSkillEditor,
    openConflictResolver,
    closeConflictResolver,
    resetExtraction,
  } = useKnowledge();

  const { chapters, status: _chaptersStatus } = useChapters();

  // Load data on mount
  useEffect(() => {
    loadSkills();
    loadConflicts();
  }, [loadSkills, loadConflicts]);

  const confirmedChapters = chapters.length;
  const isRunning = taskStatus === 'running';

  const totalConflicts = conflicts.reduce(
    (sum: number, c: ConflictWithEntry) => sum + c.conflicts.filter((cf: ConflictRecord) => !cf.resolved).length,
    0,
  );

  const builtInSkills = skills.filter((s: SkillInfo) => s.isBuiltIn);
  const customSkills = skills.filter((s: SkillInfo) => !s.isBuiltIn);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-1">知识提取</h2>
        <p className="text-sm text-gray-500">
          {confirmedChapters > 0
            ? `${confirmedChapters} 章已就绪 · 选择章节和分类开始提取`
            : '请先在章节管理页面上传并确认拆分'}
        </p>
      </div>

      {/* Status card (visible during and after extraction) */}
      {taskStatus !== 'idle' && progress && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-gray-800">
                {isRunning ? '提取进行中' : taskStatus === 'completed' ? '提取完成' : '提取结束'}
              </h3>
              <span
                className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                  isRunning
                    ? 'bg-blue-100 text-blue-700'
                    : taskStatus === 'completed'
                      ? 'bg-green-100 text-green-700'
                      : taskStatus === 'failed'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-600'
                }`}
              >
                {taskStatus}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {progress.completedSteps} / {progress.totalSteps} 步骤
              </span>
              {taskStatus !== 'running' && (
                <button
                  onClick={resetExtraction}
                  className="text-xs text-indigo-600 hover:text-indigo-800"
                >
                  开始新任务
                </button>
              )}
            </div>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                isRunning ? 'bg-indigo-600' : taskStatus === 'completed' ? 'bg-green-500' : 'bg-gray-400'
              }`}
              style={{
                width: `${progress.totalSteps > 0
                  ? Math.round((progress.completedSteps / progress.totalSteps) * 100)
                  : 0}%`,
              }}
            />
          </div>

          {isRunning && progress.currentChapterTitle && (
            <p className="text-xs text-gray-500 mt-2">
              当前: {progress.currentChapterTitle}
              {progress.currentCategory && ` — ${progress.currentCategory}`}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Left column */}
        <div className="col-span-1 space-y-4">
          {/* Built-in Skills */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-800 mb-3">内置知识分类</h4>
            <div className="space-y-1.5">
              {builtInSkills.map((skill: SkillInfo) => (
                <label
                  key={skill.id}
                  className="flex items-center gap-2 text-sm cursor-pointer text-gray-600 hover:text-gray-800"
                >
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(skill.category)}
                    onChange={() =>
                      useKnowledge.getState().toggleCategory(skill.category)
                    }
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-medium whitespace-nowrap">{CATEGORY_NAMES[skill.category] || skill.name}</span>
                  <span className="text-xs text-gray-400 truncate">
                    {skill.description}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Custom Skills */}
          {customSkills.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-800 mb-3">自定义技能</h4>
              <div className="space-y-1.5">
                {customSkills.map((skill: SkillInfo) => (
                  <label
                    key={skill.id}
                    className="flex items-center gap-2 text-sm cursor-pointer text-gray-600 hover:text-gray-800"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(skill.category)}
                      onChange={() =>
                        useKnowledge.getState().toggleCategory(skill.category)
                      }
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-medium">{skill.name}</span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        openSkillEditor(skill);
                      }}
                      className="text-xs text-indigo-500 hover:text-indigo-700"
                    >
                      编辑
                    </button>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={openExtractConfig}
              disabled={confirmedChapters === 0}
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🚀 开始提取
            </button>
            <button
              onClick={() => openSkillEditor()}
              className="w-full px-4 py-2.5 text-sm font-medium text-indigo-700 bg-white border border-indigo-300 rounded-md hover:bg-indigo-50"
            >
              + 创建自定义技能
            </button>
            {totalConflicts > 0 && (
              <button
                onClick={() => openConflictResolver()}
                className="w-full px-4 py-2.5 text-sm font-medium text-yellow-700 bg-yellow-50 border border-yellow-300 rounded-md hover:bg-yellow-100"
              >
                ⚠ 裁决冲突 ({totalConflicts})
              </button>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="col-span-2 space-y-4">
          {/* Skills table */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h4 className="text-sm font-semibold text-gray-800">
                技能列表
                {skillsLoading && (
                  <span className="ml-2 text-xs text-gray-400">加载中...</span>
                )}
              </h4>
            </div>
            {skills.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500">
                暂无技能
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {skills.map((skill: SkillInfo) => (
                  <div
                    key={skill.id}
                    className="px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block w-1.5 h-1.5 rounded-full ${
                            skill.enabled ? 'bg-green-400' : 'bg-gray-300'
                          }`}
                        />
                        <span className="font-medium text-sm text-gray-800">
                          {skill.name}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                          {CATEGORY_NAMES[skill.category] || skill.category}
                        </span>
                        {skill.isBuiltIn && (
                          <span className="text-xs text-gray-400">内置</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {skill.description}
                      </p>
                    </div>
                    <button
                      onClick={() => openSkillEditor(skill)}
                      className="ml-2 px-3 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50"
                    >
                      {skill.isBuiltIn ? '查看' : '编辑'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Conflicts preview */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-800">
                冲突待裁决
                {totalConflicts > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                    {totalConflicts}
                  </span>
                )}
              </h4>
              {totalConflicts > 0 && (
                <button
                  onClick={() => openConflictResolver()}
                  className="text-xs text-indigo-600 hover:text-indigo-800"
                >
                  查看全部 →
                </button>
              )}
            </div>
            {conflicts.length === 0 ? (
              <div className="px-4 py-4 text-center text-sm text-gray-500">
                {conflictsLoading ? '加载中...' : '暂无冲突'}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {conflicts.slice(0, 5).map(({ entry, conflicts: entryConflicts }: ConflictWithEntry) => (
                  <div key={entry.id} className="px-4 py-2 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-gray-700">
                        {entry.name}
                      </span>
                      <span className="text-xs text-gray-400 ml-2">
                        {CATEGORY_NAMES[entry.category] || entry.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-yellow-600">
                        {entryConflicts.filter((c: ConflictRecord) => !c.resolved).length} 个冲突
                      </span>
                      <span className="text-xs text-gray-400">
                        {entryConflicts
                          .filter((c: ConflictRecord) => !c.resolved)
                          .map((c: ConflictRecord) => c.field)
                          .join(', ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {extractConfigOpen && <ExtractTask onClose={closeExtractConfig} />}
      {skillEditorOpen && <SkillEditor onClose={closeSkillEditor} />}
      {conflictResolverOpen && <ConflictResolver onClose={closeConflictResolver} />}
    </div>
  );
}
