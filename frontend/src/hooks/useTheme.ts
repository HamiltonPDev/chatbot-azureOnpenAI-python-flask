/**
 * Theme selection, persisted per browser.
 *
 * Three states, not two: "system" is the default and follows the OS. An
 * explicit choice is written to <html data-theme> and to localStorage,
 * where index.css picks it up.
 */
import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "ca-theme";

function readStored(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Private windows and blocked site data throw rather than return null.
  }
  return "system";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readStored);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", theme);
    }
    try {
      if (theme === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Persistence is a convenience; the UI works without it.
    }
  }, [theme]);

  /** What the user actually sees right now, resolving "system". */
  const resolved: Exclude<Theme, "system"> =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;

  const toggle = useCallback(() => {
    setTheme((current) => {
      if (current === "system") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "light"
          : "dark";
      }
      return current === "dark" ? "light" : "dark";
    });
  }, []);

  return { theme, resolved, toggle };
}
