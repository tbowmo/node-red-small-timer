module.exports = {
    'env': {
        'es2021': true,
        'node': true
    },
    'extends': [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended'
    ],
    'overrides': [
    ],
    'parser': '@typescript-eslint/parser',
    'parserOptions': {
        'ecmaVersion': 'latest',
        'sourceType': 'module'
    },
    'plugins': [
        '@typescript-eslint'
    ],
    'rules': {
        'indent': [
            'error',
            4,
            {
                'SwitchCase': 1,
            }
        ],
        'linebreak-style': [
            'error',
            'unix'
        ],
        'quotes': [
            'error',
            'single'
        ],
        'semi': [
            'error',
            'never'
        ],
        'max-len': [
            'error',
            {
                'code' : 120
            }
        ],
        'no-console': [
            'error'
        ],
        'curly': [
            'error'
        ],
        'eqeqeq': [
            'error'
        ],
        'complexity': [
            'error',
            11
        ]
    }
};
