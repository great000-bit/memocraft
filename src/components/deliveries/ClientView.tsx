import Link from "next/link";
import { FeatureIcon } from "../FeatureIcons";
import type { Delivery } from "@/lib/deliveries";
import { formatSize } from "@/lib/storage-limits";
import styles from "./ClientView.module.css";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" });

// What the client sees. Used for the public link and for the owner's preview, so both always match.
export function ClientView({ delivery, senderName }: { delivery: Delivery; senderName: string }) {
  const live = delivery.status === "published";
  // Files that are not in storage yet, and sections left with none, are not shown to the client.
  const sections = delivery.sections
    .map((section) => ({ ...section, files: section.files.filter((file) => file.attached) }))
    .filter((section) => section.files.length > 0);
  return (
    <article className={styles.page}>
      <header className={styles.top}>
        <p className={styles.from}>From {senderName}</p>
        <h1 className={styles.title}>{delivery.title}</h1>
        {delivery.clientName && <p className={styles.for}>For {delivery.clientName}</p>}
        {delivery.message && <p className={styles.message}>{delivery.message}</p>}
        <p className={styles.updated}>Updated {dateFormat.format(delivery.updatedAt)}</p>
      </header>

      {sections.length === 0 && <p className={styles.none}>No files have been added yet.</p>}

      {sections.map((section) => (
        <section key={section.id} className={styles.section} aria-labelledby={`s-${section.id}`}>
          <h2 id={`s-${section.id}`} className={styles.sectionTitle}>
            {section.title}
          </h2>
          {section.note && <p className={styles.sectionNote}>{section.note}</p>}
          <ul className={styles.files}>
            {section.files.map((file) => (
              <li key={file.id} className={styles.file}>
                <span className={styles.fileIcon}>
                  <FeatureIcon name="file" />
                </span>
                <div className={styles.fileBody}>
                  <p className={styles.fileName}>{file.name}</p>
                  {file.note && <p className={styles.fileNote}>{file.note}</p>}
                  <p className={styles.fileMeta}>
                    {file.sizeBytes ? formatSize(file.sizeBytes) : "Ready"}
                    {file.ext ? ` · ${file.ext.toUpperCase()}` : ""}
                  </p>
                </div>
                {live ? (
                  <a href={`/d/${delivery.slug}/files/${file.id}`} className={styles.download}>
                    Download
                    <span className={styles.srOnly}> {file.name}</span>
                  </a>
                ) : (
                  <span className={`${styles.download} ${styles.downloadOff}`} aria-disabled="true">
                    Download
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <footer className={styles.foot}>
        <Link href="/" className={styles.footLink}>
          Sent with Memocraft
        </Link>
      </footer>
    </article>
  );
}
