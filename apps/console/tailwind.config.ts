import type { Config } from 'tailwindcss';
import {
  amber,
  crimson,
  grass,
  gray,
  grayDark,
  indigo,
  indigoDark,
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
        gray: {
          1: gray.gray1,
          2: gray.gray2,
          3: gray.gray3,
          4: gray.gray4,
          5: gray.gray5,
          6: gray.gray6,
          7: gray.gray7,
          8: gray.gray8,
          9: gray.gray9,
          10: gray.gray10,
          11: gray.gray11,
          12: gray.gray12,
          dark1: grayDark.gray1,
          dark2: grayDark.gray2,
          dark3: grayDark.gray3,
          dark4: grayDark.gray4,
          dark5: grayDark.gray5,
          dark6: grayDark.gray6,
          dark7: grayDark.gray7,
          dark8: grayDark.gray8,
          dark9: grayDark.gray9,
          dark10: grayDark.gray10,
          dark11: grayDark.gray11,
          dark12: grayDark.gray12
        },
        indigo: {
          1: indigo.indigo1,
          2: indigo.indigo2,
          3: indigo.indigo3,
          4: indigo.indigo4,
          5: indigo.indigo5,
          6: indigo.indigo6,
          7: indigo.indigo7,
          8: indigo.indigo8,
          9: indigo.indigo9,
          10: indigo.indigo10,
          11: indigo.indigo11,
          12: indigo.indigo12,
          dark1: indigoDark.indigo1,
          dark2: indigoDark.indigo2,
          dark3: indigoDark.indigo3,
          dark4: indigoDark.indigo4,
          dark5: indigoDark.indigo5,
          dark6: indigoDark.indigo6,
          dark7: indigoDark.indigo7,
          dark8: indigoDark.indigo8,
          dark9: indigoDark.indigo9,
          dark10: indigoDark.indigo10,
          dark11: indigoDark.indigo11,
          dark12: indigoDark.indigo12
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
