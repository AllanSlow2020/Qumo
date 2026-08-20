// Vercel sets VERCEL_ENV to "production" | "preview" | "development" on
// every deployment automatically — no dashboard config needed, unlike the
// app's other env vars. Used to keep preview deployments from touching
// real external services with production credentials, since Preview and
// Production currently share the same WhatsApp/Gmail secrets (see
// SECURITY.md / the staging-separation task this file was added for).
export function isPreviewDeployment(): boolean {
  return process.env.VERCEL_ENV === "preview";
}
