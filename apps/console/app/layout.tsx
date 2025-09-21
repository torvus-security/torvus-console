import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import clsx from 'clsx';
import '../styles/tokens.css';
import '../styles/globals.css';
import { getStaffUser } from '../lib/auth';
import { buildNavItems, getAnalyticsClient } from '../lib/analytics';
import { IdentityPill } from '../components/IdentityPill';
import { AccessDeniedNotice } from '../components/AccessDeniedNotice';

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

  const showMinimalShell = pathname.startsWith('/enroll-passkey');

  const staffUser = await getStaffUser();

  if (!staffUser) {
    return (
      <html lang="en" data-theme="torvus-staff">
        <body data-correlation={correlationId} className="body-minimal">
          <AccessDeniedNotice />
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
          <Suspense fallback={<div className="loading" data-testid="loading" />}>{children}</Suspense>
        </body>
      </html>
    );
  }

  const navItems = buildNavItems(staffUser.permissions);

  return (
    <html lang="en" data-theme="torvus-staff">
      <body data-correlation={correlationId} className="layout-shell">
        <aside className="sidebar" aria-label="Primary">
          <div className="sidebar__brand">
            <span className="brand-mark" aria-hidden>⚡</span>
            <span className="brand-text">Torvus Console</span>
          </div>
          <nav>
            <ul>
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={clsx('nav-link', {
                      active: pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                    })}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <footer>
            <span className="staff-name">{staffUser.displayName}</span>
            <span className="staff-email">{staffUser.email}</span>
          </footer>
        </aside>
        <div className="content">
          <header className="topbar">
            <div className="breadcrumbs">{pathname === '/' ? 'Overview' : pathname.replace('/', '').replace('-', ' ')}</div>
            <div className="topbar__meta" data-nonce={nonce}>
              <IdentityPill displayName={staffUser.displayName} email={staffUser.email} roles={staffUser.roles} />
            </div>
          </header>
          <main className="main" data-testid="main-content">
            <Suspense fallback={<div className="loading" data-testid="loading" />}>{children}</Suspense>
          </main>
        </div>
      </body>
    </html>
  );
}
