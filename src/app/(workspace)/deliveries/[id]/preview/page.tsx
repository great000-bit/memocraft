import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ClientView } from "@/components/deliveries/ClientView";
import { getDeliveryForOwner } from "@/lib/deliveries";
import { getWorkspace } from "@/lib/team";
import { brandFrom, getStudio, workspaceLogoPath } from "@/lib/studio";
import { ownerCoverLink, ownerThumbnailLinks } from "@/lib/thumbnails";
import styles from "@/components/workspace/Workspace.module.css";

export const metadata: Metadata = { title: "Preview" };

async function Preview({ params }: Pick<PageProps<"/deliveries/[id]/preview">, "params">) {
  const workspace = await getWorkspace();
  const { id } = await params;
  const delivery = await getDeliveryForOwner(id, workspace.ownerId);
  if (!delivery) notFound();
  const [thumbs, studio] = await Promise.all([ownerThumbnailLinks(delivery), getStudio(workspace.ownerId)]);
  const brand = brandFrom(studio, workspaceLogoPath(workspace.ownerId));
  const coverSrc = await ownerCoverLink(delivery, thumbs);
  return (
    <>
      <div className={styles.previewBar}>
        <p>
          Preview: this is what your client sees. {delivery.status === "published" ? "It is published." : "It is still a draft, so the link is off."}
        </p>
        {workspace.canEdit ? (
          <Link href={`/deliveries/${delivery.id}`} className={styles.previewBack}>
            Back to editing
          </Link>
        ) : (
          <Link href="/deliveries" className={styles.previewBack}>
            All deliveries
          </Link>
        )}
      </div>
      <div className={`site-scope ${styles.previewFrame}`}>
        <ClientView delivery={delivery} senderName={brand.name ?? workspace.name} brand={brand} thumbs={thumbs} coverSrc={coverSrc} />
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
