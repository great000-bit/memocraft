import Link from "next/link";
import { FeatureIcon } from "../FeatureIcons";
import {
  addSection,
  deleteFile,
  deleteSection,
  saveDeliveryField,
  saveFileField,
  saveSectionField,
} from "@/lib/delivery-actions";
import { limits } from "@/lib/delivery-limits";
import type { Delivery, DeliveryFile, DeliverySection } from "@/lib/deliveries";
import type { Activity } from "@/lib/delivery-events";
import { presignThumb, storageConfigured } from "@/lib/storage";
import { formatSize } from "@/lib/storage-limits";
import { ActionButton } from "./ActionButton";
import { ActivityPanel } from "./ActivityPanel";
import { EditableField } from "./EditableField";
import { PublishPanel } from "./PublishPanel";
import { FileFooter, UploadArea } from "./Uploader";
import styles from "./Editor.module.css";

function fileStatus(file: DeliveryFile): string {
  if (file.attached) {
    const size = file.sizeBytes ? formatSize(file.sizeBytes) : "Attached";
    const label = file.ext ? `${size} · ${file.ext.toUpperCase()}` : size;
    if (file.downloads === 0) return label;
    return `${label} · Downloaded ${file.downloads === 1 ? "once" : `${file.downloads} times`}`;
  }
  return file.uploading ? "Upload not finished" : "No file attached";
}

// Signed links to the pictures made in the browser. Only the signed-in owner's editor gets them.
async function thumbnailLinks(delivery: Delivery): Promise<Map<string, string>> {
  const files = delivery.sections.flatMap((section) => section.files).filter((file) => file.attached && file.thumbKey);
  const links = await Promise.allSettled(files.map((file) => presignThumb(file.thumbKey as string)));
  const found = new Map<string, string>();
  links.forEach((link, index) => {
    if (link.status === "fulfilled") found.set(files[index].id, link.value);
  });
  return found;
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
  thumbs: Map<string, string>;
  storageReady: boolean;
}) {
  if (section.files.length === 0) return null;
  return (
    <ul className={styles.fileList}>
      {section.files.map((file) => (
        <FileCard key={file.id} file={file} section={section} thumb={thumbs.get(file.id)} storageReady={storageReady} />
      ))}
    </ul>
  );
}

// Bound actions are passed to client components, which call them when a field loses focus.
export async function DeliveryEditor({ delivery, activity }: { delivery: Delivery; activity: Activity }) {
  const published = delivery.status === "published";
  const storageReady = storageConfigured();
  const thumbs = storageReady ? await thumbnailLinks(delivery) : new Map<string, string>();
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
          <span className={styles.pill} data-status={delivery.status}>
            {published ? "Published" : "Draft"}
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

      {published && (
        <>
          <PublishPanel deliveryId={delivery.id} slug={delivery.slug} published />
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

      {!published && <PublishPanel deliveryId={delivery.id} slug={delivery.slug} published={false} />}
    </>
  );
}
