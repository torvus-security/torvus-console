import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { Theme, ThemePanel } from '@radix-ui/themes';
import '../design/radix-colors.css';
import '../styles/tokens.css';
import '../styles/globals.css';
import '../styles/radix.css';
import { getStaffUser } from '../lib/auth';
import { getAnalyticsClient } from '../lib/analytics';
import { isSupabaseConfigured } from '../lib/supabase';
import { DeniedPanel } from './(lib)/denied-panel';

export const metadata: Metadata = {
  title: 'Torvus Console',
  description: 'Privileged Torvus staff portal with RBAC, dual-control, and audit evidence.',
  icons: [{ rel: 'icon', url: '/favicon.ico' }]
};

export const runtime = 'nodejs';

export default async function RootLayout({ children }: { children: ReactNode }) {
  const headerList = headers();
  const pathname = headerList.get('x-pathname') ?? '/';
  const correlationId = headerList.get('x-correlation-id') ?? crypto.randomUUID();
  const showThemePanel = process.env.NODE_ENV !== 'production';

  const showMinimalShell = pathname.startsWith('/enroll-passkey');

  const supabaseConfigured = isSupabaseConfigured();

  if (!supabaseConfigured) {
    return (
      <html lang="en" data-theme="torvus-staff">
        <body data-correlation={correlationId} className="body-minimal">
          <Theme appearance="dark" accentColor="violet" grayColor="slate" panelBackground="solid" scaling="100%">
            <div className="unauthorised" role="alert">
              <h1>Torvus Console</h1>
              <p>Supabase configuration is required before the console can be used.</p>
              <p className="muted">
                Set <code>SUPABASE_URL</code>, <code>SUPABASE_ANON_KEY</code>, and <code>SUPABASE_SERVICE_ROLE</code> in the
                environment.
              </p>
            </div>
            {showThemePanel ? <ThemePanel /> : null}
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
          <Theme appearance="dark" accentColor="violet" grayColor="slate" panelBackground="solid" scaling="100%">
            <div className="mx-auto max-w-md py-16">
              <DeniedPanel message="Torvus Console is restricted to enrolled staff." />
            </div>
            {showThemePanel ? <ThemePanel /> : null}
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
          <Theme appearance="dark" accentColor="violet" grayColor="slate" panelBackground="solid" scaling="100%">
            <Suspense fallback={<div className="loading" data-testid="loading" />}>{children}</Suspense>
            {showThemePanel ? <ThemePanel /> : null}
          </Theme>
        </body>
      </html>
    );
  }

  return (
    <html lang="en" data-theme="torvus-staff">
      <body data-correlation={correlationId}>
        <Theme appearance="dark" accentColor="violet" grayColor="slate" panelBackground="solid" scaling="100%">
          <Suspense fallback={<div className="loading" data-testid="loading" />}>{children}</Suspense>
          {showThemePanel ? <ThemePanel /> : null}
        </Theme>
      </body>
    </html>
  );
}
