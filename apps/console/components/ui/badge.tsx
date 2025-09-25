"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { tv, type VariantProps } from 'tailwind-variants';
import { cn } from '../../utils/cn';

const badgeStyles = tv({
  base: [
    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide',
    'transition-colors'
  ],
  variants: {
    variant: {
      default: 'border-violet-500/40 bg-violet-500/15 text-violet-200',
      outline: 'border-slate-600/70 bg-transparent text-slate-200',
      subtle: 'border-transparent bg-slate-900/60 text-slate-100'
    }
  },
  defaultVariants: {
    variant: 'default'
  }
});

export type BadgeProps = ComponentPropsWithoutRef<'span'> & VariantProps<typeof badgeStyles>;

export const Badge = forwardRef<ElementRef<'span'>, BadgeProps>(({ className, variant, ...props }, ref) => (
  <span ref={ref} className={cn(badgeStyles({ variant }), className)} {...props} />
));

Badge.displayName = 'Badge';

export { badgeStyles };
