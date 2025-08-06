import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  // Global ignores
  {
    ignores: [
      // Dependencies
      'node_modules/**',
      'npm-debug.log*',
      'yarn-debug.log*',
      'yarn-error.log*',
      
      // Build outputs
      'dist/**',
      'build/**',
      'out/**',
      '.next/**',
      '.nuxt/**',
      
      // Cache directories
      '.cache/**',
      '.eslintcache',
      '.parcel-cache/**',
      
      // Coverage and test outputs
      'coverage/**',
      '.nyc_output/**',
      'test-results/**',
      'playwright-report/**',
      '**/*.test.ts',
      '**/*.test.tsx',
      'tests/**',
      
      // Environment and config files
      '.env*',
      'vite.config.ts',
      'postcss.config.js',
      'tailwind.config.js',
      'drizzle.config.ts',
      'eslint.config.js',
      '*.config.js',
      '*.config.ts',
      
      // Documentation and scripts
      'docs/**',
      'scripts/**',
      'migrations/**',
      
      // Generated and UI files
      'client/src/hooks/use-toast.ts',
      'client/src/components/ui/**',
      'server/migrate-*.js',
      'server/test-*.ts',
      'server/tests/**',
      
      // Minified files
      '**/*.min.js',
      '**/*.min.css',
      
      // Generated files
      'generated/**',
      'auto-generated/**',
      
      // Vendor directories
      'vendor/**',
      
      // Archive files
      '**/*.archive.*',
      
      // Backup files
      '**/*.bak',
      '**/*.backup',
    ],
  },
  // Main configuration for all files
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        React: 'readonly',
        JSX: 'readonly',
        // Browser APIs
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        navigator: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Image: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        crypto: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        location: 'readonly',
        history: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Base ESLint rules
      ...js.configs.recommended.rules,

      // TypeScript strict rules as specified
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      // Turn off no-unused-vars for interface/type definitions
      'no-unused-vars': 'off',

      // Prevent direct Prisma exposure in UI
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/server/**', '**/db/**', '**/database/**'],
              message: 'Server-side imports are not allowed in client code',
            },
          ],
        },
      ],

      // React rules
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,

      // React Refresh
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Additional strict TypeScript rules
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',

      // General code quality
      'no-console': 'warn',
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-arrow-callback': 'error',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  // Server-side specific configuration
  {
    files: ['server/**/*.{js,ts}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        // We are explicitly telling ESLint to use the SERVER's tsconfig
        // for any file inside the server/ directory.
        project: './tsconfig.server.json',
        tsconfigRootDir: import.meta.dirname,
        ecmaVersion: 2020,
        sourceType: 'module',
      },
      globals: {
        // Node.js globals
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // Allow console in server code
      'no-console': 'off',
      // Server doesn't need React rules
      'react-refresh/only-export-components': 'off',
      // TypeScript rules still apply
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
    },
  },
  // Configuration files
  {
    files: ['*.config.{js,ts}', '*.config.*.{js,ts}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
    },
    rules: {
      // Configuration files can be more lenient
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'off',
    },
  },
];
