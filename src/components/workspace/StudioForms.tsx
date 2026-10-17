"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ActionButton } from "@/components/deliveries/ActionButton";
import { logoBox, logoRules, type Brand } from "@/lib/brand";
import { removeStudioLogo, saveStudioName, uploadStudioLogo, type StudioResult } from "@/lib/studio-actions";
import editor from "@/components/deliveries/Editor.module.css";
import styles from "./Settings.module.css";

// Shrinks a logo to fit the stored box without cropping, and sends it as a PNG so a transparent background stays
// transparent. Edges that are fully transparent are trimmed first, so padding in the file does not shrink the logo.
async function fitLogo(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const probe = document.createElement("canvas");
  probe.width = bitmap.width;
  probe.height = bitmap.height;
  const probeContext = probe.getContext("2d", { willReadFrequently: true });
  if (!probeContext) throw new Error("No canvas");
  probeContext.drawImage(bitmap, 0, 0);
  bitmap.close();
  const crop = opaqueBounds(probeContext.getImageData(0, 0, probe.width, probe.height));
  const scale = Math.min(1, logoRules.maxWidth / crop.width, logoRules.maxHeight / crop.height);
  const width = Math.max(1, Math.round(crop.width * scale));
  const height = Math.max(1, Math.round(crop.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No canvas");
  context.imageSmoothingQuality = "high";
  context.drawImage(probe, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob || blob.size > logoRules.maxBytes) throw new Error("Too large");
  return { blob, width, height };
}

function opaqueBounds(image: ImageData): { x: number; y: number; width: number; height: number } {
  const { width, height, data } = image;
  let top = height;
  let left = width;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  if (right < 0) return { x: 0, y: 0, width, height };
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

export function LogoEditor({ brand }: { brand: Brand }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<{ src: string; width: number; height: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.src);
    };
  }, [preview]);

  async function choose(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    let logo: Awaited<ReturnType<typeof fitLogo>>;
    try {
      logo = await fitLogo(file);
    } catch {
      setError("This logo could not be read. Try a PNG, JPG or WebP.");
      return;
    }
    setPreview({ src: URL.createObjectURL(logo.blob), width: logo.width, height: logo.height });
    const body = new FormData();
    body.set("logo", logo.blob, "logo.png");
    startTransition(async () => {
      const result = await uploadStudioLogo(body);
      if (!result.ok) setError(result.error);
      setPreview(null);
    });
  }

  const shown = preview ? { ...brand, logoSrc: preview.src, logoWidth: preview.width, logoHeight: preview.height } : brand;
  const box = logoBox(shown, 56, 240);
  const hasLogo = Boolean(brand.logoSrc);

  return (
    <div className={styles.photoRow}>
      <div className={styles.logoFrame}>
        {shown.logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- a sign-in-gated route or a picture the browser just made
          <img src={shown.logoSrc} alt="Your logo" width={box.width} height={box.height} className={styles.logoImage} />
        ) : (
          <span className={styles.logoEmpty}>No logo yet</span>
        )}
      </div>
      <div className={styles.photoActions}>
        <div className={styles.buttonRow}>
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className={styles.hiddenInput}
            onChange={choose}
            disabled={pending}
            aria-label="Choose a logo"
          />
          <button
            type="button"
            className={`${editor.button} ${editor.primary}`}
            onClick={() => input.current?.click()}
            disabled={pending}
          >
            {pending ? "Saving…" : hasLogo ? "Change logo" : "Add your logo"}
          </button>
          {hasLogo && !pending && (
            <ActionButton action={removeStudioLogo} variant="secondary">
              Remove
            </ActionButton>
          )}
        </div>
        <p className={styles.hint}>PNG with a clear background works best. JPG and WebP work too.</p>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

export function StudioNameForm({ name }: { name: string | null }) {
  const [state, action, pending] = useActionState<StudioResult | null, FormData>(saveStudioName, null);
  return (
    <form action={action} className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="studioName" className={styles.label}>
          Studio name
        </label>
        <input
          id="studioName"
          name="studioName"
          className={styles.input}
          defaultValue={name ?? ""}
          maxLength={logoRules.nameMax}
          placeholder="For example, Lumen Studio"
          autoComplete="organization"
        />
        <p className={styles.hint}>Leave it empty to show your own name.</p>
      </div>
      {state && !state.ok && (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      )}
      <div className={styles.buttonRow}>
        <button type="submit" className={`${editor.button} ${editor.primary}`} disabled={pending}>
          {pending ? "Saving…" : "Save studio name"}
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
