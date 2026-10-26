import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/workspace/PageSkeleton";
import { Button } from "@/components/Button";
import { DeliveryList } from "@/components/deliveries/DeliveryList";
import { listDeliveries } from "@/lib/deliveries";
import { workspaceOwnerId } from "@/lib/team";
import { EditorOnly } from "@/components/workspace/TeamSwitcher";
import styles from "@/components/workspace/Workspace.module.css";

export const metadata: Metadata = { title: "Deliveries" };

async function All() {
  const deliveries = await listDeliveries(await workspaceOwnerId(), 200);
  if (deliveries.length === 0) return <p className={styles.sub}>Nothing here yet. Your first delivery will show up in this list.</p>;
  return <DeliveryList deliveries={deliveries} />;
}

export default function DeliveriesPage() {
  return (
    <>
      <div className={styles.headRow}>
        <h1 className={styles.heading}>Deliveries</h1>
        <Suspense fallback={null}>
          <EditorOnly>
            <Button href="/deliveries/new">New delivery</Button>
          </EditorOnly>
        </Suspense>
      </div>
      <Suspense fallback={<PageSkeleton blocks={2} />}>
        <All />
      </Suspense>
    </>
  );
}
