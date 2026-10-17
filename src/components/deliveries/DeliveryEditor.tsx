import Link from "next/link";
import { FeatureIcon } from "../FeatureIcons";
import {
  addSection,
  deleteDelivery,
  deleteFile,
  deleteSection,
  saveDeliveryField,
  saveFileField,
  saveSectionField,
} from "@/lib/delivery-actions";
import { limits } from "@/lib/delivery-limits";
import { linkState, type DeliveryFile, type DeliverySection, type OwnerDelivery } from "@/lib/deliveries";
import type { Activity } from "@/lib/delivery-events";
import type { FileRequestItem } from "@/lib/requests";
import { storageConfigured } from "@/lib/storage";
import { ownerThumbnailLinks } from "@/lib/thumbnails";
import { formatSize } from "@/lib/storage-limits";
import { ActionButton } from "./ActionButton";
import { ActivityPanel } from "./ActivityPanel";
import { EditableField } from "./EditableField";
import { PublishPanel } from "./PublishPanel";
import { LinkSettings } from "./LinkSettings";
import { RequestList } from "./RequestList";
import { FileVersions } from "./FileVersions";
import { UpdatesPanel } from "./UpdatesPanel";
import { FileFooter, UploadArea } from "./Uploader";
import styles from "./Editor.module.css";

const pillText = { draft: "Draft", live: "Published", paused: "Paused", expired: "Expired" } as const;

function fileStatus(file: DeliveryFile): string {
  if (file.attached) {
    const size = file.sizeBytes ? formatSize(file.sizeBytes) : "Attached";
    const label = file.ext ? `${size} · ${file.ext.toUpperCase()}` : size;
    if (file.downloads === 0) return label;
    return `${label} · Downloaded ${file.downloads === 1 ? "once" : `${file.downloads} times`}`;
  }
  return file.uploading ? "Upload not finished" : "No file attached";
}

