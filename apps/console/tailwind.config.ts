import type { Config } from 'tailwindcss';
import {
  amber,
  crimson,
  grass,
  red,
  ruby,
  sky,
  slate,
  slateDark
} from '@radix-ui/colors';

type Palette = Record<string, string>;

function pickScale(prefix: string, values: Palette): Record<number, string> {
  const step = (index: number) => values[`${prefix}${index}`];
  return {
    50: step(1),
    100: step(2),
    200: step(3),
    300: step(4),
    400: step(5),
    500: step(6),
    600: step(7),
    700: step(8),
    800: step(9),
    900: step(10),
    950: step(12)
  };
}

const config: Config = {
  darkMode: ['class', '[data-theme="torvus-staff-dark"]'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        slate: {
          50: slate.slate1,
          100: slate.slate2,
          200: slate.slate3,
          300: slate.slate4,
          400: slate.slate5,
          500: slate.slate6,
          600: slate.slate7,
          700: slateDark.slate6,
          800: slateDark.slate5,
          900: slateDark.slate4,
          950: slateDark.slate2
        },
        emerald: pickScale('grass', grass),
        sky: pickScale('sky', sky),
        amber: pickScale('amber', amber),
        rose: pickScale('ruby', ruby),
        crimson: pickScale('crimson', crimson),
        red: pickScale('red', red)
      }
    }
  },
  plugins: []
};

export default config;
