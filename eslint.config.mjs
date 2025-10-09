import js from '@eslint/js';
import globals from 'globals';
import reactRecommended from 'eslint-plugin-react/configs/recommended.js';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import nextConfig from 'eslint-config-next';

export default [
  // Base JavaScript
  {
    ...js.configs.recommended,
    ignores: ['.next/**', 'node_modules/**', 'dist/**'],
  },

  // Next.js (core-web-vitals)
  ...nextConfig(),

  // TypeScript
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { '@typescript-eslint': typescriptEslint },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
    },
  },

  // React
  {
    ...reactRecommended,
    files: ['**/*.{jsx,tsx}'],
    settings: {
      react: { version: '19.0.0' },
      next: { rootDir: ['.'] },
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/no-unescaped-entities': 'warn',
    },
  },

  // React Hooks
  {
    files: ['**/*.{jsx,tsx}'],
    plugins: { 'react-hooks': reactHooksPlugin },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Global
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
        JSX: 'readonly',
      },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-unused-vars': 'off', // handled by TS
      'no-undef': 'off',       // ✅ React 19 ya no requiere React global
      'prefer-const': 'warn',
      'no-var': 'error',
      'object-shorthand': 'warn',
    },
  },

  // Tests
  {
    files: ['**/*.test.{js,jsx,ts,tsx}'],
    env: { jest: true, 'jest/globals': true },
    rules: { 'no-console': 'off' },
  },
];