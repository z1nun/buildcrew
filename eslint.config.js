/**
 * ESLint 9 flat config — buildcrew.
 *
 * Encodes the conventions from .claude/harness/rules.md so the lint pass and
 * the agent review pass agree on what counts as a violation. Keep this file
 * in sync with rules.md when either side changes.
 *
 * Design notes:
 *   - `no-console: error` is global. Five files legitimately write to the
 *     terminal (CLI logger + dashboard rendering); they get a per-file
 *     override rather than inline disables, so future edits don't need to
 *     remember the comment.
 *   - `no-restricted-syntax` enforces "no default exports" since flat config
 *     has no first-class no-default-export rule. Pages/layouts (Next.js)
 *     would normally need an exception, but this package has none.
 *   - We don't use eslint:recommended wholesale — its defaults conflict
 *     with our intentional patterns (e.g., empty catch blocks for "best
 *     effort" detection). We hand-pick the rules we want.
 */

import globals from "globals";

export default [
  // ─── Ignore patterns ───
  {
    ignores: [
      "node_modules/**",
      ".claude/**",
      "templates/**",         // markdown templates, not JS
      "agents/**",            // agent specs are markdown
    ],
  },

  // ─── Base config (applies to all .js files) ───
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.es2024,
      },
    },
    rules: {
      // Output discipline — CLI logger and dashboard get per-file overrides.
      "no-console": "error",

      // Variable hygiene — rules.md: "no var, const/let only".
      "no-var": "error",
      "prefer-const": "error",

      // Unused symbols block dead-code rot. argsIgnorePattern lets us mark
      // intentionally-unused params as `_unused` (common for callback shapes).
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // rules.md: "No default exports (except pages/layouts)". This package
      // has no pages/layouts so the rule is unconditional here.
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportDefaultDeclaration",
          message:
            "No default exports — use named exports (rules.md). Default exports break grep, refactoring, and re-export chains.",
        },
      ],

      // Equality discipline — strict everywhere except `== null` / `!= null`,
      // which is the canonical "is this nullish?" check that matches both
      // null and undefined in one comparison. This is ESLint's documented
      // exception, not a softening of the rule.
      "eqeqeq": ["error", "always", { "null": "ignore" }],

      // Style nudge — inherits from rules.md "functional, no class components"
      // spirit; keeps callbacks consistent.
      "prefer-arrow-callback": "warn",
    },
  },

  // ─── Per-file console overrides ───
  // Files that write to the terminal as their primary job. The dashboard
  // rendering loop and the CLI logger wrapper would be unreadable behind
  // inline eslint-disable comments at every call site.
  {
    files: [
      "lib/watch/render.js",   // dashboard frame rendering (33 console calls)
      "bin/watch.js",          // dashboard entrypoint
      "bin/setup.js",          // CLI entrypoint, error channel to stderr
      "lib/cli/utils.js",      // log() wrapper — single source of console.log
      "lib/cli/watch.js",      // child process launcher, error channel
    ],
    rules: {
      "no-console": "off",
    },
  },

  // ─── Test files ───
  // Tests can use console freely (debugging) and may need different unused-var
  // semantics. vitest globals are auto-detected via imports.
  {
    files: ["test/**/*.js", "test/**/*.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-console": "off",
    },
  },

  // ─── ESLint config self-exception ───
  // Flat config requires `export default` by ESLint's loader contract — the
  // rule otherwise applies. This is the ONE legitimate default export in the
  // package and the message is misleading if it fires here.
  {
    files: ["eslint.config.js"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
];
