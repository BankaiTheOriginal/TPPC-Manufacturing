export type Theme = "light" | "dark";

function isClient() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function getStoredTheme(): Theme | null {
  if (!isClient()) return null;
  const t = localStorage.getItem("tppc-theme");
  return t === "dark" ? "dark" : t === "light" ? "light" : null;
}

export function getPreferredTheme(): Theme {
  if (!isClient()) return "light";
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches
    ? "dark"
    : "light";
}

export function getInitialTheme(): Theme {
  const stored = getStoredTheme();
  if (stored) return stored;
  return getPreferredTheme();
}

export function applyTheme(theme: Theme) {
  if (!isClient()) return;
  if (theme === "dark") document.documentElement.classList.add("dark");
  else document.documentElement.classList.remove("dark");
}

let __themeTransitionTimer: number | null = null;

export function setTheme(theme: Theme) {
  if (!isClient()) return;
  try {
    localStorage.setItem("tppc-theme", theme);
  } catch {}

  const root = document.documentElement;
  // Add a temporary class that enables smooth transitions for color-like properties
  root.classList.add("theme-transition");
  if (__themeTransitionTimer) window.clearTimeout(__themeTransitionTimer);

  // Apply the theme immediately
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");

  // Remove the transition helper after a short duration
  __themeTransitionTimer = window.setTimeout(() => {
    root.classList.remove("theme-transition");
    __themeTransitionTimer = null;
  }, 300);
}

export function getCurrentTheme(): Theme {
  if (!isClient()) return "light";
  const stored = getStoredTheme();
  if (stored) return stored;
  if (document.documentElement.classList.contains("dark")) return "dark";
  return getPreferredTheme();
}

export function toggleTheme(): Theme {
  const next = getCurrentTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}

const themeUtils = {
  getInitialTheme,
  applyTheme,
  setTheme,
  toggleTheme,
  getCurrentTheme,
};

export default themeUtils;
