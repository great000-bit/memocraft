import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/workspace/PageSkeleton";
import { RequestList } from "@/components/deliveries/RequestList";
import requestStyles from "@/components/deliveries/Requests.module.css";
import { listRequests } from "@/lib/requests";
import { workspaceOwnerId } from "@/lib/team";
import styles from "@/components/workspace/Workspace.module.css";

export const metadata: Metadata = { title: "Requests" };

async function All() {
  const requests = await listRequests(await workspaceOwnerId());
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
      <Suspense fallback={<PageSkeleton blocks={2} />}>
        <All />
      </Suspense>
    </>
  );
}
