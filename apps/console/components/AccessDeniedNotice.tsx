"use client";

import clsx from 'clsx';
import { Card, Flex, Heading, Text } from '@radix-ui/themes';

export type AccessDeniedNoticeProps = {
  variant?: 'full' | 'card';
  className?: string;
  debugInfo?: { requestId?: string | null; reason?: string | null };
};

export function AccessDeniedNotice({ variant = 'full', className, debugInfo }: AccessDeniedNoticeProps) {
  const isDebugEnv = process.env.NODE_ENV !== 'production';
  const debugLines: string[] = [];
  const reasonMessage = debugInfo?.reason?.trim() ? debugInfo.reason.trim() : null;

  if (isDebugEnv && debugInfo) {
    if (debugInfo.requestId) {
      debugLines.push(`request ${debugInfo.requestId}`);
    }
    if (reasonMessage) {
      debugLines.push(reasonMessage);
    }
  }

  const debugMessage = debugLines.length ? `(${debugLines.join(' · ')})` : null;

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
          {reasonMessage ? (
            <Text size="2" color="gray" align="center" data-testid="access-denied-reason">
              Reason: {reasonMessage}
            </Text>
          ) : null}
          {debugMessage ? (
            <Text size="1" color="gray" align="center" data-testid="access-denied-debug">
              {debugMessage}
            </Text>
          ) : null}
        </Flex>
      </Card>
    );
  }

  return (
    <main className={clsx('unauthorised', className)}>
      <h1>Access denied</h1>
      <p>Torvus Console is restricted to enrolled staff. Contact Security Operations.</p>
      {reasonMessage ? (
        <p className="access-denied-reason" data-testid="access-denied-reason">
          Reason: {reasonMessage}
        </p>
      ) : null}
      {debugMessage ? (
        <p className="access-denied-debug" data-testid="access-denied-debug">
          {debugMessage}
        </p>
      ) : null}
    </main>
  );
}
