// client/src/components/editor/TipTapEditor.tsx
// TipTap rich text editor wrapper with floating AI toolbar for PRD-05

import { useCallback, useState, useEffect, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Underline from '@tiptap/extension-underline';
import { useWriting } from '../../hooks/useWriting';

interface TipTapEditorProps {
  content: string;
  onUpdate: (html: string, text: string) => void;
  placeholder?: string;
  characterLimit?: number;
  editable?: boolean;
  className?: string;
  showFormattingToolbar?: boolean;
  editorId?: string; // to distinguish outline vs body instances
}

export default function TipTapEditor({
  content,
  onUpdate,
  placeholder = '开始写作...',
  characterLimit,
  editable = true,
  className = '',
  showFormattingToolbar = true,
  editorId: _editorId = 'editor',
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

  const extensions = useMemo(() => [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
    Placeholder.configure({
      placeholder,
    }),
    CharacterCount.configure({
      limit: characterLimit,
    }),
    Underline,
  ], [placeholder, characterLimit]);

  const editor = useEditor({
    extensions,
    content,
    editable,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const text = editor.getText();
      setCharCount(text.length);
      onUpdate(html, text);
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3',
      },
    },
  });

  // Sync external content changes back into the editor
  useEffect(() => {
    if (editor && !editor.isDestroyed && content !== editor.getHTML()) {
      // Only update if the cursor isn't active (external change)
      if (!editor.isFocused) {
        editor.commands.setContent(content);
      }
    }
  }, [content, editor]);

  // Handle selection for floating toolbar
  const handleSelectionChange = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    const { from, to, empty } = editor.state.selection;
    if (!empty && from !== to) {
      const text = editor.state.doc.textBetween(from, to);
      setSelectionText(text);
    }
  }, [editor]);

  // Attach selection change listener
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const handleTransaction = () => {
      handleSelectionChange();
    };
    editor.on('selectionUpdate', handleTransaction);
    return () => {
      editor.off('selectionUpdate', handleTransaction);
    };
  }, [editor, handleSelectionChange]);

  // AI operation handlers
  const handlePolish = async () => {
    if (!selectionText || aiLoading) return;
    const result = await polishText(selectionText);
    if (result && editor) {
      // The WritingLayout will handle showing the DiffView
    }
  };

  const handleExpand = async () => {
    if (!selectionText || aiLoading) return;
    const result = await expandText(selectionText);
    if (result && editor) {
      // The WritingLayout will handle showing the DiffView
    }
  };

  const handleShorten = async () => {
    if (!selectionText || aiLoading) return;
    const result = await shortenText(selectionText);
    if (result && editor) {
      // The WritingLayout will handle showing the DiffView
    }
  };

  const handleRewrite = async () => {
    if (!selectionText || aiLoading) return;
    const result = await rewriteText(selectionText, styleValue);
    if (result && editor) {
      setShowStyleInput(false);
      setStyleValue('');
    }
  };

  const handleCustomInstruction = async () => {
    if (!selectionText || aiLoading || !customInstruction.trim()) return;
    const result = await polishText(selectionText, customInstruction.trim());
    if (result && editor) {
      setShowCustomInput(false);
      setCustomInstruction('');
    }
  };

  const isActive = !!selectionText && selectionText.length > 0;
  const isLoading = aiLoading && ['polishing', 'expanding', 'shortening', 'rewriting'].includes(aiOperation || '');

  return (
    <div className={`relative ${className}`}>
      {/* Formatting Toolbar */}
      {showFormattingToolbar && editor && (
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-200 bg-gray-50 rounded-t-lg flex-wrap">
          <ToolbarButton
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="加粗"
          >
            <strong>B</strong>
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="斜体"
          >
            <em>I</em>
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="下划线"
          >
            <u>U</u>
          </ToolbarButton>
          <div className="w-px h-5 bg-gray-300 mx-1" />
          <ToolbarButton
            active={editor.isActive('heading', { level: 1 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            title="一级标题"
          >
            H1
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="二级标题"
          >
            H2
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('heading', { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            title="三级标题"
          >
            H3
          </ToolbarButton>
          <div className="w-px h-5 bg-gray-300 mx-1" />
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="撤销"
          >
            ↩
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="重做"
          >
            ↪
          </ToolbarButton>
        </div>
      )}

      {/* Editor Content */}
      <EditorContent
        editor={editor}
        className={`min-h-[200px] ${showFormattingToolbar ? 'rounded-b-lg' : 'rounded-lg'} border border-gray-200 bg-white`}
      />

      {/* Floating AI Toolbar (appears on text selection) */}
      {isActive && editor && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full -mt-2 flex items-center gap-1 bg-white border border-gray-300 rounded-lg shadow-lg px-2 py-1.5 z-50">
          {isLoading ? (
            <div className="flex items-center gap-2 px-2 py-1 text-sm text-gray-500">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600" />
              <span>AI 处理中...</span>
            </div>
          ) : (
            <>
              <MenuItem onClick={handlePolish} label="润色此段" />
              <MenuItem onClick={handleExpand} label="扩写此段" />
              <MenuItem onClick={handleShorten} label="缩写此段" />
              <MenuItem onClick={() => setShowStyleInput(true)} label="改写风格" />
              <MenuItem onClick={() => setShowCustomInput(true)} label="自由指令" />
            </>
          )}
        </div>
      )}

      {/* Style Input Popup */}
      {showStyleInput && (
        <StyleInputPopup
          value={styleValue}
          onChange={setStyleValue}
          onSubmit={handleRewrite}
          onCancel={() => {
            setShowStyleInput(false);
            setStyleValue('');
          }}
          placeholder="例如：古龙风格、轻松幽默..."
        />
      )}

      {/* Custom Instruction Popup */}
      {showCustomInput && (
        <StyleInputPopup
          value={customInstruction}
          onChange={setCustomInstruction}
          onSubmit={handleCustomInstruction}
          onCancel={() => {
            setShowCustomInput(false);
            setCustomInstruction('');
          }}
          placeholder="输入自定义需求..."
          submitLabel="执行"
        />
      )}

      {/* Character count */}
      <div className="text-xs text-gray-400 mt-1 text-right">
        {charCount.toLocaleString()} 字
        {characterLimit && (
          <span> / {characterLimit.toLocaleString()}</span>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function ToolbarButton({
  active = false,
  disabled = false,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`px-2 py-1 text-xs rounded transition-colors ${
        active
          ? 'bg-indigo-100 text-indigo-700 font-medium'
          : 'text-gray-600 hover:bg-gray-200 hover:text-gray-800'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {children}
    </button>
  );
}

function MenuItem({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2 py-1 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded whitespace-nowrap transition-colors cursor-pointer"
    >
      {label}
    </button>
  );
}

function StyleInputPopup({
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder,
  submitLabel = '改写',
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  placeholder: string;
  submitLabel?: string;
}) {
  return (
    <div className="absolute top-12 left-0 bg-white border border-gray-300 rounded-lg shadow-xl p-3 z-50 min-w-[280px]">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit();
          if (e.key === 'Escape') onCancel();
        }}
      />
      <div className="flex justify-end gap-2 mt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded cursor-pointer"
        >
          取消
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!value.trim()}
          className={`px-3 py-1 text-xs rounded text-white cursor-pointer ${
            value.trim()
              ? 'bg-indigo-600 hover:bg-indigo-700'
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
