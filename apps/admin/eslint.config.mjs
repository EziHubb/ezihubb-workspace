import nextEslintPluginNext from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import react from 'eslint-plugin-react';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

const a11yRules = Object.fromEntries(
  Object.entries(jsxA11y.flatConfigs.recommended.rules).map(([rule, value]) => [
    rule,
    Array.isArray(value) ? ['warn', ...value.slice(1)] : 'warn',
  ]),
);

export default [
  { plugins: { '@next/next': nextEslintPluginNext } },
  ...nx.configs['flat/react-typescript'],
  // `flat/react-typescript` doesn't register eslint-plugin-react-hooks —
  // without this, existing `// eslint-disable-next-line
  // react-hooks/exhaustive-deps` comments in the codebase error with
  // "Definition for rule was not found" instead of the rules actually
  // running (rules-of-hooks/exhaustive-deps were never enforced).
  {
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  // Same gap for react/no-danger — existing `// eslint-disable-next-line
  // react/no-danger` comments reference a rule that was never registered.
  {
    plugins: { react },
    rules: { 'react/no-danger': 'error' },
  },
  {
    files: ['**/*.tsx', '**/*.jsx'],
    plugins: { 'jsx-a11y': jsxA11y },
    rules: a11yRules,
  },
  ...baseConfig,
  {
    ignores: ['.next/**/*'],
  },
];
