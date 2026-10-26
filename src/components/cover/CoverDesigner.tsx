"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useTransition } from "react";
import type { Brand } from "@/lib/brand";
import { coverLimits, coverTemplates, type CoverTemplateId } from "@/lib/cover";
import { finishCoverUpload, saveCover, setCoverPhoto, startCoverUpload } from "@/lib/cover-actions";
import { limits } from "@/lib/delivery-limits";
import { CoverHero } from "./CoverHero";
import styles from "./CoverDesigner.module.css";

type Photo = { id: string; name: string; thumb: string };

type Design = {
  template: CoverTemplateId;
  title: string;
  kicker: string;
  subtitle: string;
  button: string;
  focusX: number;
  focusY: number;
  opacity: number;
};

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

// A picture from the creative's device, turned upright and shrunk to the cover's size as a JPEG, so a 20 MB phone
// photo goes up as a few hundred kilobytes. Anything the browser can show (JPEG, PNG, WebP, HEIC on an iPhone) works.
async function coverJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No canvas");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  if (!blob) throw new Error("Could not encode");
  return blob;
}

// Draws a cover at a real screen size (so it lays out exactly as a client would see it) and shrinks it to fit.
function Scaled({ width, height, className, children }: { width: number; height: number; className?: string; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const node = box.current;
    if (!node) return;
    const measure = () => setScale(node.clientWidth / width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [width]);
  return (
    <div ref={box} className={className} style={{ aspectRatio: `${width} / ${height}` }}>
      <div className={styles.scaled} style={{ width, height, transform: `scale(${scale})`, visibility: scale ? "visible" : "hidden" }}>
        {children}
      </div>
    </div>
  );
}

// The cover designer. Everything the creative types or picks shows at once in the previews and is saved a moment
// after they stop, so there is no Save button to forget.
export function CoverDesigner({
  deliveryId,
  initial,
  photos,
  coverFileId,
  coverUploaded,
  coverSrc,
  brand,
  senderName,
  fileCount,
}: {
  deliveryId: string;
  initial: Design;
  photos: Photo[];
  coverFileId: string | null;
  // True when the cover's background is a picture the creative uploaded rather than one of the delivery's photos.
  coverUploaded: boolean;
  coverSrc: string | null;
  brand: Brand;
  senderName: string;
  fileCount: number;
}) {
  const id = useId();
  const [design, setDesign] = useState(initial);
  const [photoId, setPhotoId] = useState(
    coverUploaded ? null : coverFileId && photos.some((photo) => photo.id === coverFileId) ? coverFileId : (photos[0]?.id ?? null),
  );
  const [uploaded, setUploaded] = useState(coverUploaded);
  const fileInput = useRef<HTMLInputElement>(null);
  const [photoSrc, setPhotoSrc] = useState(coverSrc);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [photoBusy, startPhoto] = useTransition();
  const [, startSave] = useTransition();
  const lastSaved = useRef(JSON.stringify(initial));
  const pictures = photos.filter((photo) => photo.id !== photoId).map((photo) => photo.thumb);

  const choosePhoto = (photo: Photo) => {
    setUploaded(false);
    setPhotoId(photo.id);
    setPhotoSrc(photo.thumb);
    startPhoto(async () => {
      const result = await setCoverPhoto(deliveryId, photo.id);
      if (result.ok && result.url) setPhotoSrc(result.url);
      if (!result.ok) setStatus({ kind: "error", message: result.error });
    });
  };

  const uploadPicture = (file: File) => {
    startPhoto(async () => {
      try {
        const jpeg = await coverJpeg(file);
        const started = await startCoverUpload(deliveryId, jpeg.size);
        if (!started.ok) {
          setStatus({ kind: "error", message: started.error });
          return;
        }
        const put = await fetch(started.url, { method: "PUT", body: jpeg, headers: { "Content-Type": "image/jpeg" } });
        if (!put.ok) throw new Error(`Upload failed: ${put.status}`);
        const finished = await finishCoverUpload(deliveryId, started.key);
        if (!finished.ok) {
          setStatus({ kind: "error", message: finished.error });
          return;
        }
        setUploaded(true);
        setPhotoId(null);
        setPhotoSrc(finished.url);
        setStatus({ kind: "saved" });
      } catch {
        setStatus({ kind: "error", message: "That picture could not be added. Try a JPEG or PNG." });
      }
    });
  };

  // A delivery whose photos arrived before the designer existed gets its first photo made into a cover once.
  const madeFirst = useRef(false);
  useEffect(() => {
    if (madeFirst.current || coverFileId || coverUploaded || !photos[0]) return;
    madeFirst.current = true;
    choosePhoto(photos[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, for a cover that was never chosen
  }, []);

  useEffect(() => {
    const next = JSON.stringify(design);
    if (next === lastSaved.current) return;
    if (!design.title.trim()) return;
    const timer = window.setTimeout(() => {
      setStatus({ kind: "saving" });
      startSave(async () => {
        const result = await saveCover(deliveryId, design);
        if (result.ok) {
          lastSaved.current = next;
          setStatus({ kind: "saved" });
        } else {
          setStatus({ kind: "error", message: result.error });
        }
      });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [design, deliveryId]);

  const set = <K extends keyof Design>(key: K, value: Design[K]) => {
    setStatus({ kind: "idle" });
    setDesign((current) => ({ ...current, [key]: value }));
  };
  const shown: Status = design.title.trim() ? status : { kind: "error", message: "Give the delivery a title." };

  const hero = (template: CoverTemplateId, mini = false) => (
    <CoverHero
      template={template}
      text={{ title: design.title || "Your title", kicker: design.kicker, subtitle: design.subtitle, button: design.button }}
      photo={mini && !uploaded ? (photos.find((photo) => photo.id === photoId)?.thumb ?? photoSrc) : photoSrc}
      pictures={pictures}
      focusX={design.focusX}
      focusY={design.focusY}
      opacity={design.opacity}
      brand={brand}
      senderName={senderName}
      fileCount={fileCount}
      fill
    />
  );

  const chosen = uploaded ? photoSrc : (photos.find((photo) => photo.id === photoId)?.thumb ?? null);
  const templateName = coverTemplates.find((template) => template.id === design.template)?.name;

  return (
    <section className={styles.designer} aria-labelledby={`${id}-title`}>
      <header className={styles.top}>
        <div>
          <p className={styles.eyebrow}>Client cover</p>
          <h2 id={`${id}-title`} className={styles.heading}>
            Design what your client sees first
          </h2>
        </div>
        <p className={styles.status} data-kind={shown.kind} aria-live="polite">
          {shown.kind === "saving" && "Saving…"}
          {shown.kind === "saved" && "Saved"}
          {shown.kind === "error" && shown.message}
        </p>
      </header>

      <div className={styles.stage}>
        <figure className={styles.desk}>
          <div className={styles.browserBar} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <Scaled width={1280} height={760} className={styles.deskScreen}>
            {hero(design.template)}
          </Scaled>
          <figcaption className={styles.srOnly}>Computer preview, {templateName}</figcaption>
        </figure>
        <figure className={styles.phone}>
          <Scaled width={390} height={780} className={styles.phoneScreen}>
            {hero(design.template)}
          </Scaled>
          <figcaption className={styles.srOnly}>Phone preview</figcaption>
        </figure>
      </div>

      <div className={styles.rail} role="radiogroup" aria-label="Cover template">
        {coverTemplates.map((template, index) => (
          <button
            key={template.id}
            type="button"
            role="radio"
            aria-checked={design.template === template.id}
            className={styles.card}
            onClick={() => set("template", template.id)}
          >
            <Scaled width={1280} height={760} className={styles.cardScreen}>
              {hero(template.id, true)}
            </Scaled>
            <span className={styles.cardName}>
              <span className={styles.cardIndex}>{String(index + 1).padStart(2, "0")}</span>
              {template.name}
            </span>
          </button>
        ))}
      </div>

      <div className={styles.fields}>
        <label className={`${styles.field} ${styles.wide}`}>
          <span className={styles.label}>Title</span>
          <input
            className={`${styles.input} ${styles.titleInput}`}
            value={design.title}
            maxLength={limits.title}
            placeholder="For example: Peculiar and Kemmer"
            onChange={(event) => set("title", event.currentTarget.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Top line</span>
          <input
            className={styles.input}
            value={design.kicker}
            maxLength={coverLimits.kicker}
            placeholder="For Ada and Tobi"
            onChange={(event) => set("kicker", event.currentTarget.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Date or place</span>
          <input
            className={styles.input}
            value={design.subtitle}
            maxLength={coverLimits.subtitle}
            placeholder="November 29th, 2025"
            onChange={(event) => set("subtitle", event.currentTarget.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Button</span>
          <input
            className={styles.input}
            value={design.button}
            maxLength={coverLimits.button}
            placeholder="View gallery"
            onChange={(event) => set("button", event.currentTarget.value)}
          />
        </label>
        <p className={styles.fieldHint}>Leave a line empty to hide it.</p>
      </div>

      <div className={styles.photoRow}>
        <div className={styles.photoPick}>
          <p className={styles.label}>Background picture</p>
          <div className={styles.photos} role="radiogroup" aria-label="Background picture">
            <button
              type="button"
              className={`${styles.photo} ${styles.upload}`}
              aria-checked={uploaded}
              role="radio"
              onClick={() => fileInput.current?.click()}
              disabled={photoBusy}
            >
              {uploaded && photoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element -- a signed storage link, not a site asset
                <img src={photoSrc} alt="" referrerPolicy="no-referrer" />
              ) : null}
              <span className={styles.uploadLabel}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 16V5m0 0-4 4m4-4 4 4M5 19h14" />
                </svg>
                {photoBusy ? "Adding…" : uploaded ? "Change" : "Upload"}
              </span>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) uploadPicture(file);
              }}
            />
            {photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                role="radio"
                aria-checked={!uploaded && photo.id === photoId}
                aria-label={photo.name}
                className={styles.photo}
                onClick={() => choosePhoto(photo)}
                disabled={photoBusy}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a signed storage link, not a site asset */}
                <img src={photo.thumb} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
              </button>
            ))}
          </div>
          <p className={styles.fieldHint}>
            {photos.length > 0 ? "Use one of this delivery's photos, or upload any picture." : "Upload any picture, or add photos below and pick one."}
          </p>
          <label className={styles.slider}>
            <span className={styles.sliderHead}>
              <span className={styles.label}>Background opacity</span>
              <output className={styles.sliderValue}>{design.opacity}%</output>
            </span>
            <input
              type="range"
              min={coverLimits.opacityMin}
              max={100}
              step={1}
              value={design.opacity}
              onChange={(event) => set("opacity", Number(event.currentTarget.value))}
            />
          </label>
        </div>
        {chosen && (
          <div className={styles.focusBox}>
            <p className={styles.label}>Tap the part to keep in view</p>
            <button
              type="button"
              className={styles.focus}
              aria-label="Set the focus point of the cover picture"
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                setStatus({ kind: "idle" });
                setDesign((current) => ({
                  ...current,
                  focusX: Math.round(((event.clientX - rect.left) / rect.width) * 100),
                  focusY: Math.round(((event.clientY - rect.top) / rect.height) * 100),
                }));
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- a signed storage link, not a site asset */}
              <img src={chosen} alt="" referrerPolicy="no-referrer" />
              <span className={styles.focusDot} style={{ left: `${design.focusX}%`, top: `${design.focusY}%` }} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
