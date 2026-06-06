// client/src/components/editor/TipTapEditor.tsx
// TipTap rich text editor wrapper — Corporate Trust styled

import { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Underline from '@tiptap/extension-underline';
import { useWriting } from '../../hooks/useWriting';
import { Button } from '../ui/Button';

interface TipTapEditorProps {
  content: string;
  onUpdate: (html: string, text: string) => void;
  placeholder?: string;
  characterLimit?: number;
  editable?: boolean;
  className?: string;
  showFormattingToolbar?: boolean;
  minHeight?: string;
  editorId?: string;
}

export default function TipTapEditor({
  content, onUpdate, placeholder = '开始写作...', characterLimit,
  editable = true, className = '', showFormattingToolbar = true, minHeight, editorId: _editorId = 'editor',
}: TipTapEditorProps) {
  const polishText = useWriting((s) => s.polishText);
  const expandText = useWriting((s) => s.expandText);
  const shortenText = useWriting((s) => s.shortenText);
  const rewriteText = useWriting((s) => s.rewriteText);
  const aiLoading = useWriting((s) => s.aiLoading);
  const aiOperation = useWriting((s) => s.aiOperation);

  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customInstruction, setCustomInstruction] = useState('');
  const [showStyleInput, setShowStyleInput] = useState(false);
  const [styleValue, setStyleValue] = useState('');
  const [selectionText, setSelectionText] = useState('');
  const [charCount, setCharCount] = useState(0);
  const [localAiLoading, setLocalAiLoading] = useState(false);
  const [bubblePos, setBubblePos] = useState<{ top: number; left: number } | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const selectionTextRef = useRef(selectionText);
  selectionTextRef.current = selectionText;
  const stylePopupRef = useRef<HTMLDivElement>(null);

  const extensions = useMemo(() => [
    StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
    Placeholder.configure({ placeholder }),
    CharacterCount.configure({ limit: characterLimit }),
    Underline,
  ], [placeholder, characterLimit]);

  const editor = useEditor({
    extensions, content, editable,
    onUpdate: ({ editor }) => { const html = editor.getHTML(); const text = editor.getText(); setCharCount(text.length); onUpdate(html, text); },
    editorProps: { attributes: { class: `prose prose-sm max-w-none focus:outline-none ${minHeight || 'min-h-[360px]'} px-5 py-4` } },
  });

  useEffect(() => {
    if (editor && !editor.isDestroyed && content !== editor.getHTML()) {
      if (!editor.isFocused) editor.commands.setContent(content);
    }
  }, [content, editor]);

  // 根据 window.getSelection() 计算 viewport 相对位置
  const updateBubblePosition = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      setBubblePos(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) {
      setBubblePos(null);
      return;
    }
    // 默认在选区上方居中显示
    let top = rect.top - 12;
    // 若选区太靠近视口顶部，改为显示在选区下方
    if (rect.top < 80) {
      top = rect.bottom + 12;
    }
    const left = rect.left + rect.width / 2;
    setBubblePos({ top, left: Math.max(10, left) });
  }, []);

  const handleSelectionChange = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    const { from, to, empty } = editor.state.selection;
    if (!empty && from !== to) {
      const text = editor.state.doc.textBetween(from, to);
      setSelectionText(text);
      // requestAnimationFrame 确保 DOM 已更新选区位置
      requestAnimationFrame(() => updateBubblePosition());
    } else {
      setSelectionText('');
      setBubblePos(null);
    }
  }, [editor, updateBubblePosition]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const handleTransaction = () => { handleSelectionChange(); };
    editor.on('selectionUpdate', handleTransaction);
    return () => { editor.off('selectionUpdate', handleTransaction); };
  }, [editor, handleSelectionChange]);

  // 点击菜单外部时关闭菜单
  useEffect(() => {
    const isActive = !!selectionText && selectionText.length > 0;
    if (!isActive) return;
    const handleDocMouseDown = (e: MouseEvent) => {
      // 点击气泡菜单内部 → 不处理
      if (bubbleRef.current?.contains(e.target as Node)) return;
      // 点击 StyleInputPopup 内部 → 不处理
      if (stylePopupRef.current?.contains(e.target as Node)) return;
      // 点击编辑器内部 → 不处理（让 TipTap 正常处理选区）
      if (editor?.view.dom.contains(e.target as Node)) return;
      // 点击外部 → 关闭菜单
      setSelectionText('');
      setBubblePos(null);
      setShowStyleInput(false);
      setShowCustomInput(false);
    };
    document.addEventListener('mousedown', handleDocMouseDown, true);
    return () => document.removeEventListener('mousedown', handleDocMouseDown, true);
  }, [selectionText, editor]);

  // 滚动/缩放时重新计算气泡菜单位置
  useEffect(() => {
    const isActive = !!selectionText && selectionText.length > 0;
    if (!isActive) return;
    const handleUpdate = () => { updateBubblePosition(); };
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);
    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [selectionText, updateBubblePosition]);

  const handlePolish = async () => { if (!selectionTextRef.current || aiLoading) return; const result = await polishText(selectionTextRef.current); if (result && editor) {} };
  const handleExpand = async () => { if (!selectionTextRef.current || aiLoading) return; const result = await expandText(selectionTextRef.current); if (result && editor) {} };
  const handleShorten = async () => { if (!selectionTextRef.current || aiLoading) return; const result = await shortenText(selectionTextRef.current); if (result && editor) {} };
  const handleRewrite = async () => { if (!selectionTextRef.current || aiLoading) return; const result = await rewriteText(selectionTextRef.current, styleValue); if (result && editor) { setShowStyleInput(false); setStyleValue(''); } };
  const handleCustomInstruction = async () => { if (!selectionTextRef.current || aiLoading || !customInstruction.trim()) return; const result = await polishText(selectionTextRef.current, customInstruction.trim()); if (result && editor) { setShowCustomInput(false); setCustomInstruction(''); } };

  const isActive = !!selectionText && selectionText.length > 0 && bubblePos !== null;
  const isLoading = (aiLoading || localAiLoading) && ['polishing', 'expanding', 'shortening', 'rewriting', 'foreshadowing'].includes(aiOperation || 'foreshadowing');

  return (
    <div className={`relative ${className}`}>
      {showFormattingToolbar && editor && (
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-200 bg-slate-50 rounded-t-lg flex-wrap">
          <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="加粗"><strong>B</strong></ToolbarButton>
          <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="斜体"><em>I</em></ToolbarButton>
          <ToolbarButton active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="下划线"><u>U</u></ToolbarButton>
          <div className="w-px h-5 bg-slate-300 mx-1" />
          <ToolbarButton active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="一级标题">H1</ToolbarButton>
          <ToolbarButton active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="二级标题">H2</ToolbarButton>
          <ToolbarButton active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="三级标题">H3</ToolbarButton>
          <div className="w-px h-5 bg-slate-300 mx-1" />
          <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="撤销">↩</ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="重做">↪</ToolbarButton>
        </div>
      )}
      <EditorContent editor={editor} className={`${minHeight || 'min-h-[360px]'} ${showFormattingToolbar ? 'rounded-b-lg' : 'rounded-xl'} border border-slate-200 bg-white shadow-[0_4px_20px_-2px_rgba(79,70,229,0.08)]`} />

      {/* 选中文字气泡菜单 — Portal 到 body，z-[100] 最高图层 */}
      {isActive && bubblePos && createPortal(
        <div
          ref={bubbleRef}
          className="fixed flex items-center gap-1 bg-white border border-slate-300 rounded-card shadow-modal px-2 py-1.5 z-[100] animate-fade-in"
          style={{ top: bubblePos.top, left: bubblePos.left, transform: bubblePos.top < 80 ? 'translate(-50%, 0)' : 'translate(-50%, -100%)' }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {isLoading ? (
            <div className="flex items-center gap-2 px-2 py-1 text-sm text-slate-500"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600" /><span>AI 处理中...</span></div>
          ) : (
            <>
              <MenuItem onClick={handlePolish} label="润色此段" />
              <MenuItem onClick={handleExpand} label="扩写此段" />
              <MenuItem onClick={handleShorten} label="缩写此段" />
              <MenuItem onClick={() => setShowStyleInput(true)} label="改写风格" />
              <MenuItem onClick={() => setShowCustomInput(true)} label="自由指令" />
              <MenuItem
                onClick={async () => {
                  if (!selectionTextRef.current || localAiLoading) return;
                  setLocalAiLoading(true);
                  try {
                    await useWriting.getState().checkForeshadowing();
                    const findings = useWriting.getState().foreshadowingFindings;
                    if (findings && findings.length > 0) {
                      const summary = findings.map((f) =>
                        `• [${f.severity || 'info'}] ${f.description || '未知问题'}`
                      ).join('\n');
                      alert(`伏笔/逻辑检查完成，发现 ${findings.length} 个潜在问题：\n\n${summary}`);
                    } else {
                      alert('未发现明显逻辑问题或伏笔遗漏。');
                    }
                  } catch (err) {
                    console.error('检查逻辑失败:', err);
                    alert('检查逻辑失败，请稍后再试。');
                  } finally {
                    setLocalAiLoading(false);
                  }
                }}
                label="检查逻辑"
              />
            </>
          )}
        </div>,
        document.body
      )}

      {/* StyleInputPopup — Portal 到 body，z-[100] */}
      {showStyleInput && createPortal(
        <div ref={stylePopupRef} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border border-slate-300 rounded-card shadow-modal p-4 z-[100] min-w-[320px] animate-fade-in">
          <label className="block text-sm font-semibold text-slate-700 mb-2">改写风格</label>
          <input type="text" value={styleValue} onChange={(e) => setStyleValue(e.target.value)} placeholder="例如：古龙风格、轻松幽默..." className="w-full px-3 py-2 text-sm border border-slate-200 rounded-input focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleRewrite(); if (e.key === 'Escape') { setShowStyleInput(false); setStyleValue(''); } }} />
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="secondary" size="sm" onClick={() => { setShowStyleInput(false); setStyleValue(''); }}>取消</Button>
            <Button size="sm" onClick={handleRewrite} disabled={!styleValue.trim()}>改写</Button>
          </div>
        </div>,
        document.body
      )}
      {showCustomInput && createPortal(
        <div ref={stylePopupRef} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border border-slate-300 rounded-card shadow-modal p-4 z-[100] min-w-[320px] animate-fade-in">
          <label className="block text-sm font-semibold text-slate-700 mb-2">自由指令</label>
          <input type="text" value={customInstruction} onChange={(e) => setCustomInstruction(e.target.value)} placeholder="输入自定义需求..." className="w-full px-3 py-2 text-sm border border-slate-200 rounded-input focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleCustomInstruction(); if (e.key === 'Escape') { setShowCustomInput(false); setCustomInstruction(''); } }} />
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="secondary" size="sm" onClick={() => { setShowCustomInput(false); setCustomInstruction(''); }}>取消</Button>
            <Button size="sm" onClick={handleCustomInstruction} disabled={!customInstruction.trim()}>执行</Button>
          </div>
        </div>,
        document.body
      )}

      <div className="text-xs text-slate-400 mt-1 text-right">
        {charCount.toLocaleString()} 字{characterLimit && <span> / {characterLimit.toLocaleString()}</span>}
      </div>
    </div>
  );
}

function ToolbarButton({ active = false, disabled = false, onClick, title, children }: { active?: boolean; disabled?: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      className={`px-2 py-1 text-xs rounded transition-colors ${active ? 'bg-indigo-100 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-200 hover:text-slate-800'} ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>{children}</button>
  );
}

function MenuItem({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="px-2 py-1 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded whitespace-nowrap transition-colors cursor-pointer">{label}</button>
  );
}
