import { Logo } from "../Logo";
import { logoBox, type Brand } from "@/lib/brand";
import styles from "./ClientBrand.module.css";

// The top of every client page: the creative's logo and studio name. A creative who has set neither gets a small
// Memocraft mark, so the page never opens on an empty bar.
export function ClientBrand({ brand }: { brand: Brand }) {
  if (!brand.logoSrc && !brand.name) {
    return (
      <div className={styles.brand}>
        <Logo className={styles.fallback} />
      </div>
    );
  }
  const box = logoBox(brand, 56, 240);
  return (
    <div className={styles.brand}>
      {brand.logoSrc && (
        // eslint-disable-next-line @next/next/no-img-element -- served from the link's own route, already sized
        <img
          className={styles.logo}
          src={brand.logoSrc}
          alt={brand.name ? "" : "Logo"}
          width={box.width}
          height={box.height}
        />
      )}
      {brand.name && <p className={styles.name}>{brand.name}</p>}
    </div>
  );
}
