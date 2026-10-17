"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ActionButton } from "@/components/deliveries/ActionButton";
import { photoRules } from "@/lib/avatar";
import { removePhoto, saveName, uploadPhoto, type ProfileResult } from "@/lib/profile-actions";
import { Avatar } from "./Avatar";
import editor from "@/components/deliveries/Editor.module.css";
import styles from "./Settings.module.css";

// Squares the picture around its centre and shrinks it, so a 12 MB phone photo goes up as a small file. A
// transparent PNG gets a white background because the picture is stored as a JPEG.
async function squarePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const side = Math.min(bitmap.width, bitmap.height);
  const edge = Math.min(photoRules.edge, side);
  const canvas = document.createElement("canvas");
  canvas.width = edge;
  canvas.height = edge;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No canvas");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, edge, edge);
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, edge, edge);
  bitmap.close();
  for (const quality of [0.88, 0.75, 0.6]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= photoRules.maxBytes) return blob;
  }
  throw new Error("Too large");
}

export function PhotoEditor({ name, image, hasPhoto }: { name: string; image: string | null; hasPhoto: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function choose(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    let photo: Blob;
    try {
      photo = await squarePhoto(file);
    } catch {
      setError("This picture could not be read. Try a JPG, PNG or WebP.");
      return;
    }
    setPreview(URL.createObjectURL(photo));
    const body = new FormData();
    body.set("photo", photo, "photo.jpg");
    startTransition(async () => {
      const result = await uploadPhoto(body);
      if (!result.ok) setError(result.error);
      setPreview(null);
    });
  }

  return (
    <div className={styles.photoRow}>
      <Avatar name={name} image={image} size={96} previewSrc={preview} />
      <div className={styles.photoActions}>
        <div className={styles.buttonRow}>
          <input
            ref={input}
            id="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className={styles.hiddenInput}
            onChange={choose}
            disabled={pending}
            aria-label="Choose a profile picture"
          />
          <button
            type="button"
            className={`${editor.button} ${editor.primary}`}
            onClick={() => input.current?.click()}
            disabled={pending}
          >
            {pending ? "Saving…" : hasPhoto ? "Change picture" : "Add a picture"}
          </button>
          {hasPhoto && !pending && (
            <ActionButton action={removePhoto} variant="secondary">
              Remove
            </ActionButton>
          )}
        </div>
        <p className={styles.hint}>JPG, PNG or WebP. We crop it to a square.</p>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

export function NameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState<ProfileResult | null, FormData>(saveName, null);
  return (
    <form action={action} className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="name" className={styles.label}>
          Your name
        </label>
        <input
          id="name"
          name="name"
          className={styles.input}
          defaultValue={name}
          maxLength={photoRules.nameMax}
          autoComplete="name"
          required
        />
        <p className={styles.hint}>Shown in your workspace, and to clients when you have not set a studio name.</p>
      </div>
      {state && !state.ok && (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      )}
      <div className={styles.buttonRow}>
        <button type="submit" className={`${editor.button} ${editor.primary}`} disabled={pending}>
          {pending ? "Saving…" : "Save name"}
        </button>
        {state?.ok && !pending && (
          <span role="status" className={styles.ok}>
            Saved
          </span>
        )}
      </div>
    </form>
  );
}
