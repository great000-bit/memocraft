import type { Metadata } from "next";
import { Suspense } from "react";
import { InlineScript } from "@/components/InlineScript";
import { Sidebar } from "@/components/workspace/Sidebar";
import { VerifyEmail } from "@/components/workspace/VerifyEmail";
import { emailConfigured } from "@/lib/email";
import { getSession } from "@/lib/session";
import { UserMenu, UserMenuFallback } from "@/components/workspace/UserMenu";
import styles from "@/components/workspace/Workspace.module.css";

// The workspace is always light and stays out of search results.
export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s | Memocraft" },
  robots: { index: false, follow: false },
};

// Only shown when email can actually be sent, and only until the address is confirmed.
async function VerifyNotice() {
  if (!emailConfigured()) return null;
  const session = await getSession();
  if (!session || session.user.emailVerified) return null;
  return <VerifyEmail email={session.user.email} />;
}

export default function WorkspaceLayout({ children }: LayoutProps<"/">) {
  return (
    <div className={`app-scope ${styles.shell}`} data-shell>
      {/* Applies the saved open or closed sidebar before the first paint, so a closed sidebar never flashes open. */}
      <InlineScript html={`try{if(localStorage.getItem("mc-sidebar")==="collapsed")document.currentScript.parentElement.setAttribute("data-collapsed","true")}catch(e){}`} />
      <Sidebar />
      <div className={styles.body}>
        <header className={styles.topbar}>
          <Suspense fallback={<UserMenuFallback />}>
            <UserMenu />
          </Suspense>
        </header>
        <main className={styles.main}>
          <Suspense fallback={null}>
            <VerifyNotice />
          </Suspense>
          {children}
        </main>
      </div>
    </div>
  );
}
