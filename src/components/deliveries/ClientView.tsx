import Link from "next/link";
import { FeatureIcon } from "../FeatureIcons";
import { noBrand, type Brand } from "@/lib/brand";
import { downloadName, type Delivery, type DeliveryFile } from "@/lib/deliveries";
import { saveLimits, saveType, type SaveTarget } from "@/lib/save-to-phone";
import { formatSize } from "@/lib/storage-limits";
import { ClientBrand } from "./ClientBrand";
import { Gallery } from "./Gallery";
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

function DownloadIcon() {
  return (
    <svg className={styles.dlIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" />
    </svg>
  );
}

function DownloadButton({ file, href, className }: { file: DeliveryFile; href: string | null; className: string }) {
  if (!href) {
    return (
      <span className={`${className} ${styles.downloadOff}`} aria-disabled="true">
        <DownloadIcon />
        <span className={styles.dlLabel}>Download</span>
      </span>
    );
  }
  return (
    <a href={href} className={className}>
      <DownloadIcon />
      <span className={styles.dlLabel}>Download</span>
      <span className={styles.srOnly}> {file.name}</span>
    </a>
  );
}

// What the client sees. Used for the public link and for the owner's preview, so both always match.
// "thumbs" maps a file to the address of its small picture; files without one are listed as plain rows.
export function ClientView({
  delivery,
  senderName,
  brand = noBrand,
  thumbs = {},
  canAsk = false,
}: {
  delivery: Delivery;
  // The studio name when one is set, else the person's own name.
  senderName: string;
  brand?: Brand;
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
  const mark = (file: DeliveryFile, floating = false) => {
    const found = fileMark(file, delivery.publishedAt);
    return found && <span className={`${styles.chip} ${floating ? styles.chipFloat : ""}`} data-kind={found.kind}>{found.text}</span>;
  };

  const files = sections.flatMap((section) => section.files);
  const totalBytes = files.reduce((sum, file) => sum + (file.sizeBytes ?? 0), 0);
  // Up to three of the pictures lead the page as a collage; on a narrow screen it is left out, as the pictures follow right away.
  const lead = files.filter((file) => thumbs[file.id]).slice(0, 3);
  const eyebrow = [delivery.clientName && `For ${delivery.clientName}`, !brand.name && `From ${senderName}`].filter(Boolean).join(" \u00b7 ");

  return (
    <article className={styles.page}>
      <header className={styles.bar}>
        <div className={styles.barInner}>
          <ClientBrand brand={brand} />
          {askable && (
            <a href="#ask" className={styles.barAsk}>
              Request a file
            </a>
          )}
        </div>
      </header>

      <div className={styles.wrap}>
        <section className={styles.hero} data-art={lead.length > 0 ? lead.length : undefined} aria-labelledby="delivery-title">
          <div className={styles.heroText}>
            {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
            <h1 id="delivery-title" className={styles.title}>
              {delivery.title}
            </h1>
            {delivery.message && <p className={styles.message}>{delivery.message}</p>}
            <ul className={styles.facts}>
              {files.length > 0 && <li>{files.length === 1 ? "1 file" : `${files.length} files`}</li>}
              {totalBytes > 0 && <li>{formatSize(totalBytes)}</li>}
              {delivery.publishedAt && <li>Sent {dateFormat.format(delivery.publishedAt)}</li>}
            </ul>
          </div>
          {lead.length > 0 && (
            <div className={styles.collage} aria-hidden="true">
              {lead.map((file) => (
                <div key={file.id} className={styles.collageCard}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- a signed storage link, not a site asset */}
                  <img src={thumbs[file.id]} alt="" loading="lazy" decoding="async" />
                </div>
              ))}
            </div>
          )}
        </section>

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
            <header className={styles.sectionHead}>
              <h2 id={`s-${section.id}`} className={styles.sectionTitle}>
                {section.title}
                <span className={styles.count}>{section.files.length}</span>
              </h2>
              {section.note && <p className={styles.sectionNote}>{section.note}</p>}
            </header>
            {section.files.some((file) => thumbs[file.id]) && (
              <Gallery>
                {section.files
                  .filter((file) => thumbs[file.id])
                  .map((file) => (
                    <li key={file.id} className={styles.tile}>
                      <div className={styles.tileCard}>
                        <div className={styles.photo}>
                          {/* eslint-disable-next-line @next/next/no-img-element -- a signed storage link, not a site asset */}
                          <img src={thumbs[file.id]} alt={file.name} loading="lazy" decoding="async" />
                          {mark(file, true)}
                          {askable && <AskAbout fileId={file.id} name={file.name} compact />}
                        </div>
                        <div className={styles.tileBody}>
                          <p className={styles.tileName}>{file.name}</p>
                          {file.note && <p className={styles.fileNote}>{file.note}</p>}
                          <p className={styles.fileMeta}>{fileMeta(file)}</p>
                        </div>
                        <div className={styles.tileActions}>
                          <SaveFile target={targets.get(file.id)} live={live} label="Save" className={`${styles.download} ${styles.tileSave}`} />
                          <DownloadButton
                            file={file}
                            href={live ? `/d/${delivery.slug}/files/${file.id}` : null}
                            className={`${styles.download} ${styles.tileDownload}`}
                          />
                        </div>
                      </div>
                    </li>
                  ))}
              </Gallery>
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
                        {askable && <AskAbout fileId={file.id} name={file.name} />}
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
            files={files.map((file) => ({ id: file.id, name: file.name }))}
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
      </div>
    </article>
  );
}
