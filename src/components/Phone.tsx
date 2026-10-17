import styles from "./Phone.module.css";

type PhoneProps = { children: React.ReactNode; className?: string; label: string; tilt?: boolean };

const SLICES = Array.from({ length: 16 }, (_, i) => i + 1);

// iPhone-style device frame in blue titanium: Dynamic Island, status bar and home indicator.
// `tilt` turns it in 3D and stacks thin slices behind the face so the right edge has real thickness.
export function Phone({ children, className = "", label, tilt = false }: PhoneProps) {
  return (
    <div className={`${styles.device} ${tilt ? styles.tilt : ""} ${className}`} role="img" aria-label={label}>
      {tilt &&
        SLICES.map((z) => (
          <i key={z} className={styles.slice} style={{ "--z": z } as React.CSSProperties} aria-hidden="true" />
        ))}
      <span className={`${styles.button} ${styles.action}`} aria-hidden="true" />
      <span className={`${styles.button} ${styles.volUp}`} aria-hidden="true" />
      <span className={`${styles.button} ${styles.volDown}`} aria-hidden="true" />
      <span className={`${styles.button} ${styles.power}`} aria-hidden="true" />
      <div className={styles.screen}>
        <div className={styles.status} aria-hidden="true">
          <span className={styles.time}>9:41</span>
          <span className={styles.island} />
          <span className={styles.icons}>
            <svg viewBox="0 0 18 12">
              <rect x="0" y="8" width="3" height="4" rx="1" />
              <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
              <rect x="10" y="3" width="3" height="9" rx="1" />
              <rect x="15" y="0" width="3" height="12" rx="1" />
            </svg>
            <svg viewBox="0 0 16 12">
              <path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0L8 11.5Zm-4-4.1-1.6-1.6a7.9 7.9 0 0 1 11.2 0L12 7.4a5.6 5.6 0 0 0-8 0ZM.8 4.2-.8 2.6a12.4 12.4 0 0 1 17.6 0l-1.6 1.6a10.1 10.1 0 0 0-14.4 0Z" />
            </svg>
            <svg viewBox="0 0 27 12">
              <rect x="0.5" y="0.5" width="22" height="11" rx="3.5" fill="none" stroke="currentColor" opacity="0.4" />
              <rect x="2" y="2" width="17" height="8" rx="2" />
              <path d="M24 4v4a2 2 0 0 0 0-4Z" opacity="0.4" />
            </svg>
          </span>
        </div>
        <div className={styles.content}>{children}</div>
        <span className={styles.home} aria-hidden="true" />
      </div>
    </div>
  );
}
