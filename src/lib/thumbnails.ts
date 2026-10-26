import type { Delivery } from "./deliveries";
import { presignClientThumb, presignThumb, storageConfigured } from "./storage";

const withThumbnail = (delivery: Delivery) =>
  delivery.sections.flatMap((section) => section.files).filter((file) => file.attached && file.thumbKey);

async function signAll(delivery: Delivery, sign: (key: string) => Promise<string>): Promise<Record<string, string>> {
  if (!storageConfigured()) return {};
  const files = withThumbnail(delivery);
  const links = await Promise.allSettled(files.map((file) => sign(file.thumbKey as string)));
  const found: Record<string, string> = {};
  links.forEach((link, index) => {
    if (link.status === "fulfilled") found[files[index].id] = link.value;
  });
  return found;
}

// Signed links to the preview pictures, for the signed-in owner's editor and preview. A picture that cannot be
// signed is left out and its card shows an icon instead.
export const ownerThumbnailLinks = (delivery: Delivery) => signAll(delivery, presignThumb);

// Signed links for the client page, made only after the page has checked the link is live and unlocked. Signing
// needs no network, so each picture goes straight to storage instead of through a server check of its own first.
export const clientThumbnailLinks = (delivery: Delivery) => signAll(delivery, presignClientThumb);

// The cover's picture: a picture the creative uploaded for it, or the large copy made from a photo, else the chosen photo's preview, else the first photo's. The large
// copy is only used while the photo it came from is still in the delivery.
async function coverLink(delivery: Delivery, thumbs: Record<string, string>, sign: (key: string) => Promise<string>): Promise<string | null> {
  const { fileId, key } = delivery.cover;
  const chosen = fileId ? withThumbnail(delivery).find((file) => file.id === fileId) ?? null : null;
  const stillThere = fileId && delivery.sections.some((section) => section.files.some((file) => file.id === fileId && file.attached));
  if (key && (stillThere || delivery.cover.source === "upload") && storageConfigured()) {
    try {
      return await sign(key);
    } catch {
      // Fall through to the preview.
    }
  }
  if (chosen && thumbs[chosen.id]) return thumbs[chosen.id];
  const first = withThumbnail(delivery).find((file) => thumbs[file.id]);
  return first ? thumbs[first.id] : null;
}

export const ownerCoverLink = (delivery: Delivery, thumbs: Record<string, string>) => coverLink(delivery, thumbs, presignThumb);
export const clientCoverLink = (delivery: Delivery, thumbs: Record<string, string>) => coverLink(delivery, thumbs, presignClientThumb);
