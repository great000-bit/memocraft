import type { Metadata } from "next";
import { Suspense } from "react";
import { RequestList } from "@/components/deliveries/RequestList";
import requestStyles from "@/components/deliveries/Requests.module.css";
import { listRequests } from "@/lib/requests";
import { requireUser } from "@/lib/session";
import styles from "@/components/workspace/Workspace.module.css";

export const metadata: Metadata = { title: "Requests" };

async function All() {
  const user = await requireUser();
  const requests = await listRequests(user.id);
  if (requests.length === 0) {
    return (
      <p className={requestStyles.empty}>
        Nothing yet. When a client asks for another format or a missing file from their link, it shows up here.
      </p>
    );
  }
  return <RequestList requests={requests} showDelivery />;
}

export default function RequestsPage() {
  return (
    <>
      <div className={styles.headRow}>
        <h1 className={styles.heading}>Requests</h1>
      </div>
      <p className={styles.sub}>What your clients asked for from their links. Mark each one done when you have sent it.</p>
      <Suspense fallback={null}>
        <All />
      </Suspense>
    </>
  );
}
