// @ts-check

import eslint from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import prettier from 'eslint-plugin-prettier'
import security from 'eslint-plugin-security'
import tseslint from 'typescript-eslint'

export default tseslint.config(
    eslint.configs.recommended,
    security.configs.recommended,
    tseslint.configs.recommended,
    tseslint.configs.stylistic,
    eslintConfigPrettier,
    {
        plugins: {
            prettier,
        },
        rules: {
            'prettier/prettier': 'error',
        },
    },
)
