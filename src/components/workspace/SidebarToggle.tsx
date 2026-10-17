"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import styles from "./Workspace.module.css";

// The sidebar's open or closed state is a per-device preference, so it lives in localStorage. The shell carries it as
// a data attribute that the stylesheet reads. On a full page load an inline script in the layout sets the attribute
// before the first paint; this component keeps it in step afterwards and after soft navigations.
const storageKey = "mc-sidebar";
const changeEvent = "mc-sidebar-change";

// If storage is blocked (some private windows) the choice still holds for the rest of the visit.
let remembered: boolean | null = null;

function read(): boolean {
  if (remembered !== null) return remembered;
  try {
    return localStorage.getItem(storageKey) === "collapsed";
  } catch {
    return false;
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

export function SidebarToggle() {
  const collapsed = useSyncExternalStore(subscribe, read, () => false);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    button.current?.closest<HTMLElement>("[data-shell]")?.setAttribute("data-collapsed", String(collapsed));
  }, [collapsed]);

  function toggle() {
    const next = !collapsed;
    // Only a deliberate toggle animates; arriving on a page already collapsed must not slide.
    button.current?.closest<HTMLElement>("[data-shell]")?.setAttribute("data-animate", "true");
    remembered = next;
    try {
      localStorage.setItem(storageKey, next ? "collapsed" : "open");
    } catch {
      // Not saved for the next visit; the choice still applies now.
    }
    window.dispatchEvent(new Event(changeEvent));
  }

  const label = collapsed ? "Open sidebar" : "Close sidebar";
  return (
    <button
      ref={button}
      type="button"
      className={styles.toggle}
      onClick={toggle}
      aria-label={label}
      aria-expanded={!collapsed}
      aria-controls="workspace-nav"
      title={label}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
        <path d="M9.5 4.5v15" />
        <path d={collapsed ? "m14 10 2 2-2 2" : "m16 10-2 2 2 2"} />
      </svg>
    </button>
  );
}
