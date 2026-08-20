"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE_S, getTheme } from "@/lib/theme";

export async function toggleTheme(): Promise<void> {
  const current = await getTheme();
  const next = current === "dark" ? "light" : "dark";

  const store = await cookies();
  store.set(THEME_COOKIE, next, {
    maxAge: THEME_COOKIE_MAX_AGE_S,
    path: "/",
    sameSite: "lax",
  });

  // The theme lives on the <html> tag in the ROOT layout (app/layout.tsx),
  // above the portal layout this action is called from — a plain
  // revalidatePath() only invalidates the current route's layout, so this
  // needs the "layout" type pointed at "/" to reach up to the root.
  revalidatePath("/", "layout");
}
