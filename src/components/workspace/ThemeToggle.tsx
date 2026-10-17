"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import styles from "./Workspace.module.css";

// The workspace opens dark; light is a per-device choice kept in localStorage. The shell carries it as
// data-theme="light", which the stylesheet reads. On a full page load an inline script in the layout sets it before the
// first paint; this keeps it in step afterwards, and keeps every toggle on the page (sidebar, settings) in agreement.
export const themeStorageKey = "mc-theme";
const changeEvent = "mc-theme-change";

type Theme = "dark" | "light";

// If storage is blocked (some private windows) the choice still holds for the rest of the visit.
let remembered: Theme | null = null;

function read(): Theme {
  if (remembered) return remembered;
  try {
    return localStorage.getItem(themeStorageKey) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(changeEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(changeEvent, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, read, (): Theme => "dark");
  function setTheme(next: Theme) {
    remembered = next;
    try {
      localStorage.setItem(themeStorageKey, next);
    } catch {
      // Not saved for the next visit; the choice still applies now.
    }
    window.dispatchEvent(new Event(changeEvent));
  }
  return [theme, setTheme] as const;
}

const sun = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </svg>
);

const moon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10Z" />
  </svg>
);

// One button that switches the whole workspace. It names what it switches to, like the log-out button names its action.
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useTheme();
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const shell = button.current?.closest<HTMLElement>("[data-shell]");
    if (!shell) return;
    if (theme === "light") shell.setAttribute("data-theme", "light");
    else shell.removeAttribute("data-theme");
  }, [theme]);

  const label = theme === "dark" ? "Light mode" : "Dark mode";
  return (
    <button
      ref={button}
      type="button"
      className={className ?? styles.signOut}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      data-label={label}
    >
      {theme === "dark" ? sun : moon}
      <span className={styles.signOutLabel}>{label}</span>
    </button>
  );
}
