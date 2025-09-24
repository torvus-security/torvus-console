import type { ReactNode } from 'react';
import { Box, Grid, ScrollArea } from '@radix-ui/themes';

export type AppShellProps = {
  sidebar: ReactNode;
  children: ReactNode;
};

export function AppShell({ sidebar, children }: AppShellProps) {
  return (
    <Box minHeight="100dvh">
      <Grid
        columns={{ initial: '1fr', md: '280px 1fr' }}
        width="100%"
        height="100%"
        style={{ minHeight: '100dvh' }}
      >
        <Box className="hidden h-full md:block">
          <ScrollArea
            type="auto"
            scrollbars="vertical"
            style={{ height: '100%', borderRight: '1px solid var(--gray-5)' }}
          >
            <Box p="5">{sidebar}</Box>
          </ScrollArea>
        </Box>

        <Box height="100%">
          <ScrollArea type="auto" scrollbars="vertical" style={{ height: '100%' }}>
            <Box width="100%" className="w-full px-4 py-6 sm:px-5">
              <Box className="mx-auto" style={{ maxWidth: '1240px' }}>
                {children}
              </Box>
            </Box>
          </ScrollArea>
        </Box>
      </Grid>
    </Box>
  );
}
