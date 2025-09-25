import { Suspense } from 'react';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { AppShell } from '../../components/layout/app-shell';
import { Sidebar, type SidebarSection } from '../../components/navigation/sidebar';
import { IdentityPill } from '../../components/IdentityPill';
import { ReadOnlyBanner } from '../../components/ReadOnlyBanner';
import { buildNavItems } from '../../lib/analytics';
import { getStaffUser } from '../../lib/auth';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const staffUser = await getStaffUser();

  if (!staffUser) {
    return (
      <AppShell sidebar={null}>
        <Suspense fallback={<div className="loading" data-testid="loading" />}>{children}</Suspense>
      </AppShell>
    );
  }

  const headerList = headers();
  const readOnlyEnabled = (headerList.get('x-read-only') ?? 'false').toLowerCase() === 'true';
  const readOnlyMessage = headerList.get('x-read-only-message') ?? 'Maintenance in progress';
  const nonce = headerList.get('x-csp-nonce') ?? '';

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

  const sections: SidebarSection[] = navGroups.map((group) => ({
    title: group.group,
    items: group.items
  }));

  return (
    <AppShell
      sidebar={
        <Sidebar
          sections={sections}
          footer={
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-12 dark:text-gray-dark12">{staffUser.displayName}</p>
              <p className="text-xs text-gray-11/80 dark:text-gray-dark11/80">{staffUser.email}</p>
            </div>
          }
        />
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex justify-end" data-nonce={nonce}>
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
    </AppShell>
  );
}
