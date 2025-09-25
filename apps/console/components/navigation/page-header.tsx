"use client";

import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3 border-b border-slate-200/60 pb-5", "dark:border-slate-800/70", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-12 dark:text-gray-dark12">{title}</h1>
          {subtitle ? (
            <p className="text-sm text-gray-11/90 dark:text-gray-dark11/90">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </div>
  );
}
