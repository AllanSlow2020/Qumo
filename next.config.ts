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
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
