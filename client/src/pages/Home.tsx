// client/src/pages/Home.tsx
// 首页仪表盘 — 总览系统状态、快速导航、待办提醒

import { useEffect, useState, useCallback } from 'react';
import { WelcomeBanner } from '../components/home/WelcomeBanner';
import { StatCards, type StatItem } from '../components/home/StatCards';
import { QuickEntries, type QuickEntryItem } from '../components/home/QuickEntries';
import { TodoPanel, type TodoItemData } from '../components/home/TodoPanel';
import { RecentChanges } from '../components/home/RecentChanges';

import { fetchChapters, fetchAnomalies, type ChapterMeta, type AnomalyRecord } from '../services/chapters';
import { fetchEntries } from '../services/knowledge-management';
import { fetchConflicts } from '../services/knowledge';
import { fetchRecentChanges } from '../services/knowledge-management';
import { fetchSettings } from '../services/settings';
import type { SettingFile } from '../services/settings';
import type { ChangeRecord } from '../services/knowledge';

// ---------------------------------------------------------------------------
// 内联 SVG 图标（项目无图标库，使用内联 SVG）
// ---------------------------------------------------------------------------

function IconWords() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function IconLibrary() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function IconFiles() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconChapters() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function IconExtract() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function IconKnowledge() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

function IconGraph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="6" r="3" />
      <circle cx="4" cy="18" r="3" />
      <circle cx="20" cy="18" r="3" />
      <line x1="10.2" y1="8.6" x2="6.8" y2="15.6" />
      <line x1="13.8" y1="8.6" x2="17.2" y2="15.6" />
    </svg>
  );
}

function IconPen() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconBrainstorm() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconConfig() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// 快速入口定义
// ---------------------------------------------------------------------------

const QUICK_ENTRIES: QuickEntryItem[] = [
  { title: '章节管理', description: '上传、拆分与管理章节', icon: <IconChapters />, to: '/chapters' },
  { title: '知识提取', description: 'AI 提取章节中的知识', icon: <IconExtract />, to: '/knowledge' },
  { title: '知识库', description: '浏览与管理知识条目', icon: <IconKnowledge />, to: '/knowledge-management' },
  { title: '知识图谱', description: '可视化知识关系网络', icon: <IconGraph />, to: '/graph' },
  { title: '写文窗口', description: 'AI 辅助正文写作', icon: <IconPen />, to: '/writing' },
  { title: '设定构思', description: '构思角色、功法等设定', icon: <IconSettings />, to: '/settings' },
  { title: '头脑风暴', description: '与 AI 对话进行剧情讨论', icon: <IconBrainstorm />, to: '/brainstorm' },
  { title: '系统配置', description: '管理模型与 API 配置', icon: <IconConfig />, to: '/config' },
];

