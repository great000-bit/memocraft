"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { FeatureIcon, type FeatureIconName } from "../FeatureIcons";
import { unreadEvent } from "./Notifier";
import styles from "./Workspace.module.css";

const items: { label: string; icon: FeatureIconName; href?: string }[] = [
  { label: "Home", icon: "home", href: "/dashboard" },
  { label: "Deliveries", icon: "upload", href: "/deliveries" },
  { label: "Explorer", icon: "folder", href: "/explorer" },
  { label: "Enhancer", icon: "enhance", href: "/enhancer" },
  { label: "Requests", icon: "request", href: "/requests" },
  { label: "Notifications", icon: "bell", href: "/notifications" },
  { label: "Team", icon: "people" },
  { label: "Profile", icon: "profile", href: "/profile" },
  { label: "Settings", icon: "settings", href: "/settings" },
];

// Sections that are not built yet are shown, marked Soon, so the shape of the product is visible.
// The path is only known at request time, so the shell renders this with no active item first.
export function NavList({ pathname, unread = 0 }: { pathname: string | null; unread?: number }) {
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
                data-label={item.label}
              >
                <FeatureIcon name={item.icon} />
                <span className={styles.navLabel}>{item.label}</span>
                {item.href === "/notifications" && unread > 0 && !isActive(item.href) && (
                  <span className={styles.navDot} role="status" aria-label={`${unread} new`} />
                )}
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
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const onUnread = (event: Event) => setUnread(Number((event as CustomEvent<number>).detail) || 0);
    window.addEventListener(unreadEvent, onUnread);
    return () => window.removeEventListener(unreadEvent, onUnread);
  }, []);
  return <NavList pathname={pathname} unread={pathname === "/notifications" ? 0 : unread} />;
}
