import { ReactNode, useEffect } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  position?: 'center' | 'top';
}

const sizeClasses: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
};

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'lg',
  position = 'center',
}: ModalProps) {
  // Escape 关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // 背景滚动锁定
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const positionClass =
    position === 'top' ? 'items-start pt-16 pb-10' : 'items-center';

  return (
    <div
      className={['fixed inset-0 z-50 flex justify-center', positionClass].join(' ')}
    >
      {/* 模糊遮罩 */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 内容面板 */}
      <div
        className={[
          'relative w-full mx-4 bg-white rounded-card shadow-modal',
          'max-h-[90vh] flex flex-col',
          'animate-fade-in-scale',
          sizeClasses[size],
        ].join(' ')}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            {typeof title === 'string' ? (
              <h3 className="text-section font-bold text-slate-900">{title}</h3>
            ) : (
              title
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-xl leading-none p-1 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="关闭"
            >
              &times;
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 rounded-b-card flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
