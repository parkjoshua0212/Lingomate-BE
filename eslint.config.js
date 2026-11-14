import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/", "src/generated/"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      // allow `const { omitted, ...rest } = obj` to drop a key
      "no-unused-vars": ["error", { ignoreRestSiblings: true }],
    },
  },
];
