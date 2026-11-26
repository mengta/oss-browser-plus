'use strict';

// 工具链现代化 批次一：ESLint 9 flat config（自维护等效规则集，design D-01/D-02/D-03）
// 上游：.codeartsdoer/specs/toolchain-modernization/{spec,design,tasks}.md
// 规则来源：批次零 golden 快照（docs/upgrade-snapshots/TM-B0/）中全部 115 条非 off 规则逐条复刻；
// 另含 35 条置 0 豁免（golden 中已为 off，无需显式重申）与 semi: error（golden 原值语义）。
// 等效性验证：npx eslint --print-config 快照 diff（tools/normalize-config.mjs 归一化，tasks 2.6）。

const globals = require('globals');

// B0 全局忽略（复刻 .eslintrc.json ignorePatterns 七项）
const ignores = {
  ignores: [
    'static/',
    'vendor/',
    'dist/',
    'node_modules/',
    'test-results/',
    'playwright-report/',
    'build/',
  ],
};

// B1 源码块（app/** 与 test/** 的 js/mjs）
const sourceBlock = {
  files: ['app/**/*.js', 'app/**/*.mjs', 'test/**/*.js', 'test/**/*.mjs'],
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    globals: {
      ...globals.browser,
      ...globals.node,
      ...globals.es2021,
      angular: 'readonly',
      moment: 'readonly',
      dayjs: 'readonly',
      CodeMirror: 'readonly',
      Global: 'readonly',
      openExternal: 'readonly',
      $: 'writable',
      Clipboard: 'readonly',
      fs: 'readonly',
      path: 'readonly',
      os: 'readonly',
      request: 'readonly',
      custom: 'writable',
      OSS: 'readonly',
      ALY: 'readonly',
      showdown: 'readonly',
      openDevTools: 'readonly',
      gInstallAndRestart: 'readonly',
      ImportConfigParser: 'readonly',
    },
  },
  rules: {
      "semi": [
        2,
        "always"
      ],
      "max-len": [
        "warn",
        200,
        2,
        {
          "ignorePattern": "data:image/\\w+;base64,",
          "ignoreComments": false,
          "ignoreTrailingComments": true,
          "ignoreUrls": true,
          "ignoreStrings": true,
          "ignoreRegExpLiterals": true,
          "ignoreTemplateLiterals": true
        }
      ],
      "no-alert": [
        "error"
      ],
      "no-trailing-spaces": [
        "error",
        {
          "skipBlankLines": true,
          "ignoreComments": true
        }
      ],
      "comma-spacing": [
        "error",
        {
          "before": false,
          "after": true
        }
      ],
      "padded-blocks": [
        "error",
        "never"
      ],
      "no-multiple-empty-lines": [
        "error",
        {
          "max": 1,
          "maxBOF": 0,
          "maxEOF": 0
        }
      ],
      "no-delete-var": [
        "error"
      ],
      "no-label-var": [
        "error"
      ],
      "no-shadow-restricted-names": [
        "error"
      ],
      "no-undef": [
        "error"
      ],
      "no-undef-init": [
        "error"
      ],
      "no-use-before-define": [
        "error",
        {
          "functions": false,
          "classes": false,
          "variables": false
        }
      ],
      "array-bracket-spacing": [
        "error",
        "never"
      ],
      "block-spacing": [
        "error",
        "always"
      ],
      "comma-style": [
        "error",
        "last"
      ],
      "computed-property-spacing": [
        "error",
        "never"
      ],
      "func-call-spacing": [
        "error",
        "never"
      ],
      "function-paren-newline": [
        "error",
        "consistent"
      ],
      "jsx-quotes": [
        "error",
        "prefer-double"
      ],
      "key-spacing": [
        "error",
        {
          "beforeColon": false,
          "afterColon": true
        }
      ],
      "keyword-spacing": [
        "error",
        {
          "before": true,
          "after": true,
          "overrides": {
            "return": {
              "after": true
            },
            "throw": {
              "after": true
            },
            "case": {
              "after": true
            }
          }
        }
      ],
      "new-cap": [
        "error",
        {
          "newIsCap": true,
          "newIsCapExceptions": [],
          "capIsNew": false,
          "capIsNewExceptions": [
            "Immutable.Map",
            "Immutable.Set",
            "Immutable.List"
          ],
          "properties": true
        }
      ],
      "new-parens": [
        "error"
      ],
      "newline-per-chained-call": [
        "warn",
        {
          "ignoreChainWithDepth": 4
        }
      ],
      "no-array-constructor": [
        "error"
      ],
      "no-bitwise": [
        "warn"
      ],
      "no-mixed-operators": [
        "error",
        {
          "groups": [
            [
              "%",
              "**"
            ],
            [
              "%",
              "+"
            ],
            [
              "%",
              "-"
            ],
            [
              "%",
              "*"
            ],
            [
              "%",
              "/"
            ],
            [
              "**",
              "+"
            ],
            [
              "**",
              "-"
            ],
            [
              "**",
              "*"
            ],
            [
              "**",
              "/"
            ],
            [
              "&",
              "|",
              "^",
              "~",
              "<<",
              ">>",
              ">>>"
            ],
            [
              "==",
              "!=",
              "===",
              "!==",
              ">",
              ">=",
              "<",
              "<="
            ],
            [
              "&&",
              "||"
            ],
            [
              "in",
              "instanceof"
            ]
          ],
          "allowSamePrecedence": false
        }
      ],
      "no-mixed-spaces-and-tabs": [
        "error"
      ],
      "no-multi-assign": [
        "error"
      ],
      "no-nested-ternary": [
        "error"
      ],
      "no-new-object": [
        "error"
      ],
      "no-tabs": [
        "error"
      ],
      "no-whitespace-before-property": [
        "error"
      ],
      "object-curly-spacing": [
        "error",
        "always"
      ],
      "object-property-newline": [
        "error",
        {
          "allowAllPropertiesOnSameLine": true,
          "allowMultiplePropertiesPerLine": false
        }
      ],
      "one-var-declaration-per-line": [
        "error",
        "always"
      ],
      "quote-props": [
        "error",
        "as-needed",
        {
          "keywords": false,
          "unnecessary": true,
          "numbers": false
        }
      ],
      "semi-spacing": [
        "error",
        {
          "before": false,
          "after": true
        }
      ],
      "semi-style": [
        "error",
        "last"
      ],
      "space-before-blocks": [
        "error"
      ],
      "space-in-parens": [
        "error",
        "never"
      ],
      "space-infix-ops": [
        "error"
      ],
      "space-unary-ops": [
        "error",
        {
          "words": true,
          "nonwords": false,
          "overrides": {}
        }
      ],
      "switch-colon-spacing": [
        "error",
        {
          "after": true,
          "before": false
        }
      ],
      "template-tag-spacing": [
        "error",
        "never"
      ],
      "for-direction": [
        "error"
      ],
      "getter-return": [
        "error",
        {
          "allowImplicit": true
        }
      ],
      "no-async-promise-executor": [
        "error"
      ],
      "no-await-in-loop": [
        "warn"
      ],
      "no-compare-neg-zero": [
        "error"
      ],
      "no-cond-assign": [
        "error",
        "always"
      ],
      "no-constant-condition": [
        "warn"
      ],
      "no-debugger": [
        "error"
      ],
      "no-dupe-args": [
        "error"
      ],
      "no-dupe-keys": [
        "error"
      ],
      "no-duplicate-case": [
        "error"
      ],
      "no-empty-character-class": [
        "error"
      ],
      "no-ex-assign": [
        "error"
      ],
      "no-extra-boolean-cast": [
        "error"
      ],
      "no-extra-semi": [
        "error"
      ],
      "no-func-assign": [
        "error"
      ],
      "no-inner-declarations": [
        "error"
      ],
      "no-invalid-regexp": [
        "error"
      ],
      "no-irregular-whitespace": [
        "error"
      ],
      "no-misleading-character-class": [
        "error"
      ],
      "no-obj-calls": [
        "error"
      ],
      "no-prototype-builtins": [
        "error"
      ],
      "no-regex-spaces": [
        "error"
      ],
      "no-sparse-arrays": [
        "error"
      ],
      "no-template-curly-in-string": [
        "warn"
      ],
      "no-unexpected-multiline": [
        "error"
      ],
      "no-unreachable": [
        "error"
      ],
      "no-unsafe-finally": [
        "error"
      ],
      "no-unsafe-negation": [
        "error"
      ],
      "use-isnan": [
        "error"
      ],
      "valid-typeof": [
        "error",
        {
          "requireStringLiterals": true
        }
      ],
      "array-callback-return": [
        "error",
        {
          "allowImplicit": true,
          "checkForEach": false
        }
      ],
      "dot-location": [
        "error",
        "property"
      ],
      "no-caller": [
        "error"
      ],
      "no-case-declarations": [
        "error"
      ],
      "no-empty-function": [
        "error",
        {
          "allow": [
            "arrowFunctions",
            "functions",
            "methods"
          ]
        }
      ],
      "no-empty-pattern": [
        "error"
      ],
      "no-eval": [
        "error"
      ],
      "no-extend-native": [
        "error"
      ],
      "no-extra-bind": [
        "error"
      ],
      "no-extra-label": [
        "error"
      ],
      "no-floating-decimal": [
        "error"
      ],
      "no-global-assign": [
        "error",
        {
          "exceptions": []
        }
      ],
      "no-implied-eval": [
        "error"
      ],
      "no-iterator": [
        "error"
      ],
      "no-labels": [
        "warn",
        {
          "allowLoop": false,
          "allowSwitch": false
        }
      ],
      "no-lone-blocks": [
        "error"
      ],
      "no-multi-spaces": [
        "error",
        {
          "ignoreEOLComments": false
        }
      ],
      "no-multi-str": [
        "error"
      ],
      "no-new": [
        "error"
      ],
      "no-new-func": [
        "error"
      ],
      "no-new-wrappers": [
        "error"
      ],
      "no-octal": [
        "error"
      ],
      "no-octal-escape": [
        "error"
      ],
      "no-proto": [
        "error"
      ],
      "no-return-assign": [
        "error",
        "always"
      ],
      "no-script-url": [
        "error"
      ],
      "no-self-assign": [
        "error"
      ],
      "no-self-compare": [
        "error"
      ],
      "no-sequences": [
        "error"
      ],
      "no-unused-expressions": [
        "error",
        {
          "allowShortCircuit": true,
          "allowTernary": true,
          "allowTaggedTemplates": true,
          "enforceForJSX": false
        }
      ],
      "no-unused-labels": [
        "error"
      ],
      "no-useless-catch": [
        "error"
      ],
      "no-useless-concat": [
        "error"
      ],
      "no-useless-escape": [
        "error"
      ],
      "no-void": [
        "error"
      ],
      "no-with": [
        "error"
      ],
      "wrap-iife": [
        "error",
        "any",
        {
          "functionPrototypeMethods": false
        }
      ],
      "yoda": [
        "warn"
      ]
    },
};

