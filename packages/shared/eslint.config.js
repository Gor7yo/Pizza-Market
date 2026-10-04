import { base } from '@market/eslint-config/base';

export default [
  { ignores: ['dist/**'] },
  ...base,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
];
