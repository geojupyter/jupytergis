import { defineConfig, globalIgnores } from "eslint/config";

import eslint from "@eslint/js";
import tseslint from 'typescript-eslint';

export default defineConfig([
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    }
  },
  { files: ['**/*.{ts,tsx}'], },
  globalIgnores([
    "**/node_modules",
    "dist",
    "coverage",
    "tests",
    "ui-tests",
    "**/build/",
    "examples/",
    "packages/base/rasterlayer_gallery",
    ".nx",
    "**/*.js",
    "**/*.d.ts"
  ]),
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "interface",
          format: ["PascalCase"],
          custom: {
            regex: "^I[A-Z]",
            match: true,
          },
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          args: "none",
          varsIgnorePattern: "^_$"
        }
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-use-before-define": "off",
      "curly": ["error", "all"],
      "eqeqeq": "error",
      "prefer-arrow-callback": "error",
      "no-duplicate-imports": "error",
    },
  },
]);
