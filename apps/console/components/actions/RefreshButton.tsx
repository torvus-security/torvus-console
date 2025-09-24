'use client';

import { useTransition } from 'react';
import { Button } from '@radix-ui/themes';
import { useRouter } from 'next/navigation';

export function RefreshButton({ label = 'Refresh' }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      color="iris"
      variant="soft"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
    >
      {pending ? 'Refreshing…' : label}
    </Button>
  );
}
