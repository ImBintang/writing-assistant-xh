import { HTMLAttributes, forwardRef } from 'react';

type CardVariant = 'base' | 'feature' | 'hover';
type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
}

const variantClasses: Record<CardVariant, string> = {
  base: 'bg-white rounded-card border border-slate-100 shadow-card',
  feature: [
    'bg-white rounded-card border border-indigo-100 shadow-card',
    'bg-gradient-to-br from-white to-indigo-50/30',
  ].join(' '),
  hover: [
    'bg-white rounded-card border border-slate-100 shadow-card',
    'hover:shadow-cardHover hover:border-indigo-200 hover:-translate-y-1',
    'transition-all duration-300 cursor-pointer',
  ].join(' '),
};

const paddingClasses: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'base', padding = 'md', className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={[variantClasses[variant], paddingClasses[padding], className].join(' ')}
        {...props}
      >
        {children}
      </div>
    );
  },
);

Card.displayName = 'Card';

// 卡片子组件：统一的 header/body/footer 布局
export function CardHeader({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={['px-6 py-4 border-b border-slate-200', className].join(' ')} {...props} />;
}

export function CardBody({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={['p-6', className].join(' ')} {...props} />;
}

export function CardFooter({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={[
        'px-6 py-3 border-t border-slate-200 bg-slate-50 rounded-b-card',
        className,
      ].join(' ')}
      {...props}
    />
  );
}
