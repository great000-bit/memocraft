import { FeatureIcon, type FeatureIconName } from "../FeatureIcons";
import { getDashboardStats } from "@/lib/dashboard";
import { requireUser } from "@/lib/session";
import { formatSize } from "@/lib/storage-limits";
import styles from "./Dashboard.module.css";

function Card({
  label,
  icon,
  featured = false,
  children,
}: {
  label: string;
  icon: FeatureIconName;
  featured?: boolean;
  children: React.ReactNode;
}) {
  return (
    <article className={`${styles.card} ${featured ? styles.featured : ""}`}>
      <header className={styles.cardHead}>
        <span className={styles.bubble} aria-hidden="true">
          <FeatureIcon name={icon} />
        </span>
        <h2 className={styles.label}>{label}</h2>
      </header>
      {children}
    </article>
  );
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const size = (bytes: number) => (bytes === 0 ? "0 MB" : formatSize(bytes));

// The three numbers a creative checks first: who they work with, how much room is left, and whether the
// clients they sent to have actually seen their files. Reads the session, so it sits behind <Suspense>.
export async function StatCards() {
  const user = await requireUser();
  const { clients, storage, proof } = await getDashboardStats(user.id);

  const used = Math.min(100, (storage.usedBytes / storage.limitBytes) * 100);
  const free = Math.max(0, storage.limitBytes - storage.usedBytes);
  const downloaded = proof.downloaded;
  const openedOnly = proof.opened - proof.downloaded;
  const waiting = proof.published - proof.opened;

  return (
    <div className={styles.cardsWrap}>
      <div className={styles.cards}>
        <Card label="Clients" icon="people">
          <p className={styles.figure}>{clients.total}</p>
          {clients.total === 0 ? (
            <p className={styles.note}>Name a client on a delivery and they show up here.</p>
          ) : clients.newThisMonth > 0 ? (
            <p className={styles.note}>
              <span className={styles.chip}>+{clients.newThisMonth}</span> new this month
            </p>
          ) : (
            <p className={styles.note}>No new clients this month</p>
          )}
        </Card>

        <Card label="Storage" icon="upload" featured>
          <p className={styles.figure}>
            {size(storage.usedBytes)}
            <span className={styles.unit}>of {formatSize(storage.limitBytes)}</span>
          </p>
          <div
            className={styles.meter}
            role="meter"
            aria-label="Storage used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(used)}
            aria-valuetext={`${size(storage.usedBytes)} of ${formatSize(storage.limitBytes)} used`}
          >
            <span className={styles.meterFill} style={{ width: `${storage.usedBytes > 0 ? Math.max(used, 2) : 0}%` }} />
          </div>
          <p className={styles.note}>
            {used >= 90 ? "Almost full" : `${size(free)} free`} &middot; {plural(storage.fileCount, "file", "files")}
          </p>
        </Card>

        <Card label="Proof of delivery" icon="proof">
          <p className={styles.figure}>
            {proof.opened}
            <span className={styles.unit}>{proof.published === 0 ? "nothing published yet" : `of ${proof.published} opened`}</span>
          </p>
          {proof.published === 0 ? (
            <>
              <div className={styles.segments} data-empty aria-hidden="true" />
              <p className={styles.note}>Publish a delivery and you will see here when clients open it.</p>
            </>
          ) : (
            <>
              <div className={styles.segments} aria-hidden="true">
                {downloaded > 0 && <span data-kind="downloaded" style={{ flexGrow: downloaded }} />}
                {openedOnly > 0 && <span data-kind="opened" style={{ flexGrow: openedOnly }} />}
                {waiting > 0 && <span data-kind="waiting" style={{ flexGrow: waiting }} />}
              </div>
              <ul className={styles.legend}>
                <li data-kind="downloaded">
                  Downloaded <b>{downloaded}</b>
                </li>
                <li data-kind="opened">
                  Opened <b>{openedOnly}</b>
                </li>
                <li data-kind="waiting">
                  Not opened <b>{waiting}</b>
                </li>
              </ul>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

export function StatCardsFallback() {
  return (
    <div className={styles.cardsWrap} aria-hidden="true">
      <div className={styles.cards}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={`${styles.card} ${styles.skeleton}`} />
        ))}
      </div>
    </div>
  );
}
