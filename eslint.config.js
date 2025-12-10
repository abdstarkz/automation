import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReactConfig from "eslint-plugin-react/configs/recommended.js";
import hooksPlugin from "eslint-plugin-react-hooks";

export default [
  { ignores: ["dist/**"] }, // Ignore the dist directory
  {
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
  },
  {
    // Configuration for client-side files
    files: ["src/**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    languageOptions: { globals: globals.browser },
  },
  {
    // Configuration for server-side and worker files
    files: ["server/**/*.{js,mjs,cjs,ts,jsx,tsx}", "workers/**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    languageOptions: { globals: { ...globals.node, Buffer: "readonly" } },
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ...pluginReactConfig,
    rules: {
      ...pluginReactConfig.rules,
      "react/react-in-jsx-scope": "off", // Not needed for React 17+ with new JSX transform
      "@typescript-eslint/no-explicit-any": "off", // Temporarily disable to reduce noise
      "react-hooks/exhaustive-deps": "warn", // Re-enable as a warning
    },
  },
  {
    plugins: {
      "react-hooks": hooksPlugin,
    },
    rules: {
      ...hooksPlugin.configs.recommended.rules,
    },
  },
  {
    settings: {
      react: {
        version: "detect",
      },
    },
  },
];