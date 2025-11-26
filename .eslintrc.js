module.exports = {
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "tsconfig.eslint.json",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "import"],
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
    "@typescript-eslint/quotes": [
      "error",
      "single",
      { avoidEscape: true, allowTemplateLiterals: false },
    ],
    "curly": ["error", "all"],
    "eqeqeq": "error",
    "import/order": [
      "error",
      {
        "alphabetize": {"order": "asc"},
        "groups": [
          "external",
          "builtin",
          ["internal", "sibling", "parent", "index"]
        ],
        "distinctGroup": false,
        "pathGroups": [
          {pattern: "@/**", group: "internal", position: "before"}
        ],
        "newlines-between": "always"
      }
    ],
    "prefer-arrow-callback": "error",
    // "no-console": ["error", {"allow": ["error", "warn", "debug"]}],
    "no-duplicate-imports": "error",
  },
};
