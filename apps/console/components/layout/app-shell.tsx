"use client";

import { cloneElement, isValidElement, useState, type ReactElement, type ReactNode } from "react";
import { Cross2Icon, HamburgerMenuIcon } from "@radix-ui/react-icons";
import { ScrollArea } from "@radix-ui/themes";
import { Button } from "../ui/button";

type AppShellProps = {
  sidebar: ReactNode;
  children: ReactNode;
};

export function AppShell({ sidebar, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const renderSidebar = (element: ReactNode, closeOnNavigate: boolean) => {
    if (!closeOnNavigate) {
      return element;
    }

    if (isValidElement(element)) {
      return cloneElement(element as ReactElement, {
        onNavigate: () => setMobileOpen(false)
      });
    }

    return element;
  };

  return (
    <div className="relative min-h-screen bg-slate-950/40">
      <div className="flex min-h-screen md:grid md:grid-cols-[256px_minmax(0,1fr)]">
        <aside
          aria-label="Primary"
          className="hidden border-r border-slate-200/60 bg-slate-100/60 dark:border-slate-800/70 dark:bg-slate-950/40 md:block"
        >
          <ScrollArea type="auto" scrollbars="vertical" style={{ height: "100vh" }}>
            <div className="sticky top-0 h-screen overflow-y-auto px-4 py-6">
              {renderSidebar(sidebar, false)}
            </div>
          </ScrollArea>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-slate-100/80 backdrop-blur-sm dark:border-slate-800/70 dark:bg-slate-950/60 md:hidden">
            <div className="flex h-16 items-center justify-between px-6">
              <Button
                variant="ghost"
                size="sm"
                className="h-10 rounded-md px-3 text-sm font-medium"
                onClick={() => setMobileOpen(true)}
              >
                <HamburgerMenuIcon className="h-5 w-5" aria-hidden />
                <span className="sr-only">Open navigation</span>
              </Button>
              <span className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                Torvus Console
              </span>
            </div>
          </header>

          <main className="flex-1">
            <div className="mx-auto min-h-[calc(100vh-64px)] w-full max-w-screen-2xl px-6 pb-16 pt-6">
              {children}
            </div>
          </main>
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="absolute inset-0 bg-slate-950/60"
            aria-hidden
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative ml-auto flex h-full w-full max-w-xs flex-col border-l border-slate-200/60 bg-slate-100 dark:border-slate-800/70 dark:bg-slate-950">
            <div className="flex h-16 items-center justify-between border-b border-slate-200/60 px-4 dark:border-slate-800/70">
              <span className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                Navigation
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-10 rounded-md px-3"
                onClick={() => setMobileOpen(false)}
              >
                <Cross2Icon className="h-5 w-5" aria-hidden />
                <span className="sr-only">Close navigation</span>
              </Button>
            </div>
            <ScrollArea type="auto" scrollbars="vertical" className="h-[calc(100vh-64px)]">
              <div className="px-4 py-6">{renderSidebar(sidebar, true)}</div>
            </ScrollArea>
          </div>
        </div>
      ) : null}
    </div>
  );
}
