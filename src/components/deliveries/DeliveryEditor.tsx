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
import type { Delivery, DeliveryFile } from "@/lib/deliveries";
import type { Activity } from "@/lib/delivery-events";
import { storageConfigured } from "@/lib/storage";
import { formatSize } from "@/lib/storage-limits";
import { ActionButton } from "./ActionButton";
import { ActivityPanel } from "./ActivityPanel";
import { EditableField } from "./EditableField";
import { PublishPanel } from "./PublishPanel";
import { FileFooter, SectionUploader } from "./Uploader";
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

// Bound actions are passed to client components, which call them when a field loses focus.
export function DeliveryEditor({ delivery, activity }: { delivery: Delivery; activity: Activity }) {
  const published = delivery.status === "published";
  const storageReady = storageConfigured();
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

      <PublishPanel deliveryId={delivery.id} slug={delivery.slug} published={published} />

      <ActivityPanel activity={activity} published={published} />

      <section className={styles.details} aria-label="Delivery details">
        <EditableField
          label="Client"
          look="plain"
          defaultValue={delivery.clientName ?? ""}
          maxLength={limits.clientName}
          placeholder="Who is this for?"
          save={saveDeliveryField.bind(null, delivery.id, "clientName")}
        />
        <EditableField
          label="Message to your client"
          look="plain"
          multiline
          defaultValue={delivery.message ?? ""}
          maxLength={limits.message}
          placeholder="Say hello and tell them what is inside. They read this first."
          save={saveDeliveryField.bind(null, delivery.id, "message")}
        />
      </section>

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

            {section.files.length > 0 && (
              <ul className={styles.fileList}>
                {section.files.map((file) => (
                  <li key={file.id} className={styles.file}>
                    <span className={styles.fileIcon}>
                      <FeatureIcon name="file" />
                    </span>
                    <div className={styles.fileBody}>
                      <EditableField
                        label="File name"
                        hideLabel
                        look="compact"
                        defaultValue={file.name}
                        maxLength={limits.fileName}
                        save={saveFileField.bind(null, file.id, "name")}
                      />
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
                      <FileFooter
                        sectionId={section.id}
                        fileId={file.id}
                        attached={file.attached}
                        storageReady={storageReady}
                        status={fileStatus(file)}
                      >
                        <ActionButton
                          action={deleteFile.bind(null, file.id)}
                          variant="secondary"
                          confirmLabel="Remove file"
                          label={`Remove ${file.name}`}
                        >
                          Remove
                        </ActionButton>
                      </FileFooter>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <SectionUploader sectionId={section.id} storageReady={storageReady} />
          </li>
        ))}
      </ul>

      <ActionButton action={addSection.bind(null, delivery.id)} variant="add">
        + Add section
      </ActionButton>
    </>
  );
}
