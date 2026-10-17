import { requireUser } from "@/lib/session";
import { SignOutButton } from "./SignOutButton";
import styles from "./Workspace.module.css";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "")).toUpperCase() || "M";
}

// Reads the session, so it always sits behind <Suspense>.
export async function UserMenu() {
  const user = await requireUser();
  return (
    <div className={styles.user}>
      <span className={styles.avatar} aria-hidden="true">
        {initials(user.name)}
      </span>
      <div className={styles.userText}>
        <p className={styles.userName}>{user.name}</p>
        <p className={styles.userEmail}>{user.email}</p>
      </div>
      <SignOutButton />
    </div>
  );
}

export function UserMenuFallback() {
  return <div className={styles.user} aria-hidden="true" />;
}
