import Link from "next/link";
import { Suspense } from "react";
import { Logo, LogoMark } from "../Logo";
import { NavList, SidebarNav } from "./SidebarNav";
import { SidebarToggle } from "./SidebarToggle";
import styles from "./Workspace.module.css";

export function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brandRow}>
        <Link href="/dashboard" className={styles.brand} aria-label="Memocraft dashboard">
          <Logo className={styles.logo} />
          <LogoMark className={styles.mark} />
        </Link>
        <SidebarToggle />
      </div>
      <Suspense fallback={<NavList pathname={null} />}>
        <SidebarNav />
      </Suspense>
    </aside>
  );
}
