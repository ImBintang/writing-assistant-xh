import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useState, useRef, useEffect, useCallback } from 'react';
import { ToastContainer } from './components/ui/Toast';

const NAV_ITEMS = [
  { to: '/', label: '首页', exact: true },
  { to: '/chapters', label: '章节管理' },
  { to: '/knowledge', label: '知识提取' },
  { to: '/knowledge-management', label: '知识库' },
  { to: '/graph', label: '知识图谱' },
  { to: '/writing', label: '写文窗口' },
  { to: '/settings', label: '设定构思' },
  { to: '/brainstorm', label: '头脑风暴' },
  { to: '/config', label: '系统配置' },
];

/** 自定义 Tooltip — 鼠标悬停时显示导航项名称 */
function NavTooltip({ label, targetRef }: { label: string; targetRef: React.RefObject<HTMLElement | null> }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (targetRef.current) {
        const rect = targetRef.current.getBoundingClientRect();
        setPos({ top: rect.bottom + 6, left: rect.left + rect.width / 2 });
        setVisible(true);
      }
    }, 400);
  }, [targetRef]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 100);
  }, []);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    el.addEventListener('mouseenter', show);
    el.addEventListener('mouseleave', hide);
    return () => {
      el.removeEventListener('mouseenter', show);
      el.removeEventListener('mouseleave', hide);
    };
  }, [targetRef, show, hide]);

  if (!visible) return null;

  return (
    <div
      className="fixed z-50 pointer-events-none transition-opacity duration-150"
      style={{ top: pos.top, left: pos.left, transform: 'translateX(-50%)' }}
    >
      <div className="px-2.5 py-1.5 text-xs font-medium text-white bg-slate-800 rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.15)] whitespace-nowrap">
        {label}
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-slate-800" />
      </div>
    </div>
  );
}

/** 单个导航项 */
function NavItem({ item, isActive }: { item: typeof NAV_ITEMS[number]; isActive: boolean }) {
  const linkRef = useRef<HTMLAnchorElement>(null);

  return (
    <div className="relative">
      <NavLink
        ref={linkRef}
        key={item.to}
        to={item.to}
        className={[
          'px-3.5 py-1.5 text-sm rounded-lg transition-all duration-200 whitespace-nowrap',
          isActive
            ? 'text-indigo-700 font-semibold bg-indigo-50 shadow-[0_2px_8px_-2px_rgba(79,70,229,0.25)]'
            : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50',
        ].join(' ')}
      >
        {item.label}
      </NavLink>
      <NavTooltip label={item.label} targetRef={linkRef} />
    </div>
  );
}

export default function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header：白色背景 + 蓝紫阴影 */}
      <header className="bg-white border-b border-slate-100 shadow-[0_4px_20px_-2px_rgba(79,70,229,0.1)] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-6 h-14">
            {/* 标题 — 渐变文字 */}
            <h1 className="text-heading font-extrabold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent tracking-tight flex-shrink-0">
              AI 写文助手
            </h1>

            {/* 导航 */}
            <nav className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
              {NAV_ITEMS.map((item) => {
                const isActive = item.exact
                  ? location.pathname === '/'
                  : location.pathname === item.to || location.pathname.startsWith(item.to + '/');
                return <NavItem key={item.to} item={item} isActive={isActive} />;
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  );
}
