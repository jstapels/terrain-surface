import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["dist/**", "node_modules/**"] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: globals.node },
    rules: { "no-unused-vars": ["error", { argsIgnorePattern: "^_" }] }
  },
  {
    files: ["scripts/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
        foundry: "readonly", CONFIG: "readonly", CONST: "readonly", Hooks: "readonly",
        game: "readonly", canvas: "readonly", ui: "readonly", PIXI: "readonly"
      }
    }
  }
];
