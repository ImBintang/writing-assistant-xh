// client/src/components/ui/Toast.tsx
// Toast notification component — Corporate Trust design system

import { useToast } from '../../hooks/useToast';

const typeStyles: Record<string, string> = {
  success:
    'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-[0_4px_20px_-2px_rgba(16,185,129,0.15)]',
  error:
    'bg-red-50 border-red-200 text-red-800 shadow-[0_4px_20px_-2px_rgba(239,68,68,0.15)]',
  info: 'bg-indigo-50 border-indigo-200 text-indigo-800 shadow-[0_4px_20px_-2px_rgba(79,70,229,0.15)]',
};

const iconMap: Record<string, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
};

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={[
            'px-4 py-3 rounded-card border backdrop-blur-sm',
            'animate-fade-in-scale',
            'flex items-start gap-2',
            typeStyles[toast.type] || typeStyles.info,
          ].join(' ')}
        >
          <span className="text-base font-bold leading-tight mt-0.5 shrink-0">
            {iconMap[toast.type] || iconMap.info}
          </span>
          <span className="text-sm font-medium flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-current opacity-50 hover:opacity-100 transition-opacity shrink-0 leading-tight"
            aria-label="关闭通知"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
