"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FeatureIcon, type FeatureIconName } from "../FeatureIcons";
import styles from "./Workspace.module.css";

const items: { label: string; icon: FeatureIconName; href?: string }[] = [
  { label: "Home", icon: "brand", href: "/dashboard" },
  { label: "Deliveries", icon: "upload", href: "/deliveries" },
  { label: "Requests", icon: "request" },
  { label: "Team", icon: "people" },
];

// Sections that are not built yet are shown, marked Soon, so the shape of the product is visible.
// The path is only known at request time, so the shell renders this with no active item first.
export function NavList({ pathname }: { pathname: string | null }) {
  const isActive = (href: string) =>
    pathname !== null && (pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`)));
  return (
    <nav aria-label="Workspace">
      <ul className={styles.nav}>
        {items.map((item) => (
          <li key={item.label}>
            {item.href ? (
              <Link
                href={item.href}
                className={styles.navItem}
                aria-current={isActive(item.href) ? "page" : undefined}
              >
                <FeatureIcon name={item.icon} />
                {item.label}
              </Link>
            ) : (
              <span className={`${styles.navItem} ${styles.navSoon}`} aria-disabled="true">
                <FeatureIcon name={item.icon} />
                {item.label}
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
