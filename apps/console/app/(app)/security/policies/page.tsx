import type { Metadata } from 'next';
import { Card, Flex, Text } from '@radix-ui/themes';
import { PageHeader } from '../../../../components/PageHeader';

export const metadata: Metadata = {
  title: 'Security policies — Torvus Console'
};

export default function SecurityPoliciesPage() {
  return (
    <div className="flex flex-col gap-6 py-6">
      <PageHeader title="Policies" description="Define guardrails for Torvus security enforcement." />
      <Card variant="surface" className="border border-slate-800/60 bg-slate-950/40">
        <Flex direction="column" gap="2">
          <Text weight="medium">Coming soon</Text>
          <Text size="2" color="gray">
            We are working on automated policy management to centralise controls.
          </Text>
        </Flex>
      </Card>
    </div>
  );
}
