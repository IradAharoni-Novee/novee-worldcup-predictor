import next from "eslint-config-next";

// Next.js 16 removed `next lint`; lint via the ESLint CLI with this flat config.
// `eslint-config-next` ships a native flat-config array bundling
// next/core-web-vitals + next/typescript and the default ignores
// (.next, out, build, next-env.d.ts).
/** @type {import("eslint").Linter.Config[]} */
const eslintConfig = [
  // Session worktrees carry their own .next build output, which the default
  // ignores (root-relative) don't cover.
  { ignores: [".claude/"] },
  ...next,
  {
    rules: {
      // Flag stray console use. Intentional logging — CLI scripts in prisma/,
      // the dev-only magic-link print, server-side error logs — opts in with an
      // eslint-disable comment.
      "no-console": "warn",
      // Avatars, team flags, and crests are small external images (Slack,
      // Google, football-data, flagcdn) rendered via plain <img> with our own
      // load-failure fallback (see components/ui/avatar-image.tsx). next/image
      // adds no value at these sizes and would require remotePatterns for every
      // avatar host plus fighting the fallback.
      "@next/next/no-img-element": "off",
    },
  },
];

export default eslintConfig;
