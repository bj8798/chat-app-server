module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: ['google', 'prettier'],
  plugins: ['prettier', 'spellcheck'],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  rules: {
    'prettier/prettier': ['error', { singleQuote: true, parser: 'flow' }],
    'spellcheck/spell-checker': [
      1,
      {
        comments: true,
        strings: true,
        identifiers: true,
        lang: 'en_US',
        skipWords: [
          'dict',
          'aff',
          'hunspellchecker',
          'hunspell',
          'utils',
          'cors',
        ],
        skipIfMatch: [
          '[^s]*://[^s]*',
          '^[-\\w]+/[-\\w\\.]+$', //For MIME Types
        ],
        skipWordIfMatch: [
          '^foobar.*$', // words that begin with foobar will not be checked
        ],
        minLength: 4,
      },
    ],
  },
};
