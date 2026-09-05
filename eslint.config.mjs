// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    rules: {
      // Binance API responses are untyped JSON — allow any at the boundary layer
      "@typescript-eslint/no-explicit-any": "warn",
      // Unused vars and parameters
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      // Allow intentional empty catch blocks for non-fatal fallbacks
      "no-empty": ["error", { allowEmptyCatch: true }],
      "@typescript-eslint/no-empty-object-type": "warn",
      "no-console": "off",
    },
  },
  {
    // Relax rules for test files
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**"],
  }
);
