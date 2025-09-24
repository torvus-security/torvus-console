"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Box, Flex, Separator, Text } from '@radix-ui/themes';

type NavItem = {
  label: string;
  href: string;
  match?: 'exact' | 'startsWith';
};

const NAV_SECTIONS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Operations',
    items: [
      { label: 'Overview', href: '/overview', match: 'startsWith' },
      { label: 'Alerts', href: '/alerts', match: 'startsWith' },
      { label: 'Releases', href: '/releases', match: 'startsWith' }
    ]
  },
  {
    title: 'Security',
    items: [{ label: 'Audit trail', href: '/audit', match: 'startsWith' }]
  },
  {
    title: 'Account',
    items: [
      { label: 'Profile', href: '/profile', match: 'exact' },
      { label: 'Tokens', href: '/tokens', match: 'exact' }
    ]
  },
  {
    title: 'Admin',
    items: [
      { label: 'People', href: '/admin/people', match: 'startsWith' },
      { label: 'Roles', href: '/admin/roles', match: 'startsWith' },
      { label: 'Integrations', href: '/admin/integrations', match: 'startsWith' },
      { label: 'Intake Webhooks', href: '/admin/intake-webhooks', match: 'startsWith' },
      { label: 'Secrets', href: '/admin/secrets', match: 'startsWith' },
      { label: 'Approvals', href: '/admin/approvals', match: 'startsWith' },
      { label: 'Settings', href: '/admin/settings', match: 'startsWith' }
    ]
  }
];

type NavLinkProps = {
  href: string;
  match?: 'exact' | 'startsWith';
  children: ReactNode;
};

function NavLink({ href, match, children }: NavLinkProps) {
  const pathname = usePathname();
  const mode = match ?? 'startsWith';
  const isExactMatch = pathname === href;
  const isNestedMatch = pathname?.startsWith(`${href}/`);
  const isActive = mode === 'exact' ? isExactMatch : isExactMatch || isNestedMatch;

  return (
    <Box
      asChild
      data-active={isActive ? 'true' : undefined}
      className="block rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200/60 hover:text-slate-900 data-[active=true]:bg-slate-200 data-[active=true]:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700/50 dark:hover:text-slate-100 dark:data-[active=true]:bg-slate-700/70 dark:data-[active=true]:text-slate-50"
    >
      <Link href={href}>{children}</Link>
    </Box>
  );
}

export function Sidebar() {
  return (
    <Flex direction="column" gap="5">
      {NAV_SECTIONS.map((section, index) => (
        <Box key={section.title}>
          <Text size="1" color="gray" weight="medium" className="uppercase tracking-wide">
            {section.title}
          </Text>
          <Flex mt="2" direction="column" gap="1">
            {section.items.map((item) => (
              <NavLink key={item.href} href={item.href} match={item.match}>
                {item.label}
              </NavLink>
            ))}
          </Flex>
          {index < NAV_SECTIONS.length - 1 ? <Separator my="4" size="4" /> : null}
        </Box>
      ))}
    </Flex>
  );
}
