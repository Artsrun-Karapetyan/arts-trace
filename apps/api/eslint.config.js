import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import eslintImport from "eslint-plugin-import";
import prettierPlugin from "eslint-plugin-prettier";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";
import path from "path";
import tseslint from "typescript-eslint";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    plugins: {
      prettier: prettierPlugin,
      import: eslintImport,
      "simple-import-sort": simpleImportSort,
      "unused-imports": unusedImports,
    },
  },
  {
    ignores: [
      "dist",
      "node_modules",
      ".yarn",
      ".pnp.cjs",
      ".idea",
      ".vscode",
      ".pnp.loader.mjs",
    ],
  },

  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.js"],
        },
        tsconfigRootDir: __dirname,
      },
      globals: {
        ...globals.node,
        ...globals.es2020,
      },
    },
  },
  {
    files: ["**/*.{js,ts}"],
    settings: {
      "import/resolver": {
        node: {
          extensions: [".js", ".ts", ".json"],
        },
      },
    },
    rules: {
      ...prettierPlugin.configs.recommended.rules,
      ...eslintConfigPrettier.rules,
      "no-undef": "off", // TS handles this
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "error",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "no-use-before-define": "off",
      "@typescript-eslint/no-use-before-define": [
        "warn",
        {
          functions: false,
          classes: true,
          variables: true,
        },
      ],
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "import/imports-first": "off",
      "import/no-unresolved": "off", // turned off because TS handles this better without extra resolver plugins
      "no-console": "error",
      "default-param-last": "error",
      "prefer-template": "error",
      "prefer-const": "error",
      "max-lines": ["error", { max: 350, skipBlankLines: true }],
      "max-params": ["error", 5],
    },
  },
  {
    files: ["eslint.config.js"],
    ...tseslint.configs.disableTypeChecked,
  },
);
