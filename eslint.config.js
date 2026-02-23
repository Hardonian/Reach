const { defineConfig } = require("eslint/config");
const js = require("@eslint/js");
const tseslint = require("typescript-eslint");

module.exports = defineConfig([
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-require-imports": "off",
      "no-console": "off",
      "no-useless-assignment": "warn",
    },
  },
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      ".next/**",
      "apps/arcade/**",
      "coverage/**",
      "*.config.js",
      "*.config.ts",
    ],
  },
]);
