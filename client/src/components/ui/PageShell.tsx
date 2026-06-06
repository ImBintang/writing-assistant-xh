import { ReactNode } from 'react';

interface PageShellProps {
  heading: string;
  description?: string;
  /** 标题旁边的操作区 */
  actions?: ReactNode;
  /** 是否显示背景装饰球 */
  showBlobs?: boolean;
  children: ReactNode;
  className?: string;
}

export function PageShell({
  heading,
  description,
  actions,
  showBlobs = false,
  children,
  className = '',
}: PageShellProps) {
  return (
    <div
      className={[
        'relative max-w-7xl mx-auto px-4 sm:px-6 py-10',
        className,
      ].join(' ')}
    >
      {/* 背景装饰球 */}
      {showBlobs && (
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none -z-10"
          aria-hidden="true"
        >
          <div className="blob-orb top-[-10%] left-[-5%] w-[40rem] h-[40rem] bg-gradient-to-br from-indigo-300 to-violet-300" />
          <div
            className="blob-orb bottom-[-10%] right-[-5%] w-[35rem] h-[35rem] bg-gradient-to-br from-violet-300 to-purple-300"
            style={{ animationDelay: '-4s' }}
          />
        </div>
      )}

      {/* 页面标题 */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-display font-bold text-slate-900 mb-1.5">{heading}</h2>
            {description && (
              <p className="text-sm text-slate-500 max-w-xl">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </div>
      </div>

      {children}
    </div>
  );
}
