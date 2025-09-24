'use client';

import { Button } from '@radix-ui/themes';

export type ScrollToSectionButtonProps = {
  targetId: string;
  label: string;
};

export function ScrollToSectionButton({ targetId, label }: ScrollToSectionButtonProps) {
  return (
    <Button
      color="iris"
      onClick={() => {
        const element = document.getElementById(targetId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          if (element instanceof HTMLElement) {
            element.focus({ preventScroll: true });
          }
        }
      }}
    >
      {label}
    </Button>
  );
}
