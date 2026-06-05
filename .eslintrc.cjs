module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.base.json', './server/tsconfig.json', './client/tsconfig.json'],
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
  },
  ignorePatterns: ['dist/', 'node_modules/', 'workspace/', '*.config.*'],
  overrides: [
    {
      files: ['client/**/*.ts', 'client/**/*.tsx'],
      env: { browser: true, node: false },
      parserOptions: {
        project: './client/tsconfig.json',
      },
      extends: ['plugin:react-hooks/recommended', 'plugin:react-refresh/recommended'],
    },
  ],
};
