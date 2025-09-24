import type { ReactNode } from 'react';
import { Box, Grid, ScrollArea } from '@radix-ui/themes';

export type AppShellProps = {
  sidebar: ReactNode;
  children: ReactNode;
};

export function AppShell({ sidebar, children }: AppShellProps) {
  return (
    <Box minHeight="100dvh" display="flex">
      <Grid
        columns={{ initial: '1fr', md: '280px 1fr' }}
        width="100%"
        height="100%"
      >
        <Box display={{ initial: 'none', md: 'flex' }} height="100%">
          <ScrollArea
            type="auto"
            scrollbars="vertical"
            style={{ height: '100%', borderRight: '1px solid var(--gray-5)' }}
          >
            <Box padding="5">{sidebar}</Box>
          </ScrollArea>
        </Box>

        <Box height="100%">
          <ScrollArea type="auto" scrollbars="vertical" style={{ height: '100%' }}>
            <Box
              width="100%"
              paddingX={{ initial: '4', sm: '5' }}
              paddingY="6"
            >
              <Box maxWidth="1240px" marginX="auto">
                {children}
              </Box>
            </Box>
          </ScrollArea>
        </Box>
      </Grid>
    </Box>
  );
}
