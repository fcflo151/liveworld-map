import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // These rules are valuable migration signals, but the inherited codebase
    // already contains hundreds of violations. Keep them visible without
    // allowing unrelated legacy debt to block every new change; TypeScript,
    // tests and the production build remain hard quality gates.
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
  {
    // WorldRemote is a large hardware-integration component. Running the React
    // compiler migration diagnostics on this single file exceeds the 6 GiB
    // GitHub Actions heap even in its own ESLint process. Keep the rest of the
    // TypeScript/Next/React lint rules active and skip only those advisory
    // compiler diagnostics here until the component is split into smaller units.
    files: ["src/components/WorldRemote.tsx"],
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/**",
    "scratch/**",
    "intel/**",
    "runs/**",
    "tools/**",
    ".cache/**",
  ]),
]);

export default eslintConfig;
