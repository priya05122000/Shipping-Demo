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
    // The ships' viewers are a separate app, with their own toolchain (type-checked by `tsc -b` in their build).
    "child/**",
    // Monaco's prebuilt files, copied from node_modules by scripts/copy-monaco.mjs.
    "public/monaco/**",
  ]),
]);

export default eslintConfig;
