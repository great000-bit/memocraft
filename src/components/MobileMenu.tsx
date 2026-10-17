"use client";

import { useRef } from "react";
import styles from "./SiteNav.module.css";

// A phone's menu: a button in the header that opens a list under it. The list closes when a link is chosen,
// so a section link lands on the section instead of behind an open menu.
export function MobileMenu({ links }: { links: { label: string; href: string }[] }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const close = () => {
    if (menu.current) menu.current.open = false;
  };

  return (
    <details ref={menu} className={styles.mobile} onKeyDown={(event) => event.key === "Escape" && close()}>
      <summary aria-label="Menu">
        <svg className={styles.burger} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 8h16M4 16h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <svg className={styles.close} viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </summary>
      <nav className={styles.mobilePanel} aria-label="Mobile" onClick={close}>
        {links.map((link) => (
          <a key={link.label} href={link.href}>
            {link.label}
          </a>
        ))}
      </nav>
    </details>
  );
}
