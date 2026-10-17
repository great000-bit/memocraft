"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import styles from "./Workspace.module.css";

// The sidebar's open or closed state is a per-device preference, so it lives in localStorage. The shell carries it as
// a data attribute that the stylesheet reads. On a full page load an inline script in the layout sets the attribute
// before the first paint; this component keeps it in step afterwards and after soft navigations.
const storageKey = "mc-sidebar";
const changeEvent = "mc-sidebar-change";

// The width at which the sidebar stops being a drawer and becomes a column. Matches the stylesheet.
const wide = "(min-width: 900px)";

function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(wide);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

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

// On a wide screen the button opens and closes the column, and the choice is remembered. On a phone it slides the
// menu in from the left for this visit only; it closes on a tap outside it, on Escape, or when a page is picked.
export function SidebarToggle() {
  const collapsed = useSyncExternalStore(subscribe, read, () => false);
  const isWide = useSyncExternalStore(subscribeWide, () => window.matchMedia(wide).matches, () => true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const showDrawer = drawerOpen && !isWide;

  useEffect(() => {
    button.current?.closest<HTMLElement>("[data-shell]")?.setAttribute("data-collapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    const shell = button.current?.closest<HTMLElement>("[data-shell]");
    if (!shell) return;
    shell.setAttribute("data-drawer", showDrawer ? "open" : "closed");
    if (!showDrawer) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        button.current?.focus();
      }
    };
    // Picking a page, or the profile link, closes the menu as the page changes.
    const drawer = document.getElementById("workspace-nav");
    const onPick = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("a[href]")) setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    drawer?.addEventListener("click", onPick);
    return () => {
      window.removeEventListener("keydown", onKey);
      drawer?.removeEventListener("click", onPick);
    };
  }, [showDrawer]);

  function toggle() {
    if (!isWide) {
      setDrawerOpen((open) => !open);
      return;
    }
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

  const expanded = isWide ? !collapsed : showDrawer;
  const label = isWide ? (collapsed ? "Open sidebar" : "Close sidebar") : showDrawer ? "Close menu" : "Open menu";
  return (
    <>
      <button
        ref={button}
        type="button"
        className={styles.toggle}
        onClick={toggle}
        aria-label={label}
        aria-expanded={expanded}
        aria-controls="workspace-nav"
        title={label}
      >
        {isWide ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
            <path d="M9.5 4.5v15" />
            <path d={collapsed ? "m14 10 2 2-2 2" : "m16 10-2 2 2 2"} />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
            <path d="M4.5 7h15M4.5 12h15M4.5 17h15" />
          </svg>
        )}
      </button>
      {/* The dimmed page behind the open phone menu; a tap on it closes the menu. Not a stop for keyboards. */}
      <div className={styles.scrim} onClick={() => setDrawerOpen(false)} aria-hidden="true" />
    </>
  );
}
