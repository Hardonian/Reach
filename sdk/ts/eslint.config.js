// ESLint v9 flat config for @reach/sdk
// Uses root workspace packages via npm workspaces resolution
import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.ts", "src/**/*.js"],
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-console": "warn",
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**"],
  },
];
