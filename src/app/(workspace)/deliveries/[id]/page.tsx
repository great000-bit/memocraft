import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/workspace/PageSkeleton";
import { DeliveryEditor } from "@/components/deliveries/DeliveryEditor";
import { getDeliveryForOwner } from "@/lib/deliveries";
import { getActivity } from "@/lib/delivery-events";
import { listRequests } from "@/lib/requests";
import { getWorkspace } from "@/lib/team";
import { brandFrom, getStudio, workspaceLogoPath } from "@/lib/studio";

export const maxDuration = 60;

export const metadata: Metadata = { title: "Edit delivery" };

async function Editor({ params }: Pick<PageProps<"/deliveries/[id]">, "params">) {
  const workspace = await getWorkspace();
  const { id } = await params;
  // A viewer on the team sees the delivery the way the client does, with nothing to change.
  if (!workspace.canEdit) redirect(`/deliveries/${id}/preview`);
  const delivery = await getDeliveryForOwner(id, workspace.ownerId);
  if (!delivery) notFound();
  const [activity, requests, studio] = await Promise.all([
    getActivity(delivery.id, workspace.ownerId),
    listRequests(workspace.ownerId, { deliveryId: delivery.id }),
    getStudio(workspace.ownerId),
  ]);
  const brand = brandFrom(studio, workspaceLogoPath(workspace.ownerId));
  return <DeliveryEditor delivery={delivery} activity={activity} requests={requests} brand={brand} senderName={brand.name ?? workspace.name} />;
}

export default function DeliveryPage({ params }: PageProps<"/deliveries/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton blocks={4} label="Loading delivery" />}>
      <Editor params={params} />
    </Suspense>
  );
}
