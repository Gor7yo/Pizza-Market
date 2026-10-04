// @ts-check
import { base } from '@market/eslint-config/base';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
      'eslint.config.mjs',
    ],
  },
  ...nextVitals,
  // shared TypeScript rules (typescript-eslint recommendedTypeChecked + project rules)
  ...base,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // MobX stores are created with makeAutoObservable(..., { autoBind: true }),
      // so passing store methods as callbacks (onClick={cart.clear}) is safe.
      '@typescript-eslint/unbound-method': 'off',
    },
  },
];
