import Link from "next/link";
import type { FileRequestItem } from "@/lib/requests";
import { setRequestDone } from "@/lib/request-actions";
import { ActionButton } from "./ActionButton";
import { LocalTime } from "./LocalTime";
import styles from "./Requests.module.css";

// Requests from clients, newest open ones first. "inCard" drops the list's own frame when it sits inside a card.
export function RequestList({
  requests,
  showDelivery,
  inCard = false,
}: {
  requests: FileRequestItem[];
  showDelivery: boolean;
  inCard?: boolean;
}) {
  return (
    <ul className={`${styles.list} ${inCard ? styles.inCard : ""}`}>
      {requests.map((request) => (
        <li key={request.id} className={styles.request} data-status={request.status}>
          <div className={styles.main}>
            <p className={styles.message}>{request.message}</p>
            <p className={styles.meta}>
              {request.status === "done" && <span className={styles.done}>Done</span>}{" "}
              {request.fileName ? `About ${request.fileName}` : "Something new"}
              {showDelivery && (
                <>
                  {" · "}
                  <Link href={`/deliveries/${request.deliveryId}`}>{request.deliveryTitle}</Link>
                  {request.clientName ? ` for ${request.clientName}` : ""}
                </>
              )}
              {" · "}
              <LocalTime iso={request.createdAt.toISOString()} />
            </p>
          </div>
          <ActionButton
            action={setRequestDone.bind(null, request.id, request.status === "open")}
            variant={request.status === "open" ? "secondary" : "ghost"}
          >
            {request.status === "open" ? "Mark done" : "Reopen"}
          </ActionButton>
        </li>
      ))}
    </ul>
  );
}
