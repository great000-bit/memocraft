import styles from "./Workspace.module.css";

// Shown for the moment a page's data is on its way, so a tap always answers at once.
export function PageSkeleton({ blocks = 2, label = "Loading" }: { blocks?: number; label?: string }) {
  return (
    <div className={styles.skeleton} role="status" aria-label={label}>
      {Array.from({ length: blocks }, (_, i) => (
        <i key={i} />
      ))}
    </div>
  );
}