// P2：规则预设（单一来源 = sourceBlock.rules），供 Vue SFC 块复用
const baseRules = sourceBlock.rules;

// B2 test 放宽块（复刻 .eslintrc.json overrides 语义）
const testBlock = {
  files: ['test/**/*.js', 'test/**/*.mjs'],
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    globals: {
      localStorage: 'readonly',
      navigator: 'readonly',
      angular: 'readonly',
      moment: 'readonly',
      dayjs: 'readonly',
    },
  },
};

// P0-22 preload 块（CommonJS + Node/Electron 宿主全局；仅追加，不改既有块语义）
const preloadBlock = {
  files: ['app/preload/**/*.js'],
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'commonjs',
    globals: {
      window: 'readonly',
      process: 'readonly',
      console: 'readonly',
      URL: 'readonly',
      fetch: 'readonly',
      AbortController: 'readonly',
      Buffer: 'readonly',
      setTimeout: 'readonly',
      clearTimeout: 'readonly',
      module: 'readonly',
      require: 'readonly',
      __dirname: 'readonly',
      __filename: 'readonly',
      global: 'readonly',
    },
  },
};

// B1-05 Vue SFC 块（仅追加；既有块语义不变）
const vueEslintParser = require('vue-eslint-parser');
const vuePlugin = require('eslint-plugin-vue');

