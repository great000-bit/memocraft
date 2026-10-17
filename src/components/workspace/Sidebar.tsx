import Link from "next/link";
import { Logo } from "../Logo";
import { Suspense } from "react";
import { NavList, SidebarNav } from "./SidebarNav";
import styles from "./Workspace.module.css";

export function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <Link href="/dashboard" className={styles.brand} aria-label="Memocraft dashboard">
        <Logo className={styles.logo} />
      </Link>
      <Suspense fallback={<NavList pathname={null} />}>
        <SidebarNav />
      </Suspense>
    </aside>
  );
}
