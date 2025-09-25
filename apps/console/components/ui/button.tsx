"use client";

import { Slot } from '@radix-ui/react-slot';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { tv, type VariantProps } from 'tailwind-variants';
import { cn } from '../../utils/cn';

const buttonStyles = tv({
  base: [
    'inline-flex items-center justify-center gap-2 rounded-lg border border-transparent px-4 py-2 text-sm font-medium',
    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-violet-500',
    'focus-visible:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-50',
    'data-[state=open]:bg-slate-900/60'
  ],
  variants: {
    variant: {
      solid: 'bg-violet-500 text-white shadow hover:bg-violet-400',
      outline:
        'border-slate-700/70 bg-transparent text-slate-100 shadow-sm hover:border-slate-500 hover:bg-slate-900/40',
      ghost: 'bg-transparent text-slate-100 hover:bg-slate-900/50',
      subtle: 'bg-slate-900/60 text-slate-100 shadow-sm hover:bg-slate-900/70',
      link: 'border-transparent bg-transparent px-0 font-semibold text-violet-400 underline-offset-4 hover:underline'
    },
    size: {
      sm: 'h-8 px-3 text-xs',
      md: 'h-10 px-4 text-sm',
      lg: 'h-11 px-6 text-base'
    }
  },
  defaultVariants: {
    variant: 'solid',
    size: 'md'
  }
});

type ButtonVariants = VariantProps<typeof buttonStyles>;

type ButtonElement = ElementRef<'button'>;
type ButtonProps = ButtonVariants & {
  asChild?: boolean;
} & ComponentPropsWithoutRef<'button'>;

export const Button = forwardRef<ButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type = 'button', ...props }, ref) => {
    const Component = asChild ? Slot : 'button';

    return (
      <Component
        ref={ref as unknown as ButtonElement}
        className={cn(buttonStyles({ variant, size }), className)}
        type={type}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export type { ButtonProps };
export { buttonStyles };
