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
    files: ['**/*.{ts,tsx}'],
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
    plugins: {
      '@typescript-eslint': tsPlugin,
      '@next/next': nextPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      'no-unused-vars': 'off', // Desactivar la regla base
      '@typescript-eslint/no-unused-vars': [
        'error', 
        { 
          'argsIgnorePattern': '^_',
          'caughtErrorsIgnorePattern': '^_',
        }
      ],
    },
  },

  // Configuración para archivos JavaScript (sin chequeo de tipos)
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
      parser: tsParser, // ts-parser puede manejar JS
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        // Clave: Sin la propiedad 'project' para archivos JS
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      '@next/next': nextPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      'no-unused-vars': 'off', // Desactivar la regla base
      '@typescript-eslint/no-unused-vars': [
        'error', 
        { 
          'argsIgnorePattern': '^_',
          'caughtErrorsIgnorePattern': '^_',
        }
      ],
    },
  },  
  // Aplicar configuración de Prettier al final para sobrescribir reglas de formato
  prettierConfig,
];