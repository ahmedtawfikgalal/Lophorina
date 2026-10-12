import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'public/mediapipe/', 'node_modules/', 'context-00/'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  {
    files: ['src/**', 'tests/**'],
    languageOptions: { globals: { chrome: 'readonly', self: 'readonly' } },
  },
  {
    files: ['scripts/**', '*.config.*'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        fetch: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        // referenced inside page.evaluate / waitForFunction callbacks, which run in the browser
        document: 'readonly',
        chrome: 'readonly',
        crypto: 'readonly',
        performance: 'readonly',
      },
    },
  },
);
