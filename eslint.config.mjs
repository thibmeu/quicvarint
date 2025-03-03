// @ts-check

import eslint from '@eslint/js';
import security from 'eslint-plugin-security'
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  security.configs.recommended,
  tseslint.configs.recommended,
  tseslint.configs.stylistic,
);