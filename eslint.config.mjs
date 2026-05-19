import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".venv/**",
      ".idx/**",
      ".next/**",
      ".next-dev/**",
      "next-env.d.ts",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  {
    rules: {
      "@next/next/no-img-element": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "import/no-anonymous-default-export": "off",
      "prefer-const": "off",
      "react/no-deprecated": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
];

export default eslintConfig;
