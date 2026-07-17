import type { Config } from 'tailwindcss';
import baseConfig from '@school-erp/config/tailwind';

const config: Config = {
  ...baseConfig,
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    ...baseConfig.theme,
    extend: {
      ...baseConfig.theme?.extend,
    },
  },
  plugins: [require('@tailwindcss/forms')],
};

export default config;
