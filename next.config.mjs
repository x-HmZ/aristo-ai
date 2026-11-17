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

// Pages that host generated widgets (V10). `frame-src 'none'` governs every navigation of a child frame, which the
// widget sandbox alone does not stop: without it a widget can set its own location (or meta refresh, or click a link)
// and the remote page then renders inside the card with scripts and network. The srcdoc itself is exempt.
const widgetHostHeaders = [{ key: "Content-Security-Policy", value: "frame-src 'none'" }];

const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  typescript: {
    // Was true on Next 15.5.15 because of vercel/next.js#82877 (the generated
    // validator dropped `src/` from its import paths). Re-checked on 15.5.29:
    // `next build` type-checks cleanly, so build errors are enforced again.
    // If a later bump brings the validator problem back, set this to true.
    ignoreBuildErrors: false,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      { source: "/learn", headers: widgetHostHeaders },
      { source: "/demo", headers: widgetHostHeaders },
      { source: "/dev/interactive", headers: widgetHostHeaders },
    ];
  },
};

export default nextConfig;
