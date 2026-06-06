// client/src/components/home/WelcomeBanner.tsx

interface WelcomeBannerProps {
  workspaceName?: string;
  lastActivity?: string;
  loading?: boolean;
}

export function WelcomeBanner({ workspaceName, lastActivity, loading }: WelcomeBannerProps) {
  return (
    <div className="mb-8">
      {loading ? (
        <div className="space-y-3">
          <div className="h-9 w-64 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-5 w-48 bg-slate-100 rounded animate-pulse" />
        </div>
      ) : (
        <>
          <h2 className="text-display font-bold text-slate-900 mb-2">
            👋 欢迎回来
            {workspaceName && (
              <span className="text-slate-400 font-normal"> · </span>
            )}
            {workspaceName && (
              <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                {workspaceName}
              </span>
            )}
          </h2>
          <p className="text-sm text-slate-500">
            {lastActivity ?? '开始您的创作之旅'}
          </p>
        </>
      )}
    </div>
  );
}