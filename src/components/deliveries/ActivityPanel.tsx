import type { Activity } from "@/lib/delivery-events";
import { FeatureIcon } from "../FeatureIcons";
import { LocalTime } from "./LocalTime";
import styles from "./Activity.module.css";

function headline(activity: Activity): { text: string; state: "waiting" | "opened" | "downloaded" } {
  if (activity.downloads > 0) return { text: "Downloaded", state: "downloaded" };
  if (activity.opens > 0) return { text: "Opened", state: "opened" };
  return { text: "Not opened yet", state: "waiting" };
}

// What the client has done with the link, as a record the creative can point to.
export function ActivityPanel({ activity, published, deliveryId }: { activity: Activity; published: boolean; deliveryId: string }) {
  if (!published && activity.recent.length === 0) return null;
  const status = headline(activity);
  return (
    <section className={styles.panel} aria-labelledby="proof-title">
      <div className={styles.head}>
        <h2 id="proof-title" className={styles.title}>
          Proof of delivery
        </h2>
        <span className={styles.badge} data-state={status.state}>
          {status.text}
        </span>
      </div>

      {activity.recent.length === 0 ? (
        <p className={styles.empty}>Nothing yet. When your client opens the link or starts a download, it shows up here with the time.</p>
      ) : (
        <>
          <dl className={styles.stats}>
            <div className={styles.stat}>
              <dt>First opened</dt>
              <dd>
                {activity.firstOpenedAt ? (
                  <>
                    <LocalTime iso={activity.firstOpenedAt.toISOString()} />
                    {activity.firstOpenedOn ? ` on ${activity.firstOpenedOn}` : ""}
                  </>
                ) : (
                  "Not yet"
                )}
              </dd>
            </div>
            <div className={styles.stat}>
              <dt>Times opened</dt>
              <dd>{activity.opens}</dd>
            </div>
            <div className={styles.stat}>
              <dt>Downloads started</dt>
              <dd>{activity.downloads}</dd>
            </div>
          </dl>
          <ul className={styles.events}>
            {activity.recent.map((event) => (
              <li key={event.id} className={styles.event}>
                <span className={styles.what}>
                  {event.kind === "open" ? "Opened the page" : `Downloaded ${event.fileName ?? "a file"}`}
                </span>
                <span className={styles.when}>
                  {event.device} · <LocalTime iso={event.at.toISOString()} />
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <a href={`/api/deliveries/${deliveryId}/proof`} className={styles.pdf} download>
        <FeatureIcon name="file" />
        Download proof of delivery (PDF)
      </a>

      <p className={styles.note}>
        Your own visits while you are signed in are not counted, and neither are link previews. A download counts when it
        starts.
      </p>
    </section>
  );
}
