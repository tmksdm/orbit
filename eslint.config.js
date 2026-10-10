// ESLint flat config for Orbit (Stage 0).
// Base: eslint-config-expo (React Native + TypeScript rules).
// eslint-config-prettier is applied last to disable stylistic rules
// that would conflict with Prettier (formatting lives in Prettier only).
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

// eslint-config-expo/flat may export an array of flat config entries;
// spread it so the top-level config contains only plain config objects.
const expoEntries = Array.isArray(expoConfig) ? expoConfig : [expoConfig];

module.exports = [
  {
    ignores: ['node_modules/', '.expo/', 'android/', 'ios/', 'coverage/', 'dist/', '.sync/', 'experiments/'],
  },
  ...expoEntries,
  prettierConfig,
];
