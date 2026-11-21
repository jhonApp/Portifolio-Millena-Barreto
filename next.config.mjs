// Security headers for the style diagnosis pages and its API routes only;
// the rest of the portfolio keeps its current behavior.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

// Files the PDF renderer reads from disk at run time. The pdfkit standard fonts are loaded with a
// dynamic require that the file tracer cannot see, so without them the production render fails
// with "Cannot find module .../pdfkit/js/standard-fonts/Helvetica.cjs".
const pdfFiles = [
  "./assets/pdf-fonts/**/*",
  "./assets/pdf-images/**/*",
  "./node_modules/pdfkit/js/standard-fonts/**/*",
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  i18n: {
    locales: ['pt-BR'],
    defaultLocale: 'pt-BR',
  },
  experimental: {
    // The PDF library loads its own files at run time, so it stays outside the server bundle (RF-07).
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
    // The PDF fonts are read from disk: trace them into every route that can render a PDF.
    outputFileTracingIncludes: {
      "/api/diagnostico/webhooks/abacatepay": pdfFiles,
      "/api/diagnostico/payment/check": pdfFiles,
      "/api/diagnostico/jobs/generation": pdfFiles,
    },
  },
  async headers() {
    return [
      { source: "/diagnostico-estilo/:path*", headers: securityHeaders },
      { source: "/api/:path*", headers: securityHeaders },
    ];
  },
}

export default nextConfig
