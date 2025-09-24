"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
    <Box
      asChild
      data-active={isActive ? 'true' : undefined}
      className="block rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200/60 hover:text-slate-900 data-[active=true]:bg-slate-200 data-[active=true]:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700/50 dark:hover:text-slate-100 dark:data-[active=true]:bg-slate-700/70 dark:data-[active=true]:text-slate-50"
    >
      <Link href={href}>{label}</Link>
    </Box>
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
