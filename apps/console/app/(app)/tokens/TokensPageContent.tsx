'use client';

import { useRef } from 'react';
import { Button } from '@radix-ui/themes';
import { PageHeader } from '../../../components/navigation/page-header';
import {
  PersonalAccessTokensPanel,
  type PersonalAccessTokensPanelHandle
} from '../../profile/PersonalAccessTokensPanel';

export type TokensPageContentProps = {
  displayName: string;
  email: string;
};

export function TokensPageContent({ displayName, email }: TokensPageContentProps) {
  const panelRef = useRef<PersonalAccessTokensPanelHandle>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personal access tokens"
        subtitle="Generate API secrets tied to your staff identity."
        actions={(
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-11">
            <span>
              Signed in as {displayName} ({email})
            </span>
            <Button color="iris" onClick={() => panelRef.current?.openCreate()}>
              Create token
            </Button>
          </div>
        )}
      />

      <PersonalAccessTokensPanel ref={panelRef} showHeader={false} />
    </div>
  );
}
