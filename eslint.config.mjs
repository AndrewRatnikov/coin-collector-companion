// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/*.tsbuildinfo',
      '**/next-env.d.ts',
      'apps/api/src/generated/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Jest transformer, loaded via CommonJS `require()` by Jest itself — not part of the
    // TS project, so the usual no-require-imports/no-undef rules don't apply here.
    files: ['**/test/support/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { require: 'readonly', module: 'writable' },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // Plain Node ESM script for the render-review harness. It runs under Node (URL, fetch,
    // process, ...) and passes callbacks to Playwright's page.evaluate(), which run in the
    // browser (window), so it needs both sets of globals.
    files: ['.claude/render/**/*.mjs'],
    languageOptions: {
      globals: {
        URL: 'readonly',
        fetch: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        AbortSignal: 'readonly',
        window: 'readonly',
      },
    },
  },
  {
    // handleRequest overrides Passport's AuthGuard signature positionally (err, user, info,
    // context, status) — the trailing params after the last used one (`user`) must stay
    // present to match the base signature/call sites, but are otherwise unused.
    files: ['apps/api/src/auth/guards/optional-jwt-auth.guard.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  eslintConfigPrettier,
);
