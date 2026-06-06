import { Badge } from '../ui/Badge';

interface AnomalyBadgeProps {
  type: string;
  severity: 'warning' | 'error' | 'info';
  message?: string;
  onClick?: () => void;
}

const severityVariant: Record<string, 'warning' | 'error' | 'info'> = {
  warning: 'warning',
  error: 'error',
  info: 'info',
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
  const label = typeLabels[type] || type;

  const Tag = onClick ? 'button' : 'span';

  return (
    <Tag
      className={`inline-flex ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
      title={message || label}
      onClick={onClick}
    >
      <Badge variant={severityVariant[severity] || 'info'}>{label}</Badge>
    </Tag>
  );
}
