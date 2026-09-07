import type { NextConfig } from "next";

// Security headers that apply to every response, static assets included.
//
// The Content-Security-Policy is deliberately NOT here. It carries a
// per-request nonce, so it is built in proxy.ts (lib/security/csp.ts) and
// set there. Setting it in both places would put two of the header on one
// response, which browsers enforce as the intersection of the two policies
// - a thing that is hard to reason about and easy to get wrong twice.
const securityHeaders = [
  // Superseded by the policy's frame-ancestors for any current browser, and
  // kept for the ones that predate it. Costs a few bytes.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    // Two years, and every brand subdomain with it - which is the whole
    // point here, because the shopper surface *is* subdomains and a brand
    // site reachable over http is a session cookie reachable over http.
    //
    // No `preload`. Preloading is close to irreversible: the domain gets
    // baked into browsers that ship with the list, and removal takes
    // months. It is the right end state and the wrong thing to commit to
    // before the domain is even registered.
    //
    // Browsers ignore this header entirely when it arrives over http, so it
    // does nothing in local development rather than making
    // http://app.localhost unreachable.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
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
