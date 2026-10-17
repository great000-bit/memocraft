import Link from "next/link";
import { FeatureIcon } from "../FeatureIcons";
import { downloadName, type Delivery, type DeliveryFile } from "@/lib/deliveries";
import { saveLimits, saveType, type SaveTarget } from "@/lib/save-to-phone";
import { formatSize } from "@/lib/storage-limits";
import { AskAbout, RequestFile } from "./RequestFile";
import { SaveToPhone } from "./SaveToPhone";
import styles from "./ClientView.module.css";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" });
const shortDate = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" });

// A file added or replaced after the link first went out is marked, so a client coming back knows what changed.
function fileMark(file: DeliveryFile, publishedAt: Date | null): { kind: "new" | "updated"; text: string } | null {
  if (!publishedAt) return null;
  if (file.addedAt > publishedAt) return { kind: "new", text: "New" };
  if (file.replacedAt && file.replacedAt > publishedAt) return { kind: "updated", text: `Updated ${shortDate.format(file.replacedAt)}` };
  return null;
}

function fileMeta(file: DeliveryFile): string {
  return `${file.sizeBytes ? formatSize(file.sizeBytes) : "Ready"}${file.ext ? ` · ${file.ext.toUpperCase()}` : ""}`;
}

// The photo library takes pictures and videos only, and only up to a size a phone can hold in memory.
function saveTarget(slug: string, file: DeliveryFile): SaveTarget | null {
  const type = saveType(file.mimeType, file.ext);
  if (!type || (file.sizeBytes ?? 0) > saveLimits.fileBytes) return null;
  return {
    id: file.id,
    fileName: downloadName(file.name, file.ext),
    url: `/d/${slug}/files/${file.id}`,
    type,
    size: file.sizeBytes ?? 0,
  };
}

function SaveFile({
  target,
  live,
  label,
  className,
}: {
  target: SaveTarget | undefined;
  live: boolean;
  label: string;
  className: string;
}) {
  if (!target) return null;
  return <SaveToPhone targets={[target]} label={label} disabled={!live} className={className} />;
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
  canAsk = false,
}: {
  delivery: Delivery;
  senderName: string;
  thumbs?: Record<string, string>;
  // True on the public page, where a client may ask for a file. The owner's preview shows the page without it.
  canAsk?: boolean;
}) {
  const live = delivery.status === "published";
  // Files that are not in storage yet, and sections left with none, are not shown to the client.
  const sections = delivery.sections
    .map((section) => ({ ...section, files: section.files.filter((file) => file.attached) }))
    .filter((section) => section.files.length > 0);
  const targets = new Map<string, SaveTarget>();
  for (const section of sections) {
    for (const file of section.files) {
      const target = saveTarget(delivery.slug, file);
      if (target) targets.set(file.id, target);
    }
  }
  const saveAll = [...targets.values()];
  const askable = canAsk && live;
  const [latest, ...earlier] = delivery.updates;
  const mark = (file: DeliveryFile) => {
    const found = fileMark(file, delivery.publishedAt);
    return found && <span className={styles.chip} data-kind={found.kind}>{found.text}</span>;
  };
  return (
    <article className={styles.page}>
      <header className={styles.top}>
        <p className={styles.from}>From {senderName}</p>
        <h1 className={styles.title}>{delivery.title}</h1>
        {delivery.clientName && <p className={styles.for}>For {delivery.clientName}</p>}
        {delivery.message && <p className={styles.message}>{delivery.message}</p>}
        {delivery.publishedAt && <p className={styles.updated}>Sent {dateFormat.format(delivery.publishedAt)}</p>}
      </header>

      {latest && (
        <aside className={styles.update} aria-label="Latest update">
          <p className={styles.updateHead}>
            <span className={styles.chip} data-kind="updated">
              Updated
            </span>
            {dateFormat.format(latest.createdAt)}
          </p>
          <p className={styles.updateNote}>{latest.note}</p>
          {earlier.length > 0 && (
            <details className={styles.earlier}>
              <summary>Earlier updates ({earlier.length})</summary>
              <ul>
                {earlier.map((update) => (
                  <li key={update.id}>
                    <time dateTime={update.createdAt.toISOString()}>{dateFormat.format(update.createdAt)}</time>
                    {update.note}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </aside>
      )}

      {sections.length === 0 && <p className={styles.none}>No files have been added yet.</p>}

      {saveAll.length > 1 && (
        <div className={styles.saveAll}>
          <SaveToPhone
            targets={saveAll}
            label={`Save all ${saveAll.length} to your phone`}
            disabled={!live}
            className={styles.download}
          />
        </div>
      )}

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
                      <p className={styles.tileName}>
                        {file.name}
                        {mark(file)}
                      </p>
                      {file.note && <p className={styles.fileNote}>{file.note}</p>}
                      <p className={styles.fileMeta}>{fileMeta(file)}</p>
                      {askable && <AskAbout fileId={file.id} />}
                    </div>
                    <div className={styles.tileActions}>
                      <SaveFile target={targets.get(file.id)} live={live} label="Save" className={`${styles.download} ${styles.tileSave}`} />
                      <DownloadButton
                        file={file}
                        href={live ? `/d/${delivery.slug}/files/${file.id}` : null}
                        className={`${styles.download} ${styles.tileDownload}`}
                      />
                    </div>
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
                      <p className={styles.fileName}>
                        {file.name}
                        {mark(file)}
                      </p>
                      {file.note && <p className={styles.fileNote}>{file.note}</p>}
                      <p className={styles.fileMeta}>{fileMeta(file)}</p>
                      {askable && <AskAbout fileId={file.id} />}
                    </div>
                    <div className={styles.rowActions}>
                      <SaveFile
                        target={targets.get(file.id)}
                        live={live}
                        label="Save to phone"
                        className={`${styles.download} ${styles.rowSave}`}
                      />
                      <DownloadButton
                        file={file}
                        href={live ? `/d/${delivery.slug}/files/${file.id}` : null}
                        className={`${styles.download} ${styles.rowDownload}`}
                      />
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </section>
      ))}

      {askable && (
        <RequestFile
          slug={delivery.slug}
          senderName={senderName}
          files={sections.flatMap((section) => section.files.map((file) => ({ id: file.id, name: file.name })))}
        />
      )}

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
