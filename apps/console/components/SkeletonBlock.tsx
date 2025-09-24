import { Box, type BoxProps } from '@radix-ui/themes';
import clsx from 'clsx';

export type SkeletonBlockProps = BoxProps & {
  width?: BoxProps['width'];
  height?: BoxProps['height'];
};

export function SkeletonBlock({
  width = '100%',
  height = '1rem',
  className,
  style,
  ...props
}: SkeletonBlockProps) {
  return (
    <Box
      aria-hidden="true"
      {...props}
      width={width}
      height={height}
      className={clsx('animate-pulse rounded-full', className)}
      style={{
        backgroundColor: 'var(--gray-4)',
        ...style
      }}
    />
  );
}
