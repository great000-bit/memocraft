import Link from "next/link";
import { FeatureIcon } from "../FeatureIcons";
import type { Delivery, DeliveryFile } from "@/lib/deliveries";
import { formatSize } from "@/lib/storage-limits";
import styles from "./ClientView.module.css";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" });

function fileMeta(file: DeliveryFile): string {
  return `${file.sizeBytes ? formatSize(file.sizeBytes) : "Ready"}${file.ext ? ` · ${file.ext.toUpperCase()}` : ""}`;
}

function DownloadButton({ file, href, className }: { file: DeliveryFile; href: string | null; className: string }) {
  if (!href) {
    return (
      <span className={`${className} ${styles.downloadOff}`} aria-disabled="true">
        Download
      </span>
    );
  }
  return (
    <a href={href} className={className}>
      Download
      <span className={styles.srOnly}> {file.name}</span>
    </a>
  );
}

// What the client sees. Used for the public link and for the owner's preview, so both always match.
// "thumbs" maps a file to the address of its small picture; files without one are listed as plain rows.
export function ClientView({
  delivery,
  senderName,
  thumbs = {},
}: {
  delivery: Delivery;
  senderName: string;
  thumbs?: Record<string, string>;
}) {
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
          {section.files.some((file) => thumbs[file.id]) && (
            <ul className={styles.tiles}>
              {section.files
                .filter((file) => thumbs[file.id])
                .map((file) => (
                  <li key={file.id} className={styles.tile}>
                    <div className={styles.photo}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- a signed storage link, not a site asset */}
                      <img src={thumbs[file.id]} alt={file.name} loading="lazy" decoding="async" />
                    </div>
                    <div className={styles.tileBody}>
                      <p className={styles.tileName}>{file.name}</p>
                      {file.note && <p className={styles.fileNote}>{file.note}</p>}
                      <p className={styles.fileMeta}>{fileMeta(file)}</p>
                    </div>
                    <DownloadButton
                      file={file}
                      href={live ? `/d/${delivery.slug}/files/${file.id}` : null}
                      className={`${styles.download} ${styles.tileDownload}`}
                    />
                  </li>
                ))}
            </ul>
          )}
          {section.files.some((file) => !thumbs[file.id]) && (
            <ul className={styles.files}>
              {section.files
                .filter((file) => !thumbs[file.id])
                .map((file) => (
                  <li key={file.id} className={styles.file}>
                    <span className={styles.fileIcon}>
                      <FeatureIcon name="file" />
                    </span>
                    <div className={styles.fileBody}>
                      <p className={styles.fileName}>{file.name}</p>
                      {file.note && <p className={styles.fileNote}>{file.note}</p>}
                      <p className={styles.fileMeta}>{fileMeta(file)}</p>
                    </div>
                    <DownloadButton
                      file={file}
                      href={live ? `/d/${delivery.slug}/files/${file.id}` : null}
                      className={styles.download}
                    />
                  </li>
                ))}
            </ul>
          )}
        </section>
      ))}

      <footer className={styles.foot}>
        {live && (
          <p className={styles.notice}>
            {senderName} sees when you open this page or start a download, and the kind of device, such as iPhone.
          </p>
        )}
        <Link href="/" className={styles.footLink}>
          Sent with Memocraft
        </Link>
      </footer>
    </article>
  );
}
