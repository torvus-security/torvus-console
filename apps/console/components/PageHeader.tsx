'use client';

import type { ReactNode } from 'react';
import { Box, Flex, Heading, Separator, Text } from '@radix-ui/themes';

export type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  headingId?: string;
};

export function PageHeader({ title, description, actions, headingId }: PageHeaderProps) {
  return (
    <Box mb="5">
      <Flex
        direction={{ initial: 'column', sm: 'row' }}
        align={{ initial: 'start', sm: 'center' }}
        justify="between"
        gap="4"
        wrap="wrap"
      >
        <Box>
          <Heading as="h1" size="6" id={headingId}>
            {title}
          </Heading>
          {description ? (
            <Text size="2" color="gray" mt="2">
              {description}
            </Text>
          ) : null}
        </Box>
        {actions ? (
          <Flex
            align="center"
            justify={{ initial: 'start', sm: 'end' }}
            gap="3"
            width={{ initial: '100%', sm: 'auto' }}
          >
            {actions}
          </Flex>
        ) : null}
      </Flex>
      <Separator my="4" size="4" />
    </Box>
  );
}
