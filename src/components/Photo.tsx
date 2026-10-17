import Image from "next/image";
import { photos, type PhotoKey } from "./photos";
import styles from "./Photo.module.css";

// Fills its positioned parent. Decorative: the mockup around it carries the label.
export function Photo({ name, sizes }: { name: PhotoKey; sizes: string }) {
  const photo = photos[name];
  return (
    <Image
      src={photo.src}
      alt=""
      fill
      sizes={sizes}
      className={styles.photo}
      style={{ objectPosition: photo.focus }}
    />
  );
}
