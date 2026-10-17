import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { InlineScript } from "@/components/InlineScript";
import { Notifier } from "@/components/workspace/Notifier";
import { ServiceWorker } from "@/components/workspace/ServiceWorker";
import { Sidebar } from "@/components/workspace/Sidebar";
import { VerifyEmail } from "@/components/workspace/VerifyEmail";
import { emailConfigured } from "@/lib/email";
import { getSession } from "@/lib/session";
import styles from "@/components/workspace/Workspace.module.css";

// The workspace opens dark (light is a saved choice) and stays out of search results.
export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s | Memocraft" },
  robots: { index: false, follow: false },
};

// The phone's status bar and the installed app's frame match the dark workspace.
export const viewport: Viewport = { themeColor: "#1a1f1e" };

// Only shown when email can actually be sent, and only until the address is confirmed.
async function VerifyNotice() {
  if (!emailConfigured()) return null;
  const session = await getSession();
  if (!session || session.user.emailVerified) return null;
  return <VerifyEmail email={session.user.email} />;
}

export default function WorkspaceLayout({ children }: LayoutProps<"/">) {
  return (
    <div className={`app-scope ${styles.shell}`} data-shell suppressHydrationWarning>
      {/* Applies the saved open or closed sidebar before the first paint, so a closed sidebar never flashes open. */}
      {/* The saved light theme goes on the same way, so a light workspace never flashes dark. */}
      <InlineScript html={`try{var s=document.currentScript.parentElement;if(localStorage.getItem("mc-sidebar")==="collapsed")s.setAttribute("data-collapsed","true");if(localStorage.getItem("mc-theme")==="light")s.setAttribute("data-theme","light")}catch(e){}`} />
      <Sidebar />
      <Notifier />
      <ServiceWorker />
      <div className={styles.body}>
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
