import { FeatureIcon } from "../FeatureIcons";
import styles from "./LinkGate.module.css";

// Shown instead of a delivery whose link has passed its expiry date. The client holds the link, so telling them
// why it stopped is kinder than a blank "not available".
export function LinkExpired({ senderName }: { senderName: string }) {
  return (
    <main className={styles.page}>
      <span className={styles.badge} aria-hidden="true">
        <FeatureIcon name="history" />
      </span>
      <div className={styles.top}>
        <h1 className={styles.title}>This link has expired</h1>
        <p className={styles.text}>
          {senderName} set this delivery to stop working after a date, and that date has passed. Ask them to send you a new link.
        </p>
      </div>
    </main>
  );
}
