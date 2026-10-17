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
