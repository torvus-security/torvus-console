"use client";

import { Slot } from '@radix-ui/react-slot';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type Ref } from 'react';
import { cn } from '../../utils/cn';

export type CardProps = ComponentPropsWithoutRef<'div'> & {
  asChild?: boolean;
};

export const Card = forwardRef<ElementRef<'div'>, CardProps>(({ className, asChild = false, ...props }, ref) => {
  const classes = cn(
    'rounded-2xl border border-slate-800/60 bg-slate-950/50 shadow-lg shadow-black/20 backdrop-blur-sm',
    'supports-[backdrop-filter]:bg-slate-950/30',
    className
  );

  if (asChild) {
    return <Slot ref={ref as Ref<HTMLElement>} className={classes} {...props} />;
  }

  return <div ref={ref} className={classes} {...props} />;
});

Card.displayName = 'Card';
