import Link from "next/link";
import { requireUser } from "@/lib/session";
import { Avatar } from "./Avatar";
import { SignOutButton } from "./SignOutButton";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./Workspace.module.css";

// Reads the session, so it always sits behind <Suspense>.
export async function UserMenu() {
  const user = await requireUser();
  return (
    <div className={styles.user}>
      <Link href="/profile" className={styles.userLink} aria-label={`Your profile, ${user.name}`}>
        <Avatar name={user.name} image={user.image} size={36} />
        <span className={styles.userText}>
          <span className={styles.userName}>{user.name}</span>
          <span className={styles.userEmail}>{user.email}</span>
        </span>
      </Link>
      <ThemeToggle />
      <SignOutButton />
    </div>
  );
}

export function UserMenuFallback() {
  return <div className={styles.user} aria-hidden="true" />;
}
