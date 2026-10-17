import { avatarSource, initialsOf } from "@/lib/avatar";
import styles from "./Workspace.module.css";

type AvatarProps = {
  name: string;
  image?: string | null;
  size: number;
  // A picture the browser just made, shown before it is saved.
  previewSrc?: string | null;
};

// Initials sit underneath and the picture covers them, so a picture that is slow or fails to load never leaves a hole.
export function Avatar({ name, image, size, previewSrc }: AvatarProps) {
  const src = previewSrc ?? avatarSource(image, size * 2);
  return (
    <span className={styles.avatar} style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }} aria-hidden="true">
      {initialsOf(name)}
      {src && (
        // eslint-disable-next-line @next/next/no-img-element -- a Google address or a sign-in-gated route, already sized for this circle
        <img className={styles.avatarImage} src={src} alt="" width={size} height={size} referrerPolicy="no-referrer" />
      )}
    </span>
  );
}
