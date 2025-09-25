import type { ReactNode } from 'react';
import { Card, type CardProps } from './card';
import { cn } from '../../utils/cn';

export interface KpiCardProps extends Omit<CardProps, 'children'> {
  label: string;
  value: string | number;
  delta?: string;
  icon?: ReactNode;
}

export function KpiCard({ label, value, delta, icon, className, ...props }: KpiCardProps) {
  const gridClasses = cn('grid gap-2 p-5', icon ? 'sm:grid-cols-[1fr_auto]' : '', className);

  return (
    <Card className={gridClasses} {...props}>
      <div className="kpi">
        <span className="label">{label}</span>
        <span className="value">{value}</span>
        {delta ? <span className="delta">{delta}</span> : null}
      </div>
      {icon ? (
        <div className="flex items-start justify-end text-gray-11 dark:text-gray-dark11">{icon}</div>
      ) : null}
    </Card>
  );
}
