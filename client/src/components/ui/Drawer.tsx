// client/src/components/ui/Drawer.tsx
// Generic slide-out drawer component — Corporate Trust styled

import { useEffect, ReactNode } from 'react';

interface DrawerProps {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  children: ReactNode;
  width?: string;
  side?: 'left' | 'right';
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  width = 'w-80',
  side = 'right',
}: DrawerProps) {
  // Escape 关闭（仅当 onClose 传入时）
  useEffect(() => {
    if (!open || !onClose) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // 背景滚动锁定（仅当 onClose 传入时，即遮罩可交互时才锁）
  useEffect(() => {
    if (!onClose) return;
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const isRight = side === 'right';

  return (
    <>
      {/* 遮罩层 — 仅 onClose 存在时渲染 */}
      {onClose && (
        <div
          className={[
            'fixed inset-0 z-40 transition-all duration-300',
            open
              ? 'bg-slate-900/30 backdrop-blur-sm opacity-100 pointer-events-auto'
              : 'bg-transparent backdrop-blur-none opacity-0 pointer-events-none',
          ].join(' ')}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* 抽屉面板 */}
      <div
        className={[
          'fixed top-0 bottom-0 z-50 bg-white flex flex-col',
          !onClose && 'relative', // 常态展开时使用 relative 内联布局
          'shadow-[0_0_30px_rgba(79,70,229,0.15)]',
          onClose && 'transition-transform duration-300 ease-out',
          width,
          isRight ? 'right-0 rounded-l-xl' : 'left-0 rounded-r-xl',
          onClose
            ? (isRight
                ? (open ? 'translate-x-0' : 'translate-x-full')
                : (open ? 'translate-x-0' : '-translate-x-full'))
            : '',
        ].join(' ')}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 flex-shrink-0">
            {typeof title === 'string' ? (
              <h3 className="text-section font-bold text-slate-900">{title}</h3>
            ) : (
              title
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="关闭"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </>
  );
}
