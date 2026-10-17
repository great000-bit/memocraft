import type { Metadata } from "next";
import { Suspense } from "react";
import { Sidebar } from "@/components/workspace/Sidebar";
import { UserMenu, UserMenuFallback } from "@/components/workspace/UserMenu";
import styles from "@/components/workspace/Workspace.module.css";

// The workspace follows the device theme and stays out of search results.
export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s | Memocraft" },
  robots: { index: false, follow: false },
};

export default function WorkspaceLayout({ children }: LayoutProps<"/">) {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.body}>
        <header className={styles.topbar}>
          <Suspense fallback={<UserMenuFallback />}>
            <UserMenu />
          </Suspense>
        </header>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
