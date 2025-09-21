import clsx from 'clsx';

export type RoleBadgeProps = {
  role: string;
  className?: string;
};

export function RoleBadge({ role, className }: RoleBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border border-slate-600/60 bg-slate-700/50 px-2 py-0.5 text-xs font-medium text-slate-200',
        className
      )}
    >
      {role}
    </span>
  );
}
