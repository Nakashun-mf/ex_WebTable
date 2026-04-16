import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Browser globals
        document: 'readonly',
        window: 'readonly',
        navigator: 'readonly',
        requestAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        NodeFilter: 'readonly',
        Set: 'readonly',
        // Chrome extension globals
        chrome: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'prefer-const': 'warn',
      'no-var': 'error',
    },
  },
];
