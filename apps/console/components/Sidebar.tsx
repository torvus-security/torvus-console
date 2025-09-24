"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Box, Flex, Separator, Text } from '@radix-ui/themes';

const NAV_SECTIONS: Array<{ title: string; items: Array<{ label: string; href: string }> }> = [
  {
    title: 'Operations',
    items: [
      { label: 'Overview', href: '/overview' },
      { label: 'Alerts', href: '/alerts' },
      { label: 'Releases', href: '/releases' }
    ]
  },
  {
    title: 'Security',
    items: [{ label: 'Audit trail', href: '/audit' }]
  },
  {
    title: 'Account',
    items: [
      { label: 'Profile', href: '/profile' },
      { label: 'Tokens', href: '/tokens' }
    ]
  },
  {
    title: 'Admin',
    items: [
      { label: 'People', href: '/admin/people' },
      { label: 'Roles', href: '/admin/roles' },
      { label: 'Integrations', href: '/admin/integrations' },
      { label: 'Intake Webhooks', href: '/admin/intake-webhooks' },
      { label: 'Secrets', href: '/admin/secrets' },
      { label: 'Approvals', href: '/admin/approvals' },
      { label: 'Settings', href: '/admin/settings' }
    ]
  }
];

type NavLinkProps = {
  href: string;
  children: ReactNode;
};

function NavLink({ href, children }: NavLinkProps) {
  const pathname = usePathname();
  const isExactMatch = pathname === href;
  const isNestedMatch = pathname?.startsWith(`${href}/`);
  const isActive = isExactMatch || isNestedMatch;

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
              <NavLink key={item.href} href={item.href}>
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
