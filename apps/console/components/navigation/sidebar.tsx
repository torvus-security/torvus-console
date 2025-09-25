"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../utils/cn";

export type SidebarItem = {
  label: string;
  href: string;
};

export type SidebarSection = {
  title: string;
  items: SidebarItem[];
};

type SidebarProps = {
  sections: SidebarSection[];
  footer?: ReactNode;
  onNavigate?: () => void;
};

const SECTION_ORDER = ["Operations", "Security", "Account", "Admin"];

function SidebarLink({ href, label, onNavigate }: SidebarItem & { onNavigate?: () => void }) {
  const pathname = usePathname();
  const isExactMatch = pathname === href;
  const isNestedMatch = pathname?.startsWith(`${href}/`);
  const isActive = Boolean(isExactMatch || isNestedMatch);

  return (
    <Link
      href={href}
      data-active={isActive}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex h-9 items-center rounded-md px-3 text-sm font-medium text-gray-11 transition-colors",
        "hover:bg-indigo-4/30 hover:text-gray-12",
        "dark:text-gray-dark11 dark:hover:text-gray-dark12",
        "data-[active=true]:bg-indigo-9 data-[active=true]:text-white"
      )}
      onClick={onNavigate}
    >
      {label}
    </Link>
  );
}

export function Sidebar({ sections, footer, onNavigate }: SidebarProps) {
  const orderedSections = [
    ...SECTION_ORDER.map((title) => ({
      title,
      items: sections.find((section) => section.title === title)?.items ?? []
    })),
    ...sections.filter((section) => !SECTION_ORDER.includes(section.title))
  ].filter((section) => section.items.length > 0);

  return (
    <div className="flex h-full flex-col">
      <div className="px-3">
        <div className="mt-2 flex h-12 items-center rounded-lg bg-indigo-9/10 px-3 text-sm font-semibold text-indigo-12">
          Torvus Console
        </div>
      </div>

      <nav className="mt-4 flex-1 space-y-2">
        {orderedSections.map((section) => (
          <div key={section.title} className="px-2">
            <p className="text-xs uppercase tracking-wider text-gray-11/80 px-3 mt-6 mb-2">
              {section.title}
            </p>
            <div className="space-y-1">
              {section.items.map((item) => (
                <SidebarLink key={item.href} {...item} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {footer ? <div className="border-t border-slate-200/60 px-4 py-4 text-xs text-slate-500 dark:border-slate-800/70 dark:text-slate-300">{footer}</div> : null}
    </div>
  );
}
