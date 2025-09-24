'use client';

import { useRef } from 'react';
import { Button, Flex, Text } from '@radix-ui/themes';
import { PageHeader } from '../../components/PageHeader';
import {
  PersonalAccessTokensPanel,
  type PersonalAccessTokensPanelHandle
} from '../profile/PersonalAccessTokensPanel';

export type TokensPageContentProps = {
  displayName: string;
  email: string;
};

export function TokensPageContent({ displayName, email }: TokensPageContentProps) {
  const panelRef = useRef<PersonalAccessTokensPanelHandle>(null);

  return (
    <>
      <PageHeader
        title="Personal access tokens"
        subtitle="Generate API secrets tied to your staff identity."
        actions={(
          <Flex align="center" gap="3" wrap="wrap">
            <Text size="2" color="gray">
              Signed in as {displayName} ({email})
            </Text>
            <Button color="iris" onClick={() => panelRef.current?.openCreate()}>
              Create token
            </Button>
          </Flex>
        )}
      />

      <PersonalAccessTokensPanel ref={panelRef} showHeader={false} />
    </>
  );
}
