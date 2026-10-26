import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getWorkspace, listWorkspaces, roleLabel } from "@/lib/team";
import { WorkspaceSelect } from "@/components/team/WorkspaceSelect";
import styles from "@/components/team/Team.module.css";

// Shows its children only to people who can change the work in this workspace (the owner and editors).
// Reads the session, so it always sits behind <Suspense>.
export async function EditorOnly({ children }: { children: React.ReactNode }) {
  const workspace = await getWorkspace();
  return workspace.canEdit ? children : null;
}

// The sidebar's switch between your own work and the teams you are on. Hidden for anyone on no team.
export async function TeamSwitcher() {
  const user = await requireUser();
  const [choices, current] = await Promise.all([listWorkspaces(user), getWorkspace()]);
  if (choices.length < 2) return null;
  return <WorkspaceSelect choices={choices.map((c) => ({ ...c, label: c.role === "owner" ? c.name : `${c.name} (${roleLabel[c.role]})` }))} current={current.ownerId} />;
}

// A line at the top of every workspace page while you are in someone else's, so nobody mistakes it for their own.
export async function TeamBanner() {
  const workspace = await getWorkspace();
  if (workspace.role === "owner") return null;
  return (
    <div className={styles.banner} role="status">
      <span>
        You are working in <strong>{workspace.name}</strong> as {workspace.role === "editor" ? "an editor" : "a viewer"}.
        {workspace.canEdit ? " Everything you add goes into their workspace." : " You can look at everything and change nothing."}
      </span>
      <Link href="/team" className={styles.bannerLink}>
        Team
      </Link>
    </div>
  );
}
