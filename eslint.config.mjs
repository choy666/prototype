// eslint.config.mjs
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import globals from 'globals';
import nextPlugin from '@next/eslint-plugin-next';
import prettierConfig from 'eslint-config-prettier';

export default [
  // Ignorar archivos
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      '**/*.d.ts',
      '**/*.config.js',
      '**/.vercel/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/public/**',
    ],
  },

  // Configuración base de JavaScript/TypeScript
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
        React: 'readonly',
        JSX: 'readonly',
        NodeJS: 'readonly',
      },
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        project: './tsconfig.json',
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
      next: {
        rootDir: ['./'],
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      '@next/next': nextPlugin,
    },
    rules: {
      // Reglas base
      ...js.configs.recommended.rules,
      
      // Reglas de TypeScript
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/ban-ts-comment': 'warn',
      
      // Reglas de React/Next.js
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      '@next/next/no-html-link-for-pages': 'error',
      '@next/next/no-img-element': 'warn',
      '@next/next/no-sync-scripts': 'error',
      
      // Reglas de JavaScript
      'no-unused-vars': 'off', // Desactivada en favor de @typescript-eslint/no-unused-vars
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // Reglas específicas para archivos de configuración
  {
    files: ['**/*.config.{js,ts}'],
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
    },
  },

  // Aplicar configuración de Prettier al final
  {
    ...prettierConfig,
    rules: {
      ...prettierConfig.rules,
      // Sobrescribir reglas específicas de Prettier si es necesario
    },
  },
];
