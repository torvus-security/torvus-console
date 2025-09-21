import Link from 'next/link';
import clsx from 'clsx';
import { RoleBadge } from './RoleBadge';

export type IdentityPillProps = {
  displayName: string;
  email: string;
  roles: string[];
  className?: string;
};

function extractInitials(displayName: string, email: string): string {
  const trimmed = displayName.trim();
  if (trimmed.length > 0) {
    const parts = trimmed.split(/\s+/).slice(0, 2);
    const initials = parts.map((part) => part[0] ?? '').join('').toUpperCase();
    if (initials) {
      return initials;
    }
  }
  const emailLocal = email.split('@')[0] ?? '';
  if (emailLocal.length >= 2) {
    return emailLocal.slice(0, 2).toUpperCase();
  }
  return '??';
}

export function IdentityPill({ displayName, email, roles, className }: IdentityPillProps) {
  const initials = extractInitials(displayName, email);
  const sortedRoles = [...new Set(roles)].sort();

  return (
    <Link
      href="/profile"
      className={clsx(
        'group inline-flex w-full max-w-md items-center gap-3 rounded-full border border-slate-600/70 bg-slate-800/80 px-3 py-2 text-sm text-slate-200 shadow-sm transition-colors hover:border-slate-500 hover:bg-slate-800',
        className
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold uppercase text-slate-100">
        {initials}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-slate-100 group-hover:text-white">{displayName}</span>
        <span className="truncate text-xs text-slate-400">{email}</span>
      </div>
      {sortedRoles.length > 0 && (
        <div className="flex flex-1 flex-wrap justify-end gap-1">
          {sortedRoles.map((role) => (
            <RoleBadge key={role} role={role} />
          ))}
        </div>
      )}
    </Link>
  );
}
