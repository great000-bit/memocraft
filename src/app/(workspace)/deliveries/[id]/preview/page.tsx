import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ClientView } from "@/components/deliveries/ClientView";
import { getDeliveryForOwner } from "@/lib/deliveries";
import { requireUser } from "@/lib/session";
import { brandFrom, getStudio, ownerLogoPath } from "@/lib/studio";
import { ownerThumbnailLinks } from "@/lib/thumbnails";
import styles from "@/components/workspace/Workspace.module.css";

export const metadata: Metadata = { title: "Preview" };

async function Preview({ params }: Pick<PageProps<"/deliveries/[id]/preview">, "params">) {
  const user = await requireUser();
  const { id } = await params;
  const delivery = await getDeliveryForOwner(id, user.id);
  if (!delivery) notFound();
  const [thumbs, studio] = await Promise.all([ownerThumbnailLinks(delivery), getStudio(user.id)]);
  const brand = brandFrom(studio, ownerLogoPath);
  return (
    <>
      <div className={styles.previewBar}>
        <p>
          Preview: this is what your client sees. {delivery.status === "published" ? "It is published." : "It is still a draft, so the link is off."}
        </p>
        <Link href={`/deliveries/${delivery.id}`} className={styles.previewBack}>
          Back to editing
        </Link>
      </div>
      <div className={`site-scope ${styles.previewFrame}`}>
        <ClientView delivery={delivery} senderName={brand.name ?? user.name} brand={brand} thumbs={thumbs} />
      </div>
    </>
  );
}

export default function PreviewPage({ params }: PageProps<"/deliveries/[id]/preview">) {
  return (
    <Suspense fallback={<p className={styles.sub}>Loading preview…</p>}>
      <Preview params={params} />
    </Suspense>
  );
}
