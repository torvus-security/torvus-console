"use client";

import type { CSSProperties } from 'react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { Box, Flex, Text } from '@radix-ui/themes';

export type SidebarNavItem = {
  label: string;
  href: string;
};

export type SidebarNavGroup = {
  title: string;
  items: SidebarNavItem[];
};

export type SidebarProps = {
  groups: SidebarNavGroup[];
  displayName: string;
  email: string;
};

const NAV_SECTION_ORDER = ['Operations', 'Security', 'Account', 'Admin'];

function NavLink({ href, label }: SidebarNavItem) {
  const pathname = usePathname();
  const isExactMatch = pathname === href;
  const isNestedMatch = pathname?.startsWith(`${href}/`);
  const isActive = isExactMatch || isNestedMatch;

  return (
    <Text
      asChild
      size="2"
      weight={isActive ? 'medium' : 'regular'}
      color={isActive ? 'iris' : 'gray'}
      className={clsx(
        'block rounded-r-md border-l-2 px-3 py-2 transition-colors',
        'border-transparent hover:border-slate-400 hover:bg-slate-200/60 dark:hover:border-slate-600 dark:hover:bg-slate-700/40',
        !isActive && 'hover:text-slate-900 dark:hover:text-slate-100'
      )}
      style={
        isActive
          ? ({
              borderLeftColor: 'var(--accent-9)',
              backgroundColor: 'var(--accent-4)',
              color: 'var(--accent-12)'
            } satisfies CSSProperties)
          : undefined
      }
    >
      <NextLink href={href} aria-current={isActive ? 'page' : undefined}>
        {label}
      </NextLink>
    </Text>
  );
}

export function Sidebar({ groups, displayName, email }: SidebarProps) {
  const sectionsMap = new Map<string, SidebarNavItem[]>();
  for (const group of groups) {
    sectionsMap.set(group.title, group.items);
  }

  const orderedSections: SidebarNavGroup[] = NAV_SECTION_ORDER.map((title) => ({
    title,
    items: sectionsMap.get(title) ?? []
  }));

  for (const group of groups) {
    if (!NAV_SECTION_ORDER.includes(group.title)) {
      orderedSections.push(group);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-6 py-6 dark:border-slate-800">
        <Flex align="center" gap="3">
          <Box
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-lg text-white dark:bg-slate-700"
          >
            ⚡
          </Box>
          <div>
            <Text as="span" size="3" weight="medium">
              Torvus Console
            </Text>
          </div>
        </Flex>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <nav className="flex flex-col gap-7">
          {orderedSections
            .filter((section) => section.items.length > 0)
            .map((section) => (
              <div key={section.title}>
                <Text
                  size="1"
                  color="gray"
                  weight="medium"
                  className="mb-2 block uppercase tracking-[0.12em]"
                >
                  {section.title}
                </Text>
                <Flex direction="column" gap="1">
                  {section.items.map((item) => (
                    <NavLink key={item.href} {...item} />
                  ))}
                </Flex>
              </div>
            ))}
        </nav>
      </div>

      <div className="border-t border-slate-200 px-6 py-6 text-sm dark:border-slate-800">
        <div className="font-medium text-slate-700 dark:text-slate-100">{displayName}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">{email}</div>
      </div>
    </div>
  );
}
