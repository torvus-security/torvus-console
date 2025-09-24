import { Card, Flex, Heading, Text } from '@radix-ui/themes';
import type { ReactNode } from 'react';

export type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Card role="status" aria-live="polite">
      <Flex direction="column" gap="3">
        <div>
          <Heading as="h2" size="4">
            {title}
          </Heading>
          <Text as="p" size="2" color="gray" mt="1">
            {description}
          </Text>
        </div>
        {action ? <div>{action}</div> : null}
      </Flex>
    </Card>
  );
}
