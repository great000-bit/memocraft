"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FeatureIcon, type FeatureIconName } from "../FeatureIcons";
import styles from "../workspace/Workspace.module.css";
import admin from "./Admin.module.css";

const items: { label: string; icon: FeatureIconName; href: string }[] = [
  { label: "Overview", icon: "home", href: "/admin" },
  { label: "People", icon: "people", href: "/admin/users" },
  { label: "Activity", icon: "history", href: "/admin/activity" },
];

// The console's own pages, then a way back to the creative's workspace.
export function AdminNav() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
  return (
    <nav aria-label="Admin">
      <p className={admin.navBadge}>Admin</p>
      <ul className={styles.nav}>
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={styles.navItem}
              aria-current={isActive(item.href) ? "page" : undefined}
              data-label={item.label}
            >
              <FeatureIcon name={item.icon} />
              <span className={styles.navLabel}>{item.label}</span>
            </Link>
          </li>
        ))}
        <li>
          <Link href="/dashboard" className={styles.navItem} data-label="Back to workspace">
            <FeatureIcon name="upload" />
            <span className={styles.navLabel}>Back to workspace</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
