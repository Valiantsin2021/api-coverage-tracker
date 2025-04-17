import prettier from 'eslint-config-prettier'
import jsdoc from 'eslint-plugin-jsdoc'
import noFloatingPromise from 'eslint-plugin-no-floating-promise'
import playwright from 'eslint-plugin-playwright'
import globals from 'globals'

export default [
  {
    plugins: { prettier, playwright, jsdoc, noFloatingPromise },
    files: ['**/*.spec.js', 'utils/**/*.js', 'utils/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser
      }
    },
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'playwright/no-conditional-in-test': 'off',
      'playwright/expect-expect': 'off',
      'playwright/no-focused-test': 'error',
      'playwright/require-soft-assertions': 'warn',
      'no-console': 'warn',
      'no-useless-escape': 'off',
      'no-empty-pattern': 'off',
      'noFloatingPromise/no-floating-promise': 'error',
      'no-multiple-empty-lines': ['error', { max: 1 }],
      'space-before-function-paren': ['error', { anonymous: 'always', named: 'never', asyncArrow: 'always' }],
      'no-eval': 'error',
      'no-multi-spaces': 'error',
      'no-new': 'warn',
      'no-return-assign': 'warn',
      'comma-dangle': ['error', 'never'],
      strict: ['error', 'global'],
      'func-style': ['warn', 'expression'],
      'no-new-func': 'error',
      'no-param-reassign': 'error',
      'prefer-arrow-callback': 'error',
      'arrow-body-style': ['error', 'as-needed'],
      'no-invalid-this': 'error',
      'prefer-destructuring': ['warn', { array: true, object: true }, { enforceForRenamedProperties: true }],
      'no-implied-eval': 'error',
      eqeqeq: 'error',
      'no-with': 'error',
      'func-call-spacing': ['error', 'never'],
      'new-cap': ['error', { newIsCap: true }],
      'new-parens': 'error',
      quotes: ['warn', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
      'arrow-spacing': ['error', { before: true, after: true }],
      'no-var': 'warn',
      'no-unused-vars': ['warn', { vars: 'local' }],
      'no-prototype-builtins': 'off'
    }
  }
]
