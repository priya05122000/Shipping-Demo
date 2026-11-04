import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The child app has its own toolchain (type-checked by `tsc -b` in its build); public/child is its build output.
    "child/**",
    "public/child/**",
    // Monaco's prebuilt files, copied from node_modules by scripts/copy-monaco.mjs.
    "public/monaco/**",
  ]),
]);

export default eslintConfig;
