// @ts-nocheck
// eslint.config.mjs — ESLint 9 flat config

import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";

export default [
  {
    ignores: [
      "dist/**",
      "coverage/**",
      ".vite/**",
      ".vitest/**",
      "node_modules/**"
    ],
  },

  // Base JS recs
  js.configs.recommended,

  // TypeScript (non–type-aware; fast)
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      // Prefer the TS rule to the base rule
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ],

      // Nice quality-of-life rules
      "@typescript-eslint/consistent-type-imports": "warn",

      // Avoid overlap with TS
      "no-undef": "off",
    },
  },

  // Keep formatting out of ESLint
  prettier,
];