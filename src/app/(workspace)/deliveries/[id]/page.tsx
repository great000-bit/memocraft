import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DeliveryEditor } from "@/components/deliveries/DeliveryEditor";
import { getDeliveryForOwner } from "@/lib/deliveries";
import { requireUser } from "@/lib/session";
import styles from "@/components/workspace/Workspace.module.css";

export const metadata: Metadata = { title: "Edit delivery" };

async function Editor({ params }: Pick<PageProps<"/deliveries/[id]">, "params">) {
  const user = await requireUser();
  const { id } = await params;
  const delivery = await getDeliveryForOwner(id, user.id);
  if (!delivery) notFound();
  return <DeliveryEditor delivery={delivery} />;
}

export default function DeliveryPage({ params }: PageProps<"/deliveries/[id]">) {
  return (
    <Suspense fallback={<p className={styles.sub}>Loading delivery…</p>}>
      <Editor params={params} />
    </Suspense>
  );
}
