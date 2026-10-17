import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ClientView } from "@/components/deliveries/ClientView";
import { getPublishedBySlug } from "@/lib/deliveries";

export const metadata: Metadata = { title: "Your delivery" };

async function Delivery({ params }: Pick<PageProps<"/d/[slug]">, "params">) {
  const { slug } = await params;
  const delivery = await getPublishedBySlug(slug);
  if (!delivery) notFound();
  return <ClientView delivery={delivery} senderName={delivery.senderName} />;
}

export default function ClientDeliveryPage({ params }: PageProps<"/d/[slug]">) {
  return (
    <Suspense fallback={null}>
      <Delivery params={params} />
    </Suspense>
  );
}
