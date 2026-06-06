// client/src/App.tsx

import { Outlet, NavLink, useLocation } from 'react-router-dom';

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

export default function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-bold text-gray-800">AI 写文助手</h1>
        <nav className="flex gap-1 mt-3">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact
              ? location.pathname === '/'
              : location.pathname === item.to || location.pathname.startsWith(item.to + '/');
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`px-4 py-1.5 text-sm rounded-lg transition-colors ${
                  isActive
                    ? 'bg-indigo-100 text-indigo-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                }`}
              >
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </header>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
