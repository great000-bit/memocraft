import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ClientView } from "@/components/deliveries/ClientView";
import { LinkExpired } from "@/components/deliveries/LinkNotice";
import { OpenBeacon } from "@/components/deliveries/OpenBeacon";
import { PasswordGate } from "@/components/deliveries/PasswordGate";
import { getLinkBySlug, getPublishedBySlug } from "@/lib/deliveries";
import { loadFeedback } from "@/lib/feedback";
import { hostOf, isAppHost } from "@/lib/hosts";
import { passesPassword } from "@/lib/link-access";
import { clientThumbnailPaths } from "@/lib/thumbnails";

export const metadata: Metadata = { title: "Your delivery" };

// On a creative's own address, only that creative's links open.
async function wrongHost(customDomain: string | null): Promise<boolean> {
  const host = (await headers()).get("host");
  return !isAppHost(host) && hostOf(host) !== customDomain;
}

async function Delivery({ params }: Pick<PageProps<"/d/[slug]">, "params">) {
  const { slug } = await params;
  const link = await getLinkBySlug(slug);
  if (!link || (await wrongHost(link.customDomain))) notFound();
  if (link.expired) return <LinkExpired senderName={link.senderName} brand={link.brand} />;
  if (!(await passesPassword(link.id, link.passwordHash))) return <PasswordGate slug={slug} senderName={link.senderName} brand={link.brand} />;
  const delivery = await getPublishedBySlug(slug);
  if (!delivery) notFound();
  const feedback = await loadFeedback(delivery);
  return (
    <>
      <ClientView delivery={delivery} senderName={delivery.senderName}
        brand={delivery.brand}
        thumbs={clientThumbnailPaths(delivery)} canAsk
        feedback={feedback}
        showBranding={delivery.showBranding} />
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
