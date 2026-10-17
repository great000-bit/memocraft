import { Suspense } from "react";
import { FeatureIcon } from "@/components/FeatureIcons";
import { requireUser } from "@/lib/session";
import styles from "@/components/workspace/Workspace.module.css";

async function Greeting() {
  const user = await requireUser();
  const first = user.name.trim().split(/\s+/)[0] || "there";
  return <h1 className={styles.heading}>Welcome, {first}</h1>;
}

export default function DashboardPage() {
  return (
    <>
      <Suspense fallback={<h1 className={styles.heading}>Welcome</h1>}>
        <Greeting />
      </Suspense>
      <p className={styles.sub}>Your deliveries live here. Each one is a single link your clients open on any phone.</p>

      <section className={styles.empty} aria-labelledby="empty-title">
        <span className={styles.emptyIcon}>
          <FeatureIcon name="upload" />
        </span>
        <h2 id="empty-title" className={styles.emptyTitle}>
          Your first delivery starts here
        </h2>
        <p className={styles.emptyBody}>
          Upload finished files, add a short note to each, and share one link. You will see when your client opens it
          and what they download.
        </p>
        <span className={styles.emptyAction} aria-disabled="true">
          New delivery <span className={styles.soon}>Coming next</span>
        </span>
      </section>
    </>
  );
}
