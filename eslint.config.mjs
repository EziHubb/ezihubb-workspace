import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    // next-env.d.ts is Next.js-generated boilerplate (regenerated on every
    // build, "should not be edited" per its own header comment) that
    // imports its own dist output via a relative path — not a real
    // cross-project dependency.
    ignores: ['**/dist', '**/out-tsc', '**/node_modules', '**/.next', '**/next-env.d.ts'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          // eslint/tailwind configs are build-tool wiring, not application
          // source — their cross-project requires are intentional, not
          // architecture debt.
          allow: [
            '^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$',
            '^.*/tailwind\\.config(\\.[cm]?js)?$',
          ],
          depConstraints: [
            // client app: can only import from shared libs (not other apps)
            {
              sourceTag: 'scope:client',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            // admin app: can only import from shared libs (not other apps)
            {
              sourceTag: 'scope:admin',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            // api app: can only import types/constants from shared libs (no UI)
            {
              sourceTag: 'scope:api',
              onlyDependOnLibsWithTags: ['type:types', 'type:constants'],
            },
            // shared libs can only import from other shared libs
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            // apps cannot import from other apps
            {
              sourceTag: 'type:app',
              bannedExternalImports: [],
              notDependOnLibsWithTags: ['type:app'],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts', '**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs'],
    rules: {
      // A leading underscore is the standard TS/ESLint-ecosystem convention
      // for "intentionally unused" — an interface-required parameter not
      // needed by this implementation, a destructured field discarded on
      // purpose, a caught error nobody inspects. Without this, the only way
      // to silence the rule is a `void x;` no-op read, which doesn't
      // communicate intent and invites copy-pasting past a genuinely unused
      // (i.e. forgotten) variable.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
];
