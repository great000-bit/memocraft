import Link from "next/link";
import { FeatureIcon } from "../FeatureIcons";
import {
  addFile,
  addSection,
  deleteFile,
  deleteSection,
  saveDeliveryField,
  saveFileField,
  saveSectionField,
} from "@/lib/delivery-actions";
import { limits } from "@/lib/delivery-limits";
import type { Delivery } from "@/lib/deliveries";
import { ActionButton } from "./ActionButton";
import { EditableField } from "./EditableField";
import { PublishPanel } from "./PublishPanel";
import styles from "./Editor.module.css";

// Bound actions are passed to client components, which call them when a field loses focus.
export function DeliveryEditor({ delivery }: { delivery: Delivery }) {
  const published = delivery.status === "published";
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

            {section.files.length === 0 ? (
              <p className={styles.empty}>No files here yet. Add a file and say what it is for.</p>
            ) : (
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
                      <div className={styles.fileFoot}>
                        <span className={styles.fileMeta}>{file.storageKey ? "Uploaded" : "Upload comes with file storage"}</span>
                        <ActionButton
                          action={deleteFile.bind(null, file.id)}
                          variant="secondary"
                          confirmLabel="Remove file"
                          label={`Remove ${file.name}`}
                        >
                          Remove
                        </ActionButton>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <ActionButton action={addFile.bind(null, section.id)} variant="add">
              + Add file
            </ActionButton>
          </li>
        ))}
      </ul>

      <ActionButton action={addSection.bind(null, delivery.id)} variant="add">
        + Add section
      </ActionButton>
    </>
  );
}
