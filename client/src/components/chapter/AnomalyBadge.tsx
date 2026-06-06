interface AnomalyBadgeProps {
  type: string;
  severity: 'warning' | 'error' | 'info';
  message?: string;
  onClick?: () => void;
}

const severityColors: Record<string, string> = {
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  error: 'bg-red-100 text-red-800 border-red-300',
  info: 'bg-blue-100 text-blue-800 border-blue-300',
};

export const typeLabels: Record<string, string> = {
  orphan_title: '疑似误判',
  missing_chapter: '章节缺失',
  duplicate_chapter: '重复章节',
  empty_chapter: '内容过短',
  oversized_chapter: '超长章节',
  title_format: '标题格式',
};

export default function AnomalyBadge({
  type,
  severity,
  message,
  onClick,
}: AnomalyBadgeProps) {
  const colorClass = severityColors[severity] || severityColors.info;
  const label = typeLabels[type] || type;

  const Tag = onClick ? 'button' : 'span';
  const cursorClass = onClick ? 'cursor-pointer hover:opacity-80' : '';

  return (
    <Tag
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass} ${cursorClass}`}
      title={message || label}
      onClick={onClick}
    >
      {label}
    </Tag>
  );
}