const vueBlock = {
  files: ['app/renderer/**/*.vue'],
  plugins: { vue: vuePlugin },
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parser: vueEslintParser,
    parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    globals: {
      ...globals.browser,
      ...globals.node,
      ...globals.es2021,
    },
  },
  // 继承 baseRules 的正确性子集（no-undef/no-unused-vars/no-eval/no-debugger 等）；
  // 纯格式规则不下发到 SFC，避免因历史风格差异产生大批非缺陷报错（登记于 docs/metrics.md）
  rules: {
    semi: baseRules['semi'],
    'no-undef': baseRules['no-undef'],
    'no-unused-vars': 'warn',
    'no-use-before-define': baseRules['no-use-before-define'],
    'no-eval': baseRules['no-eval'],
    'no-implied-eval': baseRules['no-implied-eval'],
    'no-debugger': baseRules['no-debugger'],
    'no-console': 'warn',
    'no-dupe-args': baseRules['no-dupe-args'],
    'no-dupe-keys': baseRules['no-dupe-keys'],
    'no-unreachable': baseRules['no-unreachable'],
    'no-cond-assign': baseRules['no-cond-assign'],
    'no-constant-condition': baseRules['no-constant-condition'],
    'no-self-assign': baseRules['no-self-assign'],
    'no-unsafe-finally': baseRules['no-unsafe-finally'],
    'no-func-assign': baseRules['no-func-assign'],
    'no-obj-calls': baseRules['no-obj-calls'],
    'valid-typeof': baseRules['valid-typeof'],
    'vue/no-bare-strings-in-template': 'warn',
  },
};

