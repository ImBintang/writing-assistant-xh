// client/src/router.tsx

import { createHashRouter } from 'react-router-dom';
import App from './App';

function HomePage() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">欢迎使用 AI 写文助手</h2>
        <p className="text-gray-500">请从左侧导航选择功能</p>
      </div>
    </div>
  );
}

export const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
    ],
  },
]);
