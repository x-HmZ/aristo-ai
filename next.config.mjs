/** @type {import('next').NextConfig} */

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // microphone=(self) is required because /learn uses the Web Speech API
  // for voice input. camera + geolocation are not used anywhere.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  typescript: {
    // Workaround for vercel/next.js#82877 — the 15.5 page-export validator
    // generates import paths that drop `src/`, so the generated
    // .next/types/validator.ts fails type-check during `next build`.
    // We still run `tsc --noEmit` via `yarn type-check` in CI / the deploy
    // smoke test, so type safety is preserved.
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
