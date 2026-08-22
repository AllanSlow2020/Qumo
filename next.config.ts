import type { NextConfig } from "next";

// Baseline security headers on every response. Not a substitute for a real
// CSP — that comes once the brand theming layer settles and we know which
// fonts and styles a skinned page actually loads — but these close off
// clickjacking, MIME-sniffing and full-referrer leakage for free.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Brand subdomains are separate origins from the apex, and dev refuses
  // cross-origin requests it wasn't told about. Every brand is *.localhost
  // locally, so this is what makes chicken-licken.localhost:3000 work at all.
  allowedDevOrigins: ["*.localhost", "localhost"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
