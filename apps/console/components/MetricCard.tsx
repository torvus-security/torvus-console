import { Card, Flex, Heading, Text } from '@radix-ui/themes';
import type { ReactNode } from 'react';

interface MetricCardProps {
  title: string;
  description?: string;
  value: ReactNode;
  action?: ReactNode;
}

export function MetricCard({ title, description, value, action }: MetricCardProps) {
  const renderedValue =
    typeof value === 'string' || typeof value === 'number' ? (
      <Text size="7" weight="medium" as="span">
        {value}
      </Text>
    ) : (
      value
    );

  return (
    <Card size="3">
      <Flex direction="column" gap="4">
        <Flex direction="column" gap="1">
          <Heading as="h2" size="3">
            {title}
          </Heading>
          {description ? (
            <Text size="2" color="gray">
              {description}
            </Text>
          ) : null}
        </Flex>
        <Flex direction="column" gap="3">
          {renderedValue}
          {action ?? null}
        </Flex>
      </Flex>
    </Card>
  );
}
