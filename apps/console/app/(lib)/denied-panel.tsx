import Link from 'next/link';
import { Button, Card, Flex, Heading, Text } from '@radix-ui/themes';

export type DeniedPanelProps = {
  title?: string;
  message?: string;
  actionLabel?: string;
  href?: string;
};

export function DeniedPanel({
  title = 'Access denied',
  message = 'You do not have permission to view this page.',
  actionLabel = 'Return home',
  href = '/'
}: DeniedPanelProps) {
  return (
    <Card size="3" variant="surface" role="alert" aria-live="polite">
      <Flex direction="column" gap="3">
        <Heading as="h2" size="3">
          {title}
        </Heading>
        <Text size="2" color="gray">
          {message}
        </Text>
        <Flex>
          <Button color="iris" asChild>
            <Link href={href}>{actionLabel}</Link>
          </Button>
        </Flex>
      </Flex>
    </Card>
  );
}