function Step({
  id,
  number,
  title,
  hint,
  children,
}: {
  id: string;
  number: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.step} aria-labelledby={id}>
      <div className={styles.stepHead}>
        <span className={styles.stepNumber} aria-hidden="true">
          {number}
        </span>
        <div className={styles.stepText}>
          <h2 id={id} className={styles.stepTitle}>
            {title}
          </h2>
          {hint && <p className={styles.stepHint}>{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

// One file, one card: a picture, a name to click and change, and a note if the creative wants one.
function FileCard({
  file,
  section,
  thumb,
  storageReady,
}: {
  file: DeliveryFile;
  section: DeliverySection;
  thumb: string | undefined;
  storageReady: boolean;
}) {
  return (
    <li className={styles.file}>
      <span className={styles.thumb}>
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- a signed storage link, not a site asset
          <img src={thumb} alt="" loading="lazy" />
        ) : (
          <>
            <FeatureIcon name="file" />
            {file.ext && <span className={styles.thumbExt}>{file.ext.slice(0, 5)}</span>}
          </>
        )}
      </span>
      <div className={styles.fileBody}>
        <EditableField
          label="File name"
          hideLabel
          look="compact"
          rename
          defaultValue={file.name}
          maxLength={limits.fileName}
          save={saveFileField.bind(null, file.id, "name")}
        />
        <details className={styles.noteBox} open={Boolean(file.note)}>
          <summary>{file.note ? "Note for your client" : "Add a note for your client"}</summary>
          <EditableField
            label="What this file is for"
            hideLabel
            look="compact"
            multiline
            defaultValue={file.note ?? ""}
            maxLength={limits.note}
            placeholder="What is it for? For example: use this one for print."
            save={saveFileField.bind(null, file.id, "note")}
          />
        </details>
        <FileVersions
          versions={file.versions.map((version) => ({
            id: version.id,
            sizeBytes: version.sizeBytes,
            ext: version.ext,
            replacedAt: version.replacedAt.toISOString(),
          }))}
        />
        <FileFooter
          sectionId={section.id}
          fileId={file.id}
          attached={file.attached}
          storageReady={storageReady}
          status={fileStatus(file)}
        >
          <ActionButton
            action={deleteFile.bind(null, file.id)}
            variant="ghost"
            confirmLabel="Remove file"
            label={`Remove ${file.name}`}
          >
            Remove
          </ActionButton>
        </FileFooter>
      </div>
    </li>
  );
}

function FileCards({
  section,
  thumbs,
  storageReady,
}: {
  section: DeliverySection;
  thumbs: Record<string, string>;
  storageReady: boolean;
}) {
  if (section.files.length === 0) return null;
  return (
    <ul className={styles.fileList}>
      {section.files.map((file) => (
        <FileCard key={file.id} file={file} section={section} thumb={thumbs[file.id]} storageReady={storageReady} />
      ))}
    </ul>
  );
}

// Bound actions are passed to client components, which call them when a field loses focus.
export async function DeliveryEditor({
  delivery,
  activity,
  requests,
}: {
  delivery: OwnerDelivery;
  activity: Activity;
  requests: FileRequestItem[];
}) {
  const state = linkState(delivery);
  // Once a link has been sent it keeps its place at the top, whether it is live, paused or expired.
  const sent = state !== "draft";
  const settings = (
    <LinkSettings
      deliveryId={delivery.id}
      expiresAt={delivery.expiresAt ? delivery.expiresAt.toISOString() : null}
      expired={delivery.expired}
      hasPassword={delivery.hasPassword}
    />
  );
  const storageReady = storageConfigured();
  const thumbs = await ownerThumbnailLinks(delivery);
  const grouped = delivery.sections.length > 1;
  const fileCount = delivery.sections.reduce((sum, section) => sum + section.files.length, 0);
  const only = delivery.sections[0];

  return (
    <>
      <Link href="/dashboard" className={styles.back}>
        <span aria-hidden="true">←</span> All deliveries
      </Link>

      <div className={styles.head}>
        <div className={styles.headTop}>
          <span className={styles.pill} data-status={state}>
            {pillText[state]}
          </span>
          <div className={styles.headActions}>
            <Link href={`/deliveries/${delivery.id}/preview`} className={`${styles.button} ${styles.secondary}`}>
              Preview as client
            </Link>
          </div>
        </div>
        <EditableField
          label="Delivery name"
          hideLabel
          look="title"
          defaultValue={delivery.title}
          maxLength={limits.title}
          save={saveDeliveryField.bind(null, delivery.id, "title")}
        />
      </div>

      {sent && (
        <>
          <PublishPanel deliveryId={delivery.id} slug={delivery.slug} state={state} />
          {requests.length > 0 && (
            <section className={styles.updatesCard} aria-labelledby="requests-title">
              <h2 id="requests-title" className={styles.shareTitle}>
                Requests from your client
              </h2>
              <RequestList requests={requests} showDelivery={false} inCard />
            </section>
          )}
          {settings}
          <UpdatesPanel
            deliveryId={delivery.id}
            updates={delivery.updates.map((update) => ({ id: update.id, note: update.note, at: update.createdAt.toISOString() }))}
          />
          <ActivityPanel activity={activity} published />
        </>
      )}

      <Step id="step-client" number={1} title="Who is this for?">
        <EditableField
          label="Client name"
          hideLabel
          look="plain"
          defaultValue={delivery.clientName ?? ""}
          maxLength={limits.clientName}
          placeholder="Your client's name"
          save={saveDeliveryField.bind(null, delivery.id, "clientName")}
        />
      </Step>

      <Step
        id="step-files"
        number={2}
        title="Add your files"
        hint={
          fileCount > 0
            ? `${fileCount} ${fileCount === 1 ? "file" : "files"}. Click a name to rename it, then press Enter for the next one.`
            : "Drop as many as you like at once. Each one gets its own card, so you can give it a proper name."
        }
      >
        {!grouped && only && (
          <>
            <UploadArea sectionId={only.id} storageReady={storageReady} hasFiles={only.files.length > 0}>
              <FileCards section={only} thumbs={thumbs} storageReady={storageReady} />
            </UploadArea>
            <div className={styles.groupRow}>
              <ActionButton action={addSection.bind(null, delivery.id)} variant="ghost">
                Group files into sections
              </ActionButton>
            </div>
          </>
        )}

        {!only && (
          <ActionButton action={addSection.bind(null, delivery.id)} variant="add">
            Start adding files
          </ActionButton>
        )}

        {grouped && (
          <>
            <ul className={styles.sectionList}>
              {delivery.sections.map((section) => (
                <li key={section.id} className={styles.section}>
                  <div className={styles.sectionTop}>
                    <EditableField
                      label="Section name"
                      hideLabel
                      look="heading"
                      defaultValue={section.title}
                      maxLength={limits.title}
                      save={saveSectionField.bind(null, section.id, "title")}
                    />
                    <ActionButton
                      action={deleteSection.bind(null, section.id)}
                      variant="secondary"
                      confirmLabel="Remove section and its files"
                      label={`Remove section ${section.title}`}
                    >
                      Remove
                    </ActionButton>
                  </div>
                  <EditableField
                    label="What is in this section?"
                    hideLabel
                    look="quiet"
                    multiline
                    defaultValue={section.note ?? ""}
                    maxLength={limits.note}
                    placeholder="Add a line for your client, such as where to use these files."
                    save={saveSectionField.bind(null, section.id, "note")}
                  />
                  <UploadArea sectionId={section.id} storageReady={storageReady} hasFiles>
                    <FileCards section={section} thumbs={thumbs} storageReady={storageReady} />
                  </UploadArea>
                </li>
              ))}
            </ul>
            <ActionButton action={addSection.bind(null, delivery.id)} variant="add">
              + Add section
            </ActionButton>
          </>
        )}
      </Step>

      <Step
        id="step-message"
        number={3}
        title="Add a message"
        hint="Optional. Your client reads this first."
      >
        <EditableField
          label="Message to your client"
          hideLabel
          look="plain"
          multiline
          defaultValue={delivery.message ?? ""}
          maxLength={limits.message}
          placeholder="Say hello and tell them what is inside."
          save={saveDeliveryField.bind(null, delivery.id, "message")}
        />
      </Step>

      {!sent && (
        <>
          {settings}
          <PublishPanel deliveryId={delivery.id} slug={delivery.slug} state={state} />
        </>
      )}

      <section className={styles.dangerZone} aria-labelledby="delete-title">
        <div className={styles.dangerText}>
          <h2 id="delete-title" className={styles.dangerTitle}>
            Delete this delivery
          </h2>
          <p className={styles.shareText}>
            Removes the delivery, its files and the record of who opened it. Your client&rsquo;s link stops working for good.
            This cannot be undone.
          </p>
        </div>
        <ActionButton
          action={deleteDelivery.bind(null, delivery.id)}
          variant="secondary"
          confirmLabel="Yes, delete it"
          label="Delete this delivery"
        >
          Delete delivery
        </ActionButton>
      </section>
    </>
  );
}
