import Link from "next/link";
import { Suspense } from "react";
import { Logo, LogoMark } from "../Logo";
import { NavList, SidebarNav } from "./SidebarNav";
import { SidebarToggle } from "./SidebarToggle";
import { TeamSwitcher } from "./TeamSwitcher";
import { UserMenu, UserMenuFallback } from "./UserMenu";
import styles from "./Workspace.module.css";

// Everything you move between lives on the left: the pages, then your account at the foot. On a wide screen it is a
// column that closes to a rail; on a phone it slides in from the left when the menu button is pressed.
// The admin console passes its own list of pages; everything else about the sidebar stays the same.
export function Sidebar({ nav, home = "/dashboard" }: { nav?: React.ReactNode; home?: string }) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brandRow}>
        <Link href={home} className={styles.brand} aria-label="Memocraft dashboard">
          <Logo className={styles.logo} />
          <LogoMark className={styles.mark} />
        </Link>
        <SidebarToggle />
      </div>
      <div id="workspace-nav" className={styles.drawer}>
        {nav ?? (
          <div className={styles.navStack}>
            <Suspense fallback={null}>
              <TeamSwitcher />
            </Suspense>
            <Suspense fallback={<NavList pathname={null} />}>
              <SidebarNav />
            </Suspense>
          </div>
        )}
        <Suspense fallback={<UserMenuFallback />}>
          <UserMenu />
        </Suspense>
      </div>
    </aside>
  );
}
