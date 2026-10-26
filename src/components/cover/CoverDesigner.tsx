"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useTransition } from "react";
import type { Brand } from "@/lib/brand";
import { coverLimits, coverTemplates, type CoverTemplateId } from "@/lib/cover";
import { saveCover, setCoverPhoto } from "@/lib/cover-actions";
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
};

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

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
  coverSrc,
  brand,
  senderName,
  fileCount,
}: {
  deliveryId: string;
  initial: Design;
  photos: Photo[];
  coverFileId: string | null;
  coverSrc: string | null;
  brand: Brand;
  senderName: string;
  fileCount: number;
}) {
  const id = useId();
  const [design, setDesign] = useState(initial);
  const [photoId, setPhotoId] = useState(coverFileId && photos.some((photo) => photo.id === coverFileId) ? coverFileId : (photos[0]?.id ?? null));
  const [photoSrc, setPhotoSrc] = useState(coverSrc);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [photoBusy, startPhoto] = useTransition();
  const [, startSave] = useTransition();
  const lastSaved = useRef(JSON.stringify(initial));
  const pictures = photos.filter((photo) => photo.id !== photoId).map((photo) => photo.thumb);

  const choosePhoto = (photo: Photo) => {
    setPhotoId(photo.id);
    setPhotoSrc(photo.thumb);
    startPhoto(async () => {
      const result = await setCoverPhoto(deliveryId, photo.id);
      if (result.ok && result.url) setPhotoSrc(result.url);
      if (!result.ok) setStatus({ kind: "error", message: result.error });
    });
  };

  // A delivery whose photos arrived before the designer existed gets its first photo made into a cover once.
  const madeFirst = useRef(false);
  useEffect(() => {
    if (madeFirst.current || coverFileId || !photos[0]) return;
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
      photo={mini ? (photos.find((photo) => photo.id === photoId)?.thumb ?? photoSrc) : photoSrc}
      pictures={pictures}
      focusX={design.focusX}
      focusY={design.focusY}
      brand={brand}
      senderName={senderName}
      fileCount={fileCount}
      fill
    />
  );

  const chosen = photos.find((photo) => photo.id === photoId) ?? null;
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

      {photos.length > 0 ? (
        <div className={styles.photoRow}>
          <div className={styles.photoPick}>
            <p className={styles.label}>Cover photo</p>
            <div className={styles.photos} role="radiogroup" aria-label="Cover photo">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  role="radio"
                  aria-checked={photo.id === photoId}
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
          </div>
          {chosen && (
            <div className={styles.focusBox}>
              <p className={styles.label}>Tap the part to keep in view</p>
              <button
                type="button"
                className={styles.focus}
                aria-label="Set the focus point of the cover photo"
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
                <img src={chosen.thumb} alt="" referrerPolicy="no-referrer" />
                <span className={styles.focusDot} style={{ left: `${design.focusX}%`, top: `${design.focusY}%` }} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <p className={styles.fieldHint}>Add photos below and the first one becomes your cover. You can pick another any time.</p>
      )}
    </section>
  );
}
