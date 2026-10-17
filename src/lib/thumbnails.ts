import type { Delivery } from "./deliveries";
import { presignThumb, storageConfigured } from "./storage";

const withThumbnail = (delivery: Delivery) =>
  delivery.sections.flatMap((section) => section.files).filter((file) => file.attached && file.thumbKey);

// Signed links to the preview pictures, for the signed-in owner's editor and preview. A picture that cannot be
// signed is left out and its card shows an icon instead.
export async function ownerThumbnailLinks(delivery: Delivery): Promise<Record<string, string>> {
  if (!storageConfigured()) return {};
  const files = withThumbnail(delivery);
  const links = await Promise.allSettled(files.map((file) => presignThumb(file.thumbKey as string)));
  const found: Record<string, string> = {};
  links.forEach((link, index) => {
    if (link.status === "fulfilled") found[files[index].id] = link.value;
  });
  return found;
}

// Addresses on the client page. Each one goes through the preview route, which checks that the delivery is published.
export function clientThumbnailPaths(delivery: Delivery): Record<string, string> {
  if (!storageConfigured()) return {};
  const found: Record<string, string> = {};
  for (const file of withThumbnail(delivery)) found[file.id] = `/d/${delivery.slug}/files/${file.id}/preview`;
  return found;
}