// P2：主进程 CommonJS 块（main.js/server.js/gen.js/node/**）——此前完全未被 lint 覆盖
const nodeSourceBlock = {
  files: ['main.js', 'server.js', 'gen.js', 'node/**/*.js'],
  // 生成代码与第三方测试脚本豁免静态规则（crc64 pure-js 为 emscripten 产物，两项均登记 docs/metrics.md）
  ignores: [
    'node/crc64/pure-js/**',
    'node/crc64/cpp-addon/**',
    'node/crc64/electron-crc64-prebuild/**',
    'node/ossstore/test/**',
  ],
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'commonjs',
    globals: {
      ...globals.node,
      ...globals.browser,
      ...globals.es2021,
      // P6 前主进程 capability 仍依赖 angular stub（去化在 P6 收口）
      angular: 'readonly',
    },
  },
  rules: {
    'no-undef': 'error',
    'no-unused-vars': 'warn',
    'no-eval': 'error',
    'no-debugger': 'error',
    'no-console': 'warn',
    'no-dupe-keys': 'error',
    'no-unreachable': 'error',
  },
};

// P2：构建/工具脚本块（ESM：build.mjs/tools/**）
const scriptsBlock = {
  files: ['build.mjs', 'tools/**/*.mjs'],
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    globals: {
      ...globals.node,
      // tools 内含 page.evaluate 内联浏览器上下文代码
      ...globals.browser,
      ...globals.es2021,
    },
  },
  rules: {
    'no-undef': 'error',
    'no-unused-vars': 'warn',
    'no-eval': 'error',
    'no-debugger': 'error',
    'no-console': 'off',
    'no-dupe-keys': 'error',
    'no-unreachable': 'error',
  },
};

module.exports = [
  ignores,
  sourceBlock,
  testBlock,
  preloadBlock,
  vueBlock,
  nodeSourceBlock,
  scriptsBlock,
];
