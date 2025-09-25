"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from '../../utils/cn';

export type InputProps = ComponentPropsWithoutRef<'input'>;

export const Input = forwardRef<ElementRef<'input'>, InputProps>(({ className, type = 'text', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      'flex h-10 w-full rounded-lg border border-slate-800/70 bg-slate-950/40 px-3 py-2 text-sm text-slate-100',
      'shadow-inner shadow-black/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
      'focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 placeholder:text-slate-500/80 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
));

Input.displayName = 'Input';
