import clsx from 'clsx';

export type AccessDeniedNoticeProps = {
  variant?: 'full' | 'card';
  className?: string;
};

export function AccessDeniedNotice({ variant = 'full', className }: AccessDeniedNoticeProps) {
  if (variant === 'card') {
    return (
      <div
        className={clsx(
          'flex flex-col items-center justify-center gap-3 rounded-3xl border border-slate-700 bg-slate-900/60 p-12 text-center text-slate-100 shadow-xl',
          className
        )}
      >
        <h1 className="text-2xl font-semibold text-slate-100">Access denied</h1>
        <p className="text-sm text-slate-400">
          Torvus Console is restricted to enrolled staff. Contact Security Operations.
        </p>
      </div>
    );
  }

  return (
    <main className={clsx('unauthorised', className)}>
      <h1>Access denied</h1>
      <p>Torvus Console is restricted to enrolled staff. Contact Security Operations.</p>
    </main>
  );
}
