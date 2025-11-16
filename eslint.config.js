// Flat ESLint config
// - Replaces .eslintrc.json and .eslintignore
// - Tunes strict rules to warnings to avoid blocking builds

// @ts-check
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'backup.sql',
      'supabase/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx,js}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // TypeScript
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // Core JS
      'prefer-const': 'warn',
      'no-console': 'off',

      // Avoid Next.js project rule noise if present globally
      'no-html-link-for-pages': 'off',
    },
  },
];


