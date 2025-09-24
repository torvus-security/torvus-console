import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import '@radix-ui/themes/styles.css';
import { Theme } from '@radix-ui/themes';
import '../design/radix-colors.css';
import '../styles/tokens.css';
import '../styles/globals.css';
import { getStaffUser } from '../lib/auth';
import { buildNavItems, getAnalyticsClient } from '../lib/analytics';
import { isSupabaseConfigured } from '../lib/supabase';
import { IdentityPill } from '../components/IdentityPill';
import { AccessDeniedNotice } from '../components/AccessDeniedNotice';
import { ReadOnlyBanner } from '../components/ReadOnlyBanner';
import { Sidebar } from '../components/Sidebar';

export const metadata: Metadata = {
  title: 'Torvus Console',
  description: 'Privileged Torvus staff portal with RBAC, dual-control, and audit evidence.',
  icons: [{ rel: 'icon', url: '/favicon.ico' }]
};

export const runtime = 'nodejs';

export default async function RootLayout({ children }: { children: ReactNode }) {
  const headerList = headers();
  const pathname = headerList.get('x-pathname') ?? '/';
  const nonce = headerList.get('x-csp-nonce') ?? '';
  const correlationId = headerList.get('x-correlation-id') ?? crypto.randomUUID();
  const readOnlyEnabled = (headerList.get('x-read-only') ?? 'false').toLowerCase() === 'true';
  const readOnlyMessage = headerList.get('x-read-only-message') ?? 'Maintenance in progress';

  const showMinimalShell = pathname.startsWith('/enroll-passkey');

  const supabaseConfigured = isSupabaseConfigured();

  if (!supabaseConfigured) {
    return (
      <html lang="en" data-theme="torvus-staff">
        <body data-correlation={correlationId} className="body-minimal">
          <Theme
            appearance="dark"
            radius="large"
            scaling="100%"
            accentColor="iris"
            grayColor="slate"
            panelBackground="translucent"
          >
            <div className="unauthorised" role="alert">
              <h1>Torvus Console</h1>
              <p>Supabase configuration is required before the console can be used.</p>
              <p className="muted">
                Set <code>SUPABASE_URL</code>, <code>SUPABASE_ANON_KEY</code>, and <code>SUPABASE_SERVICE_ROLE</code> in the
                environment.
              </p>
            </div>
          </Theme>
        </body>
      </html>
    );
  }

  const staffUser = await getStaffUser();

  if (!staffUser) {
    return (
      <html lang="en" data-theme="torvus-staff">
        <body data-correlation={correlationId} className="body-minimal">
          <Theme
            appearance="dark"
            radius="large"
            scaling="100%"
            accentColor="iris"
            grayColor="slate"
            panelBackground="translucent"
          >
            <AccessDeniedNotice />
          </Theme>
        </body>
      </html>
    );
  }

  if (!staffUser.passkeyEnrolled && !showMinimalShell) {
    redirect('/enroll-passkey');
  }

  const analytics = getAnalyticsClient();
  analytics.capture('staff_console_viewed', {
    path: pathname,
    env: process.env.NODE_ENV ?? 'development',
    user: staffUser.analyticsId,
    correlation_id: correlationId
  });

  if (showMinimalShell) {
    return (
      <html lang="en" data-theme="torvus-staff">
        <body data-correlation={correlationId} className="body-minimal">
          <Theme
            appearance="dark"
            radius="large"
            scaling="100%"
            accentColor="iris"
            grayColor="slate"
            panelBackground="translucent"
          >
            <Suspense fallback={<div className="loading" data-testid="loading" />}>{children}</Suspense>
          </Theme>
        </body>
      </html>
    );
  }

  const navGroups = [...buildNavItems(staffUser.permissions)];

  const hasSecurityAdminRole = staffUser.roles.some((role) => role.toLowerCase() === 'security_admin');

  if (hasSecurityAdminRole) {
    const adminGroup = navGroups.find((group) => group.group === 'Admin');
    const adminItems = [
      { href: '/admin/people', label: 'People' },
      { href: '/admin/roles', label: 'Roles' },
      { href: '/admin/integrations', label: 'Integrations' },
      { href: '/admin/integrations/intake', label: 'Intake Webhooks' },
      { href: '/admin/settings', label: 'Settings' },
      { href: '/admin/secrets', label: 'Secrets' },
      { href: '/admin/secrets/approvals', label: 'Secret Approvals' },
      { href: '/staff', label: 'Staff' }
    ];

    if (adminGroup) {
      adminGroup.items.push(...adminItems);
    } else {
      navGroups.push({ group: 'Admin', items: adminItems });
    }
  }

  const sidebarGroups = navGroups.map((group) => ({
    title: group.group,
    items: group.items
  }));

  return (
    <html lang="en" data-theme="torvus-staff">
      <body data-correlation={correlationId}>
        <Theme
          appearance="dark"
          radius="large"
          scaling="100%"
          accentColor="iris"
          grayColor="slate"
          panelBackground="translucent"
        >
          <div className="grid min-h-screen grid-cols-[280px_minmax(0,1fr)]">
            <aside
              aria-label="Primary"
              className="border-r border-slate-200 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-950/20"
            >
              <div className="sticky top-0 h-screen overflow-y-auto">
                <Sidebar groups={sidebarGroups} displayName={staffUser.displayName} email={staffUser.email} />
              </div>
            </aside>
            <main className="min-h-screen overflow-y-auto" data-testid="main-content">
              <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-6 py-8">
                <div data-nonce={nonce} className="flex justify-end">
                  <IdentityPill
                    displayName={staffUser.displayName}
                    email={staffUser.email}
                    roles={staffUser.roles}
                    className="sm:w-auto sm:max-w-none"
                  />
                </div>
                {readOnlyEnabled ? <ReadOnlyBanner message={readOnlyMessage} /> : null}
                <Suspense fallback={<div className="loading" data-testid="loading" />}>{children}</Suspense>
              </div>
            </main>
          </div>
        </Theme>
      </body>
    </html>
  );
}
