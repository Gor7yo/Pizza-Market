// @ts-check
import { base } from '@market/eslint-config/base';
import globals from 'globals';

export default [
  { ignores: ['eslint.config.mjs', 'dist/**', 'src/generated/**'] },
  ...base,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Nest controllers/handlers routinely use class-based DI and decorators.
    // consistent-type-imports would turn DI constructor types into type-only
    // imports and break emitDecoratorMetadata, so it is disabled here.
    rules: {
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
  {
    // supertest responses (res.body) are untyped by design
    files: ['test/**/*.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },
];
