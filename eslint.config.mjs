import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc', '**/node_modules', '**/.next'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
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
    rules: {},
  },
];
