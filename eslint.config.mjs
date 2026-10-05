// Lint del proyecto: lo recomendado de JavaScript y TypeScript, y las reglas de los hooks de React.
// El formato no es cosa del lint: lo pone Prettier (.prettierrc.json).
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['.next/', 'node_modules/', 'out/', 'next-env.d.ts', 'captures/', 'audit-*/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: globals.browser },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Un catch vacío es a propósito: el almacenamiento del navegador puede faltar y no pasa nada.
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['scripts/**/*.mjs', '*.mjs', '*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
);
