import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ClientView } from "@/components/deliveries/ClientView";
import { LinkExpired } from "@/components/deliveries/LinkNotice";
import { OpenBeacon } from "@/components/deliveries/OpenBeacon";
import { PasswordGate } from "@/components/deliveries/PasswordGate";
import { getLinkBySlug, getPublishedBySlug } from "@/lib/deliveries";
import { passesPassword } from "@/lib/link-access";
import { clientThumbnailLinks } from "@/lib/thumbnails";

export const metadata: Metadata = { title: "Your delivery" };

async function Delivery({ params }: Pick<PageProps<"/d/[slug]">, "params">) {
  const { slug } = await params;
  const link = await getLinkBySlug(slug);
  if (!link) notFound();
  if (link.expired) return <LinkExpired senderName={link.senderName} brand={link.brand} />;
  if (!(await passesPassword(link.id, link.passwordHash))) return <PasswordGate slug={slug} senderName={link.senderName} brand={link.brand} />;
  const delivery = await getPublishedBySlug(slug);
  if (!delivery) notFound();
  return (
    <>
      <ClientView delivery={delivery} senderName={delivery.senderName}
        brand={delivery.brand}
        thumbs={await clientThumbnailLinks(delivery)} canAsk />
      <OpenBeacon slug={delivery.slug} />
    </>
  );
}

export default function ClientDeliveryPage({ params }: PageProps<"/d/[slug]">) {
  return (
    <Suspense fallback={null}>
      <Delivery params={params} />
    </Suspense>
  );
}
