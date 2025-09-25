"use client";

import { Slot } from '@radix-ui/react-slot';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from '../../utils/cn';

export type CardProps = ComponentPropsWithoutRef<'div'> & {
  asChild?: boolean;
};

export const Card = forwardRef<ElementRef<'div'>, CardProps>(({ className, asChild = false, ...props }, ref) => {
  const Component = asChild ? Slot : 'div';

  return (
    <Component
      ref={ref as unknown as ElementRef<'div'>}
      className={cn(
        'rounded-2xl border border-slate-800/60 bg-slate-950/50 shadow-lg shadow-black/20 backdrop-blur-sm',
        'supports-[backdrop-filter]:bg-slate-950/30',
        className
      )}
      {...props}
    />
  );
});

Card.displayName = 'Card';
