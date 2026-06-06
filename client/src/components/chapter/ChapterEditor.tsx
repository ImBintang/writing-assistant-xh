import { useEffect, useState } from 'react';
import { useChapters } from '../../hooks/useChapters';
import { fetchChapterRaw } from '../../services/chapters';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

interface ChapterEditorProps {
  onClose: () => void;
  initialSplitOpen?: boolean;
}

export default function ChapterEditor({ onClose, initialSplitOpen = false }: ChapterEditorProps) {
  const { editorContent, editorLoading, selectedChapterId, updateChapter } = useChapters();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [rawContent, setRawContent] = useState<string | null>(null);
  const [rawLoading, setRawLoading] = useState(false);

  const [splitOpen, setSplitOpen] = useState(initialSplitOpen);
  const [splitLine, setSplitLine] = useState(0);
  const [splitting, setSplitting] = useState(false);

  useEffect(() => {
    if (editorContent) {
      setTitle(editorContent.meta.title);
      setContent(editorContent.content);
      setShowRaw(false);
      setRawContent(null);
      const lineCount = editorContent.content.split('\n').length;
      setSplitLine(Math.max(1, Math.floor(lineCount / 2)));
    }
  }, [editorContent]);

  useEffect(() => {
    setSplitOpen(initialSplitOpen);
  }, [initialSplitOpen]);

  const handleSave = async () => {
    if (!selectedChapterId) return;
    setSaving(true);
    try {
      await updateChapter(selectedChapterId, { title, content });
      onClose();
    } catch {
      // Error handled by store
    } finally {
      setSaving(false);
    }
  };

  const handleShowRaw = async () => {
    if (!selectedChapterId) return;
    setRawLoading(true);
    setShowRaw(true);
    try {
      const result = await fetchChapterRaw(selectedChapterId);
      setRawContent(result.content);
    } catch {
      setRawContent('无法加载原始段落');
    } finally {
      setRawLoading(false);
    }
  };

  const handleSplit = async () => {
    if (!selectedChapterId || splitLine < 1) return;
    setSplitting(true);
    try {
      const { splitChapter } = useChapters.getState();
      await splitChapter(selectedChapterId, splitLine);
      onClose();
    } catch {
      // Error handled by store
    } finally {
      setSplitting(false);
    }
  };

  if (!selectedChapterId) return null;

  const totalLines = content ? content.split('\n').length : 0;

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <span>编辑章节 #{selectedChapterId}</span>
          <button
            onClick={() => setSplitOpen(!splitOpen)}
            className={`px-3 py-1 text-xs font-medium rounded-btn border transition-colors ${
              splitOpen
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-slate-200 text-slate-500 hover:text-amber-600 hover:border-amber-200'
            }`}
          >
            {splitOpen ? '取消拆分' : '拆分章节'}
          </button>
        </div>
      }
      size="4xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving || editorLoading} isLoading={saving}>
            保存
          </Button>
        </>
      }
    >
      {editorLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : (
        <div className="space-y-4">
          <Input
            label="章节标题"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          {/* Content */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">章节内容</label>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>{content.length} 字</span>
                <button
                  onClick={handleShowRaw}
                  disabled={rawLoading}
                  className="text-indigo-600 hover:text-indigo-800 disabled:text-slate-400"
                >
                  {rawLoading ? '加载中...' : '查看原始段落'}
                </button>
              </div>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={20}
              className="w-full px-3 py-2 border border-slate-200 rounded-input focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow duration-standard font-mono text-sm"
            />
          </div>

          {/* Split panel */}
          {splitOpen && (
            <div className="border border-amber-200 bg-amber-50 rounded-card p-4">
              <h4 className="text-sm font-medium text-amber-800 mb-3">拆分章节</h4>
              <div className="flex items-center gap-3 mb-2">
                <label className="text-sm text-slate-600 whitespace-nowrap">
                  拆分点位置（行号）：
                </label>
                <input
                  type="number"
                  min={1}
                  max={totalLines - 1}
                  value={splitLine}
                  onChange={(e) => setSplitLine(Number(e.target.value))}
                  className="w-28 px-3 py-1.5 border border-slate-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-400">
                  共 {totalLines} 行，在第 {splitLine} 行后切分
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleSplit}
                  disabled={splitting || splitLine < 1 || splitLine >= totalLines}
                  isLoading={splitting}
                  className="bg-amber-600 hover:bg-amber-700 from-amber-600 to-amber-600"
                >
                  在第 {splitLine} 行处拆分
                </Button>
              </div>
              <p className="mt-3 text-xs text-amber-700">
                拆分后，原章节将分为上下两部分（"{title}（上）" 和 "{title}（下）"），后续章节序号自动递增。
              </p>
            </div>
          )}

          {/* Raw content preview */}
          {showRaw && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                原始段落（含上下文）
              </label>
              <pre className="bg-slate-50 border border-slate-200 rounded-input p-3 text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
                {rawContent || '加载中...'}
              </pre>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
