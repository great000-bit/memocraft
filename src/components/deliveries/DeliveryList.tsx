import Link from "next/link";
import type { DeliverySummary } from "@/lib/deliveries";
import styles from "./DeliveryList.module.css";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

export function DeliveryList({ deliveries }: { deliveries: DeliverySummary[] }) {
  return (
    <ul className={styles.list}>
      {deliveries.map((delivery) => (
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
            <span className={styles.pill} data-status={delivery.status}>
              {delivery.status === "published" ? "Published" : "Draft"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
