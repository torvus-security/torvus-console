'use client';

import { useActionState } from 'react';
import { RoleBadge } from '../../../components/RoleBadge';

export type ProfileFormState = {
  error?: string;
  success?: boolean;
};

export type ProfileFormProps = {
  initialDisplayName: string;
  email: string;
  roles: string[];
  passkeyEnrolled: boolean;
  action: (
    state: ProfileFormState,
    formData: FormData
  ) => Promise<ProfileFormState> | ProfileFormState;
};

const INITIAL_STATE: ProfileFormState = { success: false };

export function ProfileForm({
  initialDisplayName,
  email,
  roles,
  passkeyEnrolled,
  action
}: ProfileFormProps) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  const uniqueRoles = [...new Set(roles)].sort();

  return (
    <form
      action={formAction}
      className="flex flex-col gap-6 rounded-3xl border border-slate-700 bg-slate-900/60 p-6 shadow-lg"
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-slate-300" htmlFor="displayName">
            Display name
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            maxLength={80}
            required
            defaultValue={initialDisplayName}
            placeholder="Your name"
            className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-slate-100 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/40"
            aria-describedby="display-name-hint"
          />
          <p id="display-name-hint" className="text-xs text-slate-500">
            This name appears in audit logs and release approvals.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-slate-300" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            readOnly
            value={email}
            className="cursor-not-allowed rounded-lg border border-slate-700 bg-slate-900/30 px-3 py-2 text-slate-400"
          />
          <p className="text-xs text-slate-500">Primary identity asserted by Cloudflare Access.</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-slate-300">Roles</span>
        {uniqueRoles.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {uniqueRoles.map((role) => (
              <RoleBadge key={role} role={role} />
            ))}
          </div>
        ) : (
          <span className="text-sm text-slate-500">No roles assigned.</span>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-slate-300">Passkey status</span>
          <span
            className={
              passkeyEnrolled
                ? 'inline-flex w-fit items-center rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300'
                : 'inline-flex w-fit items-center rounded-full bg-slate-700/60 px-3 py-1 text-xs font-medium text-slate-300'
            }
          >
            {passkeyEnrolled ? 'Enrolled' : 'Not enrolled'}
          </span>
        </div>
        <div className="flex flex-1 items-end justify-end gap-3">
          {state.error ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {state.error}
            </div>
          ) : null}
          {state.success && !state.error ? (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              Profile updated
            </div>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center rounded-full bg-sky-500 px-5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </form>
  );
}
