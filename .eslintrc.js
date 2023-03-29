module.exports = {
  'env': {
    'browser': true,
    'commonjs': true,
    'es2021': true,
  },
  'extends': 'google',
  'overrides': [
  ],
  'parserOptions': {
    'ecmaVersion': 'latest',
    'sourceType': 'module',
  },
  'rules': {
    'max-len': ['error', {'code': 120}],
    'camelcase': 'off',
    'require-jsdoc': 'off',
    'new-cap': 'off',
  },
};
