'use client';

import { Button } from '@radix-ui/themes';

export function InviteStaffButton() {
  return (
    <Button
      color="iris"
      onClick={() => {
        window.alert('Staff invitation flow coming soon.');
      }}
    >
      Add staff
    </Button>
  );
}
