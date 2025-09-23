"use client";

import clsx from 'clsx';
import { Card, Flex, Heading, Text } from '@radix-ui/themes';

export type AccessDeniedNoticeProps = {
  variant?: 'full' | 'card';
  className?: string;
};

export function AccessDeniedNotice({ variant = 'full', className }: AccessDeniedNoticeProps) {
  if (variant === 'card') {
    return (
      <Card
        size="4"
        variant="surface"
        className={clsx('access-denied-card', className)}
        data-testid="access-denied-card"
      >
        <Flex direction="column" align="center" gap="3">
          <Heading as="h1" size="4">
            Access denied
          </Heading>
          <Text size="2" color="gray" align="center">
            Torvus Console is restricted to enrolled staff. Contact Security Operations.
          </Text>
        </Flex>
      </Card>
    );
  }

  return (
    <main className={clsx('unauthorised', className)}>
      <h1>Access denied</h1>
      <p>Torvus Console is restricted to enrolled staff. Contact Security Operations.</p>
    </main>
  );
}
