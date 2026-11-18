"use client";

import { useOptimistic } from "react";
import { toggleTheme } from "@/app/theme-actions";

/**
 * The Light / Dark button, which answers the click before the server does.
 *
 * The theme lives in a cookie that the root layout reads to set `data-theme`
 * on <html>, and the action revalidates the whole tree so that happens. That
 * is correct and it is also a full server render to change one attribute, so
 * on a real connection the page sat unchanged for as long as the round trip
 * took and a second click was the natural response.
 *
 * So the attribute is set here, in the same event, and the label with it; the
 * action then makes it true on the server. If the action fails, the optimistic
 * label reverts on its own and the attribute is put back by hand, because
 * nothing else would.
 *
 * `theme` is null until somebody has chosen, in which case the operating
 * system decides and the toggle's first move is to dark, as the action does.
 */
export function ThemeToggle({ theme }: { theme: "light" | "dark" | null }) {
  const [shown, setShown] = useOptimistic(theme);

  async function action() {
    const root = document.documentElement;
    const previous = root.getAttribute("data-theme");
    const next = shown === "dark" ? "light" : "dark";
    setShown(next);
    root.setAttribute("data-theme", next);
    try {
      await toggleTheme();
    } catch {
      if (previous === null) root.removeAttribute("data-theme");
      else root.setAttribute("data-theme", previous);
    }
  }

  return (
    <form action={action}>
      {/* Unset means light, so an unset preference is offered dark. */}
      <button type="submit" className="cn-theme">
        {shown === "dark" ? "Light" : "Dark"}
      </button>
    </form>
  );
}
