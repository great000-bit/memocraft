import Link from "next/link";
import { FeatureIcon, type FeatureIconName } from "../FeatureIcons";
import { Logo } from "../Logo";
import styles from "./Workspace.module.css";

const items: { label: string; icon: FeatureIconName; href?: string }[] = [
  { label: "Home", icon: "brand", href: "/dashboard" },
  { label: "Deliveries", icon: "upload" },
  { label: "Requests", icon: "request" },
  { label: "Team", icon: "people" },
];

// Workspace navigation. Sections that are not built yet are shown, marked Soon, so the shape is visible.
export function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <Link href="/dashboard" className={styles.brand} aria-label="Memocraft dashboard">
        <Logo className={styles.logo} />
      </Link>
      <nav aria-label="Workspace">
        <ul className={styles.nav}>
          {items.map((item) => (
            <li key={item.label}>
              {item.href ? (
                <Link href={item.href} className={styles.navItem} aria-current="page">
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
    </aside>
  );
}
