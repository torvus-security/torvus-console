import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import clsx from 'clsx';
import '@radix-ui/themes/styles.css';
import { Theme } from '@radix-ui/themes';
import '../design/radix-colors.css';
import '../styles/tokens.css';
import '../styles/globals.css';
import { getStaffUser } from '../lib/auth';
import { buildNavItems, getAnalyticsClient } from '../lib/analytics';
import { formatBreadcrumb } from '../lib/breadcrumbs';
import { IdentityPill } from '../components/IdentityPill';
import { AccessDeniedNotice } from '../components/AccessDeniedNotice';
import { ReadOnlyBanner } from '../components/ReadOnlyBanner';

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

  const staffUser = await getStaffUser();

  if (!staffUser) {
    return (
      <html lang="en" data-theme="torvus-staff">
        <body data-correlation={correlationId} className="body-minimal">
          <Theme appearance="light" accentColor="crimson" grayColor="mauve" radius="large" scaling="95%">
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
          <Theme appearance="light" accentColor="crimson" grayColor="mauve" radius="large" scaling="95%">
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

  return (
    <html lang="en" data-theme="torvus-staff">
      <body data-correlation={correlationId} className="layout-shell">
        <Theme appearance="light" accentColor="crimson" grayColor="mauve" radius="large" scaling="95%">
          <aside className="sidebar" aria-label="Primary">
            <div className="sidebar__brand">
              <span className="brand-mark" aria-hidden>
                ⚡
              </span>
              <span className="brand-text">Torvus Console</span>
            </div>
            <nav>
              {navGroups.map((group) => (
                <div key={group.group} className="nav-group">
                  <div className="nav-group__label">{group.group}</div>
                  <ul>
                    {group.items.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={clsx('nav-link', {
                            active:
                              pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                          })}
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
            <footer>
              <span className="staff-name">{staffUser.displayName}</span>
              <span className="staff-email">{staffUser.email}</span>
            </footer>
          </aside>
          <div className="content">
            {readOnlyEnabled ? <ReadOnlyBanner message={readOnlyMessage} /> : null}
            <header className="topbar">
              <div className="breadcrumbs">{formatBreadcrumb(pathname)}</div>
              <div className="topbar__meta" data-nonce={nonce}>
                <IdentityPill displayName={staffUser.displayName} email={staffUser.email} roles={staffUser.roles} />
              </div>
            </header>
            <main className="main" data-testid="main-content">
              <Suspense fallback={<div className="loading" data-testid="loading" />}>{children}</Suspense>
            </main>
          </div>
        </Theme>
      </body>
    </html>
  );
}
