"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FeatureIcon, type FeatureIconName } from "../FeatureIcons";
import styles from "./Workspace.module.css";

const items: { label: string; icon: FeatureIconName; href?: string }[] = [
  { label: "Home", icon: "home", href: "/dashboard" },
  { label: "Deliveries", icon: "upload", href: "/deliveries" },
  { label: "Requests", icon: "request", href: "/requests" },
  { label: "Team", icon: "people" },
  { label: "Profile", icon: "profile", href: "/profile" },
  { label: "Settings", icon: "settings", href: "/settings" },
];

// Sections that are not built yet are shown, marked Soon, so the shape of the product is visible.
// The path is only known at request time, so the shell renders this with no active item first.
export function NavList({ pathname }: { pathname: string | null }) {
  const isActive = (href: string) =>
    pathname !== null && (pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`)));
  return (
    <nav id="workspace-nav" aria-label="Workspace">
      <ul className={styles.nav}>
        {items.map((item) => (
          <li key={item.label}>
            {item.href ? (
              <Link
                href={item.href}
                className={styles.navItem}
                aria-current={isActive(item.href) ? "page" : undefined}
                data-label={item.label}
              >
                <FeatureIcon name={item.icon} />
                <span className={styles.navLabel}>{item.label}</span>
              </Link>
            ) : (
              <span className={`${styles.navItem} ${styles.navSoon}`} aria-disabled="true" data-label={`${item.label} (soon)`}>
                <FeatureIcon name={item.icon} />
                <span className={styles.navLabel}>{item.label}</span>
                <span className={styles.soon}>Soon</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SidebarNav() {
  return <NavList pathname={usePathname()} />;
}
