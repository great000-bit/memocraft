import Link from "next/link";
import type { DeliverySummary } from "@/lib/deliveries";
import styles from "./DeliveryList.module.css";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

function proof(delivery: DeliverySummary): { text: string; state: "waiting" | "opened" | "downloaded" } | null {
  if (delivery.status !== "published") return null;
  if (delivery.downloads > 0) return { text: "Downloaded", state: "downloaded" };
  if (delivery.opens > 0) return { text: "Opened", state: "opened" };
  return { text: "Not opened yet", state: "waiting" };
}

export function DeliveryList({ deliveries }: { deliveries: DeliverySummary[] }) {
  return (
    <ul className={styles.list}>
      {deliveries.map((delivery) => {
        const seen = proof(delivery);
        return (
          <li key={delivery.id}>
            <Link href={`/deliveries/${delivery.id}`} className={styles.row}>
              <span className={styles.main}>
                <span className={styles.title}>{delivery.title}</span>
                <span className={styles.meta}>
                  {delivery.clientName ? `${delivery.clientName} · ` : ""}
                  {delivery.fileCount === 1 ? "1 file" : `${delivery.fileCount} files`} · Edited{" "}
                  {dateFormat.format(delivery.updatedAt)}
                </span>
              </span>
              <span className={styles.pills}>
                {seen && (
                  <span className={styles.pill} data-proof={seen.state}>
                    {seen.text}
                  </span>
                )}
                <span className={styles.pill} data-status={delivery.status}>
                  {delivery.status === "published" ? "Published" : "Draft"}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