// ---------------------------------------------------------------------------
// 首页组件
// ---------------------------------------------------------------------------

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // 指标数据
  const [totalWords, setTotalWords] = useState(0);
  const [totalEntries, setTotalEntries] = useState(0);
  const [totalChapters, setTotalChapters] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  // 待办
  const [todoItems, setTodoItems] = useState<TodoItemData[]>([]);
  const [todosLoading, setTodosLoading] = useState(true);

  // 最近变更
  const [recentChanges, setRecentChanges] = useState<ChangeRecord[]>([]);
  const [changesLoading, setChangesLoading] = useState(true);

  // 问候信息
  const [lastActivity, setLastActivity] = useState<string | undefined>();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);

    // 并行请求所有数据
    const results = await Promise.allSettled([
      fetchChapters(),
      fetchEntries({ size: 1 }),    // 只需 total
      fetchAnomalies(),
      fetchConflicts(),
      fetchRecentChanges(5),
      fetchSettings(),
    ]);

    // --- 章节数据 ---
    if (results[0].status === 'fulfilled') {
      const chaptersResp = results[0].value;
      const chapters: ChapterMeta[] = chaptersResp.chapters ?? [];
      setTotalChapters(chapters.length);
      setTotalWords(chapters.reduce((sum, ch) => sum + (ch.charCount || 0), 0));

      // 上次活动
      if (chapters.length > 0) {
        const lastChapter = chapters[chapters.length - 1];
        setLastActivity(`最近章节: ${lastChapter.title}`);
      }
    }

    // --- 知识条目 ---
    if (results[1].status === 'fulfilled') {
      setTotalEntries(results[1].value.total ?? 0);
    }

    // --- 异常 ---
    let anomalies: AnomalyRecord[] = [];
    if (results[2].status === 'fulfilled') {
      anomalies = results[2].value.anomalies ?? [];
    }

    // --- 冲突 ---
    let conflictCount = 0;
    if (results[3].status === 'fulfilled') {
      conflictCount = results[3].value.length;
    }

    // --- 最近变更 ---
    if (results[4].status === 'fulfilled') {
      setRecentChanges(results[4].value.changes ?? []);
    }
    setChangesLoading(false);

    // --- 设定（未迁移） ---
    let unmigratedCount = 0;
    if (results[5].status === 'fulfilled') {
      const settingFiles: SettingFile[] = results[5].value;
      unmigratedCount = settingFiles.filter((s) => s.status === 'draft').length;
    }

    // --- 章节状态（未确认） ---
    const unconfirmedCount = results[0].status === 'fulfilled'
      ? (results[0].value.status === 'pending' ? results[0].value.total : 0)
      : 0;

    // 计算待处理总数
    const errorAnomalies = anomalies.filter((a) => a.severity === 'error').length;
    const totalPending = conflictCount + errorAnomalies + unconfirmedCount + unmigratedCount;
    setPendingCount(totalPending);

    // --- 构建待办列表 ---
    const todos: TodoItemData[] = [];
    if (conflictCount > 0) {
      todos.push({
        id: 'conflicts',
        type: 'conflict',
        severity: 'high',
        label: '未解决知识冲突',
        count: conflictCount,
        navigateTo: '/knowledge',
      });
    }
    if (errorAnomalies > 0) {
      todos.push({
        id: 'anomalies',
        type: 'anomaly',
        severity: 'medium',
        label: '章节异常',
        count: errorAnomalies,
        navigateTo: '/chapters',
      });
    }
    if (unconfirmedCount > 0) {
      todos.push({
        id: 'unconfirmed',
        type: 'unconfirmed_chapter',
        severity: 'low',
        label: '未确认章节',
        count: unconfirmedCount,
        navigateTo: '/chapters',
      });
    }
    if (unmigratedCount > 0) {
      todos.push({
        id: 'unmigrated',
        type: 'unmigrated_setting',
        severity: 'info',
        label: '未迁移设定',
        count: unmigratedCount,
        navigateTo: '/settings',
      });
    }
    setTodoItems(todos);
    setTodosLoading(false);

    // 检查是否全部失败
    const allFailed = results.every((r) => r.status === 'rejected');
    setError(allFailed);

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- 指标卡片 ---
  const stats: StatItem[] = [
    {
      label: '总字数',
      value: loading ? '--' : totalWords,
      icon: <IconWords />,
      color: 'indigo',
      loading,
    },
    {
      label: '知识条目',
      value: loading ? '--' : totalEntries,
      icon: <IconLibrary />,
      color: 'violet',
      loading,
    },
    {
      label: '章节数',
      value: loading ? '--' : totalChapters,
      icon: <IconFiles />,
      color: 'emerald',
      loading,
    },
    {
      label: '待处理',
      value: loading ? '--' : pendingCount,
      icon: <IconAlert />,
      color: 'amber',
      loading,
      highlight: pendingCount > 0,
    },
  ];

  // --- 快速入口的告警红点 ---
  const alertSet = new Set(todoItems.map((t) => t.type));
  const entriesWithAlert = QUICK_ENTRIES.map((entry) => {
    let hasAlert = false;
    if (entry.to === '/chapters' && (alertSet.has('anomaly') || alertSet.has('unconfirmed_chapter'))) {
      hasAlert = true;
    } else if (entry.to === '/knowledge' && alertSet.has('conflict')) {
      hasAlert = true;
    } else if (entry.to === '/settings' && alertSet.has('unmigrated_setting')) {
      hasAlert = true;
    }
    return { ...entry, hasAlert };
  });

  return (
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      {/* 背景装饰球 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10" aria-hidden="true">
        <div className="blob-orb top-[-10%] left-[-5%] w-[40rem] h-[40rem] bg-gradient-to-br from-indigo-300/40 to-violet-300/40" />
        <div
          className="blob-orb bottom-[-10%] right-[-5%] w-[35rem] h-[35rem] bg-gradient-to-br from-violet-300/40 to-purple-300/40"
          style={{ animationDelay: '-4s' }}
        />
      </div>

      {/* 全部接口失败 */}
      {error && !loading ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <div className="text-4xl mb-4">😞</div>
          <p className="text-slate-500 mb-4">数据加载失败，请检查服务器连接</p>
          <button
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-medium text-sm rounded-btn shadow-btn hover:-translate-y-0.5 hover:shadow-glow transition-all duration-200"
            onClick={fetchData}
          >
            重新加载
          </button>
        </div>
      ) : (
        <>
          {/* 欢迎区 */}
          <WelcomeBanner
            workspaceName={undefined}
            lastActivity={lastActivity}
            loading={loading}
          />

          {/* 指标卡片 */}
          <StatCards stats={stats} />

          {/* 双栏布局 */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* 左栏：快速入口 */}
            <div className="flex-1 min-w-0">
              <h3 className="text-cardTtl font-semibold text-slate-800 mb-3">🚀 快速入口</h3>
              <QuickEntries entries={entriesWithAlert} />
            </div>

            {/* 右栏：待办 + 最近变更 */}
            <div className="w-full lg:w-[360px] flex-shrink-0">
              <TodoPanel items={todoItems} loading={todosLoading} />
              <RecentChanges changes={recentChanges} loading={changesLoading} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}