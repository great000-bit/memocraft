import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/workspace/PageSkeleton";
import { DeliveryEditor } from "@/components/deliveries/DeliveryEditor";
import { getDeliveryForOwner } from "@/lib/deliveries";
import { getActivity } from "@/lib/delivery-events";
import { listRequests } from "@/lib/requests";
import { requireUser } from "@/lib/session";
import { brandFrom, getStudio, ownerLogoPath } from "@/lib/studio";

export const maxDuration = 60;

export const metadata: Metadata = { title: "Edit delivery" };

async function Editor({ params }: Pick<PageProps<"/deliveries/[id]">, "params">) {
  const user = await requireUser();
  const { id } = await params;
  const delivery = await getDeliveryForOwner(id, user.id);
  if (!delivery) notFound();
  const [activity, requests, studio] = await Promise.all([
    getActivity(delivery.id, user.id),
    listRequests(user.id, { deliveryId: delivery.id }),
    getStudio(user.id),
  ]);
  const brand = brandFrom(studio, ownerLogoPath);
  return <DeliveryEditor delivery={delivery} activity={activity} requests={requests} brand={brand} senderName={brand.name ?? user.name} />;
}

export default function DeliveryPage({ params }: PageProps<"/deliveries/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton blocks={4} label="Loading delivery" />}>
      <Editor params={params} />
    </Suspense>
  );
}
