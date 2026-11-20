// Security headers for the style diagnosis pages and its API routes only;
// the rest of the portfolio keeps its current behavior.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  i18n: {
    locales: ['pt-BR'],
    defaultLocale: 'pt-BR',
  },
  async headers() {
    return [
      { source: "/diagnostico-estilo/:path*", headers: securityHeaders },
      { source: "/api/:path*", headers: securityHeaders },
    ];
  },
}

export default nextConfig
