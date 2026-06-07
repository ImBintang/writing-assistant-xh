// client/src/pages/Knowledge.tsx
// Knowledge extraction page — extraction, skills, and conflict resolution

import { useEffect, useState, useCallback } from 'react';
import { useKnowledge, CATEGORY_NAMES } from '../hooks/useKnowledge';
import { useChapters } from '../hooks/useChapters';
import { useToast } from '../hooks/useToast';
import ExtractTask from '../components/knowledge/ExtractTask';
import SkillEditor from '../components/skill/SkillEditor';
import ConflictResolver from '../components/knowledge/ConflictResolver';
import { PageShell } from '../components/ui/PageShell';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
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
    importNextChapter,
    importProgress,
    loadImportProgress,
  } = useKnowledge();
  const { addToast } = useToast();

  const { chapters, status: _chaptersStatus, loadChapters } = useChapters();

  useEffect(() => {
    loadSkills();
    loadConflicts();
    loadImportProgress();
    loadChapters();
  }, [loadSkills, loadConflicts, loadImportProgress, loadChapters]);

  const confirmedChapters = chapters.length;
  const [importingNextChapter, setImportingNextChapter] = useState(false);
  const [inferredNextIndexByCategory, setInferredNextIndexByCategory] = useState<Record<string, number>>({});
  const isRunning = taskStatus === 'running';

  const totalConflicts = conflicts.reduce(
    (sum: number, c: ConflictWithEntry) =>
      sum + c.conflicts.filter((cf: ConflictRecord) => !cf.resolved).length,
    0,
  );

  const builtInSkills = skills.filter((s: SkillInfo) => s.isBuiltIn);
  const customSkills = skills.filter((s: SkillInfo) => !s.isBuiltIn);
  const allBuiltInCategories = builtInSkills.map((s) => s.category);
  const allBuiltInSelected = allBuiltInCategories.length > 0
    && allBuiltInCategories.every((cat) => selectedCategories.includes(cat));

  // Compute next chapter index per category: favor importProgress, fallback to inferred from knowledge base
  const getNextChapterIndexForCategory = useCallback((category: string): number => {
    const fromProgress = importProgress.find((p) => p.category === category);
    if (fromProgress && fromProgress.lastImportedChapterIndex > 0) {
      return fromProgress.lastImportedChapterIndex + 1;
    }
    const fromInferred = inferredNextIndexByCategory[category];
    if (fromInferred && fromInferred > 0) {
      return fromInferred + 1;
    }
    return 1;
  }, [importProgress, inferredNextIndexByCategory]);

  // Determine next chapter index: take the max of all active categories, next = max + 1
  const activeCategories = selectedCategories.length > 0 ? selectedCategories : allBuiltInCategories;
  const nextChapterIndex = activeCategories.length > 0
    ? Math.max(...activeCategories.map((cat) => getNextChapterIndexForCategory(cat)))
    : 1;

  // Inference fallback: when importProgress is empty, try knowledge base retrospection
  useEffect(() => {
    if (importProgress.length === 0 && allBuiltInCategories.length > 0) {
      const doInfer = async () => {
        const map: Record<string, number> = {};
        for (const cat of allBuiltInCategories) {
          try {
            const store = useKnowledge.getState();
            const idx = await store.inferImportProgress(cat);
            if (idx > 0) map[cat] = idx;
          } catch {
            // ignore inference errors
          }
        }
        if (Object.keys(map).length > 0) {
          setInferredNextIndexByCategory(map);
        }
      };
      doInfer();
    }
  }, [importProgress, allBuiltInCategories]);

  // Check if selected category/categories are at latest
  const isCategoryLatest = (category: string): boolean => {
    const fromProgress = importProgress.find((p) => p.category === category);
    if (fromProgress) {
      return fromProgress.lastImportedChapterIndex >= fromProgress.totalChaptersAtImport;
    }
    return false;
  };

  const allSelectedLatest = activeCategories.length > 0 && activeCategories.every(isCategoryLatest);

  const handleSelectAllBuiltIn = () => {
    const store = useKnowledge.getState();
    if (allBuiltInSelected) {
      // Deselect all built-in
      allBuiltInCategories.forEach((cat) => {
        if (selectedCategories.includes(cat)) store.toggleCategory(cat);
      });
    } else {
      // Select all built-in
      allBuiltInCategories.forEach((cat) => {
        if (!selectedCategories.includes(cat)) store.toggleCategory(cat);
      });
    }
  };

  const handleImportNextChapter = useCallback(async () => {
    const cats = selectedCategories.length > 0
      ? selectedCategories
      : allBuiltInCategories;
    if (cats.length === 0) {
      addToast('info', '请先选择需要提取的知识分类');
      return;
    }

    // If there are unresolved conflicts, confirm first
    if (totalConflicts > 0) {
      const confirmed = window.confirm(
        `当前仍有 ${totalConflicts} 个冲突未裁决，导入下一章可能会产生新的冲突。确定要继续吗？`,
      );
      if (!confirmed) return;
    }

    setImportingNextChapter(true);
    try {
      let successCount = 0;
      for (const cat of cats) {
        const result = await importNextChapter(cat);
        if (result && !result.isLatest) {
          successCount++;
        }
      }
      if (successCount > 0) {
        addToast('success', `已导入第 ${nextChapterIndex} 章到 ${successCount} 个分类`);
      } else {
        addToast('info', '所有分类均已是最新章节');
      }
      // Reload conflicts and import progress after import
      await loadImportProgress();
      await loadConflicts();
    } catch {
      addToast('error', '导入下一章失败');
    } finally {
      setImportingNextChapter(false);
    }
  }, [selectedCategories, allBuiltInCategories, totalConflicts, importNextChapter, addToast, loadImportProgress, loadConflicts, nextChapterIndex]);

  const statusVariant = isRunning
    ? 'info'
    : taskStatus === 'completed'
      ? 'success'
      : taskStatus === 'failed'
        ? 'error'
        : 'muted';

  return (
    <PageShell
      heading="知识提取"
      description={
        confirmedChapters > 0
          ? `${confirmedChapters} 章已就绪 · 选择章节和分类开始提取`
          : '请先在章节管理页面上传并确认拆分'
      }
      showBlobs
    >
      {/* Status card */}
      {taskStatus !== 'idle' && progress && (
        <Card padding="md" className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-slate-800">
                {isRunning ? '提取进行中' : taskStatus === 'completed' ? '提取完成' : '提取结束'}
              </h3>
              <Badge variant={statusVariant}>{taskStatus}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">
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

          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                isRunning
                  ? 'bg-indigo-600'
                  : taskStatus === 'completed'
                    ? 'bg-emerald-500'
                    : 'bg-slate-400'
              }`}
              style={{
                width: `${progress.totalSteps > 0
                  ? Math.round((progress.completedSteps / progress.totalSteps) * 100)
                  : 0}%`,
              }}
            />
          </div>

          {isRunning && progress.currentChapterTitle && (
            <p className="text-xs text-slate-500 mt-2">
              当前: {progress.currentChapterTitle}
              {progress.currentCategory && ` — ${progress.currentCategory}`}
            </p>
          )}
        </Card>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Left column */}
        <div className="col-span-1 space-y-4">
          {/* Built-in Skills */}
          {builtInSkills.length > 0 && (
            <Card padding="md">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-800">内置知识分类</h4>
                <label className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allBuiltInSelected}
                    onChange={handleSelectAllBuiltIn}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  全选
                </label>
              </div>
              <div className="space-y-1.5">
                {builtInSkills.map((skill: SkillInfo) => (
                  <label
                    key={skill.id}
                    className="flex items-center gap-2 text-sm cursor-pointer text-slate-600 hover:text-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(skill.category)}
                      onChange={() =>
                        useKnowledge.getState().toggleCategory(skill.category)
                      }
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-medium whitespace-nowrap">
                      {CATEGORY_NAMES[skill.category] || skill.name}
                    </span>
                    <span className="text-xs text-slate-400 truncate">{skill.description}</span>
                  </label>
                ))}
              </div>
            </Card>
          )}

          {/* Custom Skills */}
          {customSkills.length > 0 && (
            <Card padding="md">
              <h4 className="text-sm font-semibold text-slate-800 mb-3">自定义技能</h4>
              <div className="space-y-1.5">
                {customSkills.map((skill: SkillInfo) => (
                  <label
                    key={skill.id}
                    className="flex items-center gap-2 text-sm cursor-pointer text-slate-600 hover:text-slate-800"
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
            </Card>
          )}

          {/* Actions */}
          <div className="space-y-2">
            <Button
              onClick={openExtractConfig}
              disabled={confirmedChapters === 0}
              className="w-full"
            >
              🚀 开始提取
            </Button>
            <Button
              variant="secondary"
              onClick={handleImportNextChapter}
              disabled={builtInSkills.length === 0 || importingNextChapter || allSelectedLatest}
              isLoading={importingNextChapter}
              className={`w-full ${allSelectedLatest ? 'opacity-60' : ''}`}
              title={allSelectedLatest ? '所有分类均已是最新章节，无需导入' : undefined}
            >
              {importingNextChapter
                ? '导入中…'
                : allSelectedLatest
                  ? '已是最新章节 ✓'
                  : `提取下一章（第 ${nextChapterIndex} 章）`}
            </Button>
            <Button
              variant="secondary"
              onClick={() => openSkillEditor()}
              className="w-full"
            >
              + 创建自定义技能
            </Button>
            {totalConflicts > 0 && (
              <Button
                variant="secondary"
                onClick={() => openConflictResolver()}
                className="w-full bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100 hover:border-amber-400"
              >
                ⚠ 裁决冲突 ({totalConflicts})
              </Button>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="col-span-2 space-y-4">
          {/* Skills table */}
          <Card padding="none" className="overflow-hidden">
            <CardHeader>
              <h4 className="text-sm font-semibold text-slate-800">
                技能列表
                {skillsLoading && (
                  <span className="ml-2 text-xs text-slate-400">加载中...</span>
                )}
              </h4>
            </CardHeader>
            {skills.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500">
                暂无技能
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {skills.map((skill: SkillInfo) => (
                  <div
                    key={skill.id}
                    className="px-4 py-3 flex items-center justify-between hover:bg-slate-50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block w-1.5 h-1.5 rounded-full ${
                            skill.enabled ? 'bg-emerald-400' : 'bg-slate-300'
                          }`}
                        />
                        <span className="font-medium text-sm text-slate-800">
                          {skill.name}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {CATEGORY_NAMES[skill.category] || skill.category}
                        </span>
                        {skill.isBuiltIn && (
                          <span className="text-xs text-slate-400">内置</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {skill.description}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openSkillEditor(skill)}
                    >
                      {skill.isBuiltIn ? '查看' : '编辑'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Conflicts preview */}
          <Card padding="none" className="overflow-hidden">
            <CardHeader className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-800">
                冲突待裁决
                {totalConflicts > 0 && (
                  <Badge variant="warning" className="ml-2">{totalConflicts}</Badge>
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
            </CardHeader>
            {conflicts.length === 0 ? (
              <div className="px-4 py-4 text-center text-sm text-slate-500">
                {conflictsLoading ? '加载中...' : '暂无冲突'}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {conflicts.slice(0, 5).map(({ entry, conflicts: entryConflicts }: ConflictWithEntry) => (
                  <div key={entry.id} className="px-4 py-2 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-slate-700">
                        {entry.name}
                      </span>
                      <span className="text-xs text-slate-400 ml-2">
                        {CATEGORY_NAMES[entry.category] || entry.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-amber-600">
                        {entryConflicts.filter((c: ConflictRecord) => !c.resolved).length} 个冲突
                      </span>
                      <span className="text-xs text-slate-400">
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
          </Card>
        </div>
      </div>

      {/* Modals */}
      {extractConfigOpen && <ExtractTask onClose={closeExtractConfig} />}
      {skillEditorOpen && <SkillEditor onClose={closeSkillEditor} />}
      {conflictResolverOpen && <ConflictResolver onClose={closeConflictResolver} />}
    </PageShell>
  );
}
