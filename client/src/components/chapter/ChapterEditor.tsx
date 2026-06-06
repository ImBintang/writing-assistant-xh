import { useEffect, useState } from 'react';
import { useChapters } from '../../hooks/useChapters';
import { fetchChapterRaw } from '../../services/chapters';

interface ChapterEditorProps {
  onClose: () => void;
  initialSplitOpen?: boolean;
}

export default function ChapterEditor({ onClose, initialSplitOpen = false }: ChapterEditorProps) {
  const { editorContent, editorLoading, selectedChapterId, updateChapter } =
    useChapters();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [rawContent, setRawContent] = useState<string | null>(null);
  const [rawLoading, setRawLoading] = useState(false);

  // Split state
  const [splitOpen, setSplitOpen] = useState(initialSplitOpen);
  const [splitLine, setSplitLine] = useState(0);
  const [splitting, setSplitting] = useState(false);

  useEffect(() => {
    if (editorContent) {
      setTitle(editorContent.meta.title);
      setContent(editorContent.content);
      setShowRaw(false);
      setRawContent(null);

      // Default split line to content midpoint
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-800">
              编辑章节 #{selectedChapterId}
            </h3>
            <button
              onClick={() => setSplitOpen(!splitOpen)}
              className={`px-3 py-1 text-xs font-medium rounded border ${
                splitOpen
                  ? 'border-yellow-300 bg-yellow-50 text-yellow-700'
                  : 'border-gray-200 text-gray-500 hover:text-yellow-600 hover:border-yellow-200'
              }`}
            >
              {splitOpen ? '取消拆分' : '拆分章节'}
            </button>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {editorLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  章节标题
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Content */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    章节内容
                  </label>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{content.length} 字</span>
                    <button
                      onClick={handleShowRaw}
                      disabled={rawLoading}
                      className="text-indigo-600 hover:text-indigo-800 disabled:text-gray-400"
                    >
                      {rawLoading ? '加载中...' : '查看原始段落'}
                    </button>
                  </div>
                </div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={20}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                />
              </div>

              {/* Split panel */}
              {splitOpen && (
                <div className="border border-yellow-300 bg-yellow-50 rounded-md p-4">
                  <h4 className="text-sm font-medium text-yellow-800 mb-3">
                    拆分章节
                  </h4>
                  <div className="flex items-center gap-3 mb-2">
                    <label className="text-sm text-gray-600 whitespace-nowrap">
                      拆分点位置（行号）：
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={totalLines - 1}
                      value={splitLine}
                      onChange={(e) => setSplitLine(Number(e.target.value))}
                      className="w-28 px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                    />
                    <span className="text-xs text-gray-400">
                      共 {totalLines} 行，在第 {splitLine} 行后切分
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSplit}
                      disabled={splitting || splitLine < 1 || splitLine >= totalLines}
                      className="px-4 py-1.5 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700 disabled:opacity-50"
                    >
                      {splitting ? '拆分中...' : `在第 ${splitLine} 行处拆分`}
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-yellow-700">
                    拆分后，原章节将分为上下两部分（"{title}（上）" 和 "{title}（下）"），后续章节序号自动递增。
                  </p>
                </div>
              )}

              {/* Raw content preview */}
              {showRaw && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    原始段落（含上下文）
                  </label>
                  <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
                    {rawContent || '加载中...'}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || editorLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
