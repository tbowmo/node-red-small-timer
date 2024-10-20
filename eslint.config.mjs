import typescriptEslint from '@typescript-eslint/eslint-plugin'
import _import from 'eslint-plugin-import'
import importNewlines from 'eslint-plugin-import-newlines'
import { fixupPluginRules } from '@eslint/compat'
import globals from 'globals'
import tsParser from '@typescript-eslint/parser'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import js from '@eslint/js'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
})

export default [
    ...compat.extends('eslint:recommended', 'plugin:@typescript-eslint/recommended'),
    {
        plugins: {
            '@typescript-eslint': typescriptEslint,
            import: fixupPluginRules(_import),
            'import-newlines': importNewlines,
        },

        languageOptions: {
            globals: {
                ...globals.node,
            },

            parser: tsParser,
            ecmaVersion: 'latest',
            sourceType: 'module',
        },

        rules: {
            'import/order': 'off',
            'eol-last': 'error',
            'comma-dangle': ['warn', 'always-multiline'],

            indent: ['error', 4, {
                SwitchCase: 1,
            }],

            'linebreak-style': ['error', 'unix'],

            quotes: ['warn', 'single', {
                avoidEscape: true,
            }],

            semi: ['warn', 'never'],

            'max-len': ['error', {
                code: 180,
            }],

            'no-console': ['warn'],
            curly: ['error'],
            eqeqeq: ['error'],
            complexity: ['error', 11],

            'import-newlines/enforce': ['error', {
                items: 2,
                'max-len': 180,
                semi: false,
            }],
        },
    },
]
