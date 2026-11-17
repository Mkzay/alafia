import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// With Cache Components, reading the clock or randomness during prerender fails the build.
// UI code reads time only through @/lib/dates inside effects and handlers (design section 13).
const noClockInUi = {
  files: ["src/components/**/*.{ts,tsx}", "src/app/**/*.{ts,tsx}"],
  ignores: ["**/*.test.ts", "**/*.test.tsx"],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
        message: "No Date.now() in UI code. Use the data store or @/lib/dates in an effect.",
      },
      {
        selector: "NewExpression[callee.name='Date'][arguments.length=0]",
        message: "No new Date() in UI code. Use the data store or @/lib/dates in an effect.",
      },
      {
        selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
        message: "No Math.random() in UI code.",
      },
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  noClockInUi,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated service worker.
    "public/sw*",
  ]),
]);

export default eslintConfig;
