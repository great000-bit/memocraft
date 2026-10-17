import type { Metadata, Viewport } from "next";
import { AdminNav } from "@/components/admin/AdminNav";
import { InlineScript } from "@/components/InlineScript";
import { Sidebar } from "@/components/workspace/Sidebar";
import { requireAdmin } from "@/lib/admin";
import styles from "@/components/workspace/Workspace.module.css";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Memocraft admin" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#1a1f1e" };

// The check runs before anything is sent, so anyone who is not an admin gets a real 404 and never sees the shell.
// That makes the console wait for the session on every visit, which is fine for one person's tool.
export const instant = false;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className={`app-scope ${styles.shell}`} data-shell suppressHydrationWarning>
      {/* Same saved sidebar and theme choices as the workspace, applied before the first paint. */}
      <InlineScript html={`try{var s=document.currentScript.parentElement;if(localStorage.getItem("mc-sidebar")==="collapsed")s.setAttribute("data-collapsed","true");if(localStorage.getItem("mc-theme")==="light")s.setAttribute("data-theme","light")}catch(e){}`} />
      <Sidebar nav={<AdminNav />} home="/admin" />
      <div className={styles.body}>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
