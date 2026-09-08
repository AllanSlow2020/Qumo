import { cookies } from "next/headers";

export const THEME_COOKIE = "cios_theme";
export const THEME_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365;

export type Theme = "light" | "dark";

/**
 * Null means "no explicit preference saved yet" - the root layout leaves
 * data-theme off the <html> tag in that case, and prefers-color-scheme in
 * globals.css decides. Once someone uses the toggle, this always returns
 * their saved choice, overriding the OS setting from then on.
 */
export async function getTheme(): Promise<Theme | null> {
  const store = await cookies();
  const value = store.get(THEME_COOKIE)?.value;
  return value === "dark" || value === "light" ? value : null;
}
