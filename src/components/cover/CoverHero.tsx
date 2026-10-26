import type { CSSProperties, ReactNode } from "react";
import type { Brand } from "@/lib/brand";
import type { CoverTemplateId, CoverText } from "@/lib/cover";
import styles from "./CoverHero.module.css";

export type CoverHeroProps = {
  template: CoverTemplateId;
  text: CoverText;
  // The large cover picture, or null when the delivery has no photo yet.
  photo: string | null;
  // A few more of the delivery's pictures, for the templates that show more than one.
  pictures?: string[];
  focusX?: number;
  focusY?: number;
  // How strongly the background picture shows, 10 to 100.
  opacity?: number;
  brand: Brand;
  senderName: string;
  fileCount: number;
  // On the client page the button jumps to the files. In the designer's previews it is only drawn.
  href?: string;
  // Fill the box it is placed in (the designer's previews) instead of the screen.
  fill?: boolean;
  // Only the client page's cover is the page heading.
  headingId?: string;
};

// Long titles shrink in the templates where the title spans the page, so a long name still fits on its lines.
const fit = (title: string, perChar: number, max: number) => `${Math.min(max, perChar / Math.max(4, title.length)).toFixed(2)}cqi`;

function Studio({ brand, senderName, className }: { brand: Brand; senderName: string; className?: string }) {
  return (
    <span className={`${styles.studio} ${className ?? ""}`}>
      {brand.logoSrc && (
        // eslint-disable-next-line @next/next/no-img-element -- served from the link's own route, already sized
        <img src={brand.logoSrc} alt="" className={styles.studioLogo} />
      )}
      <span>{brand.name ?? senderName}</span>
    </span>
  );
}

// Each template is its own layout. The parts they share (photo, words, button) look the same in code so a template
// is easy to read and to change.
export function CoverHero({
  template,
  text,
  photo,
  pictures = [],
  focusX = 50,
  focusY = 40,
  opacity = 100,
  brand,
  senderName,
  fileCount,
  href,
  fill = false,
  headingId,
}: CoverHeroProps) {
  const Heading = headingId ? "h1" : "p";
  const style = { "--fx": `${focusX}%`, "--fy": `${focusY}%`, "--po": opacity / 100 } as CSSProperties;
  const others = pictures.filter((picture) => picture !== photo);

  const renderPhoto = ({ className, src = photo }: { className?: string; src?: string | null }) =>
    src ? (
      // eslint-disable-next-line @next/next/no-img-element -- a signed storage link, not a site asset
      <img
        src={src}
        alt=""
        className={`${styles.photo} ${className ?? ""}`}
        loading={headingId ? "eager" : "lazy"}
        fetchPriority={headingId ? "high" : "auto"}
        decoding="async"
        referrerPolicy="no-referrer"
      />
    ) : (
      <span className={`${styles.photo} ${styles.noPhoto} ${className ?? ""}`} aria-hidden="true" />
    );

  const renderTitle = ({ className, children = text.title, size }: { className?: string; children?: ReactNode; size?: string }) => (
    <Heading id={headingId} className={`${styles.title} ${className ?? ""}`} style={size ? ({ "--fit": size } as CSSProperties) : undefined}>
      {children}
    </Heading>
  );

  const renderKicker = ({ className }: { className?: string }) =>
    text.kicker ? <p className={`${styles.kicker} ${className ?? ""}`}>{text.kicker}</p> : null;

  const renderSubtitle = ({ className }: { className?: string }) =>
    text.subtitle ? <p className={`${styles.subtitle} ${className ?? ""}`}>{text.subtitle}</p> : null;

  const renderButton = ({ className, arrow = false }: { className?: string; arrow?: boolean }) => {
    if (!text.button) return null;
    const content = (
      <>
        {text.button}
        {arrow && <span aria-hidden="true"> →</span>}
      </>
    );
    return href ? (
      <a href={href} className={`${styles.button} ${className ?? ""}`}>
        {content}
      </a>
    ) : (
      <span className={`${styles.button} ${className ?? ""}`}>{content}</span>
    );
  };

  let body: ReactNode;
  switch (template) {
    case "classic":
      body = (
        <>
          {renderPhoto({})}
          <span className={styles.scrim} />
          <div className={styles.classicCenter}>
            {renderKicker({})}
            {renderTitle({ size: fit(text.title, 150, 6.4) })}
            {renderSubtitle({})}
            {renderButton({})}
          </div>
          <Studio brand={brand} senderName={senderName} className={styles.classicStudio} />
        </>
      );
      break;
    case "editorial":
      body = (
        <>
          {renderPhoto({})}
          <span className={styles.scrim} />
          <div className={styles.editorialText}>
            {renderKicker({})}
            {renderTitle({})}
            <span className={styles.rule} />
            <div className={styles.editorialFoot}>
              {renderSubtitle({})}
              {renderButton({ arrow: true })}
            </div>
          </div>
        </>
      );
      break;
    case "split":
      body = (
        <>
          <div className={styles.splitPhoto}>
            {renderPhoto({})}
          </div>
          <div className={styles.splitText}>
            {renderKicker({})}
            {renderTitle({})}
            {renderSubtitle({})}
            {renderButton({})}
            <Studio brand={brand} senderName={senderName} className={styles.splitStudio} />
          </div>
        </>
      );
      break;
    case "gallery":
      body = (
        <>
          <div className={styles.galleryText}>
            {renderKicker({})}
            {renderTitle({})}
            {renderSubtitle({})}
            {renderButton({ arrow: true })}
          </div>
          <figure className={styles.galleryFrame}>
            {renderPhoto({})}
            <figcaption>
              <span>01</span>
              {text.subtitle || brand.name || senderName}
            </figcaption>
          </figure>
        </>
      );
      break;
    case "frame":
      body = (
        <>
          <div className={styles.frameMount}>
            {renderPhoto({})}
          </div>
          <div className={styles.frameLabel}>
            {renderTitle({})}
            {renderKicker({})}
            {renderSubtitle({})}
            {renderButton({ arrow: true })}
          </div>
        </>
      );
      break;
    case "monogram":
      body = (
        <>
          <span className={styles.monoLetter} aria-hidden="true">
            {(text.title.trim()[0] ?? "M").toUpperCase()}
          </span>
          <div className={styles.monoText}>
            {renderKicker({})}
            {renderTitle({})}
            <span className={styles.ornament} aria-hidden="true" />
            {renderSubtitle({})}
            {renderButton({})}
          </div>
        </>
      );
      break;
    case "poster":
      body = (
        <>
          {renderPhoto({})}
          <span className={styles.scrim} />
          <div className={styles.posterTop}>
            {renderKicker({})}
            {renderSubtitle({})}
          </div>
          {renderButton({ className: styles.posterButton })}
          {renderTitle({ size: fit(text.title, 190, 21) })}
        </>
      );
      break;
    case "whisper":
      body = (
        <>
          {renderPhoto({})}
          <span className={styles.scrim} />
          {renderKicker({ className: styles.whisperKicker })}
          <div className={styles.whisperFoot}>
            {renderTitle({})}
            {renderButton({})}
            {renderSubtitle({})}
          </div>
        </>
      );
      break;
    case "cinema":
      body = (
        <>
          <p className={styles.cinemaCredit}>
            {brand.name ?? senderName} <span>presents</span>
          </p>
          <div className={styles.cinemaBand}>
            {renderPhoto({})}
          </div>
          <div className={styles.cinemaText}>
            {renderTitle({ size: fit(text.title, 120, 4.2) })}
            {renderKicker({})}
            {renderSubtitle({})}
            {renderButton({})}
          </div>
        </>
      );
      break;
    case "cover":
      body = (
        <>
          {renderPhoto({})}
          <span className={styles.scrim} />
          <div className={styles.coverStrip}>
            {renderSubtitle({})}
            <Studio brand={brand} senderName={senderName} />
          </div>
          {renderTitle({ size: fit(text.title, 175, 17) })}
          <div className={styles.coverLines}>
            {renderKicker({})}
            <p className={styles.coverCount}>
              Inside: {fileCount === 1 ? "1 file" : `${fileCount} files`}
            </p>
            {renderButton({ arrow: true })}
          </div>
        </>
      );
      break;
    case "keepsake":
      body = (
        <>
          <span className={styles.glow} />
          <figure className={styles.print}>
            {renderPhoto({})}
            <figcaption>{text.title}</figcaption>
          </figure>
          <div className={styles.keepsakeText}>
            {renderKicker({})}
            {renderTitle({})}
            {renderSubtitle({})}
            {renderButton({ arrow: true })}
          </div>
        </>
      );
      break;
    case "arch":
      body = (
        <>
          {renderKicker({ className: styles.archKicker })}
          <div className={styles.archWindow}>
            {renderPhoto({})}
          </div>
          <div className={styles.archText}>
            {renderTitle({})}
            {renderSubtitle({})}
            {renderButton({})}
          </div>
        </>
      );
      break;
    case "halo": {
      const ring = `${text.title} • ${text.subtitle || brand.name || senderName} • `;
      body = (
        <>
          {renderKicker({ className: styles.haloKicker })}
          <div className={styles.haloStage}>
            <div className={styles.haloDisc}>
              {renderPhoto({})}
            </div>
            <svg className={styles.haloRing} viewBox="0 0 200 200" aria-hidden="true">
              <defs>
                <path id={`halo-${headingId ?? "p"}`} d="M100,100 m-88,0 a88,88 0 1,1 176,0 a88,88 0 1,1 -176,0" />
              </defs>
              <text>
                <textPath href={`#halo-${headingId ?? "p"}`} textLength="548" lengthAdjust="spacing">
                  {ring.repeat(Math.max(1, Math.round(60 / ring.length)))}
                </textPath>
              </text>
            </svg>
          </div>
          <div className={styles.haloText}>
            {renderTitle({ className: styles.srTitle })}
            {renderButton({})}
          </div>
        </>
      );
      break;
    }
    case "diptych":
      body = (
        <>
          <div className={styles.pair}>
            {renderPhoto({})}
            {renderPhoto({ src: others[0] ?? photo })}
          </div>
          <div className={styles.diptychCard}>
            {renderKicker({})}
            {renderTitle({})}
            {renderSubtitle({})}
            {renderButton({})}
          </div>
        </>
      );
      break;
    case "contact": {
      const frames = [photo, ...others].slice(0, 4);
      while (frames.length < 4) frames.push(frames[frames.length % Math.max(1, frames.length)] ?? null);
      body = (
        <>
          <div className={styles.contactHead}>
            <div>
              {renderKicker({})}
              {renderTitle({})}
            </div>
            <div className={styles.contactSide}>
              {renderSubtitle({})}
              {renderButton({ arrow: true })}
            </div>
          </div>
          <ol className={styles.contactStrip}>
            {frames.map((frame, index) => (
              <li key={index}>
                {renderPhoto({ src: frame })}
                <span>
                  {String(index + 1).padStart(2, "0")}
                  {index === 0 ? "A ★" : "A"}
                </span>
              </li>
            ))}
          </ol>
        </>
      );
      break;
    }
    case "spine":
      body = (
        <>
          <div className={styles.spineStrip}>
            {renderTitle({ size: fit(text.title, 300, 10) })}
          </div>
          <div className={styles.spinePhoto}>
            {renderPhoto({})}
            <span className={styles.scrim} />
            <div className={styles.spineFoot}>
              {renderKicker({})}
              {renderSubtitle({})}
              {renderButton({ arrow: true })}
            </div>
          </div>
        </>
      );
      break;
    case "aurora":
      body = (
        <>
          <span className={styles.glow} />
          <div className={styles.auroraPhoto}>
            {renderPhoto({})}
          </div>
          <div className={styles.auroraText}>
            {renderKicker({})}
            {renderTitle({})}
            {renderSubtitle({})}
            {renderButton({})}
          </div>
        </>
      );
      break;
    case "tealprint":
      body = (
        <>
          <div className={styles.duotone}>
            {renderPhoto({})}
          </div>
          <div className={styles.tealText}>
            {renderKicker({})}
            {renderTitle({})}
            {renderSubtitle({})}
            {renderButton({})}
          </div>
        </>
      );
      break;
    case "invitation":
      body = (
        <>
          {renderPhoto({ className: styles.blurred })}
          <div className={styles.card}>
            {renderKicker({})}
            <span className={styles.ornament} aria-hidden="true" />
            {renderTitle({})}
            {renderSubtitle({})}
            {renderButton({})}
            <Studio brand={brand} senderName={senderName} className={styles.cardStudio} />
          </div>
        </>
      );
      break;
    case "swiss":
      body = (
        <>
          <div className={styles.swissPhoto}>
            {renderPhoto({})}
          </div>
          <div className={styles.swissGrid}>
            <span className={styles.swissIndex}>N&ordm; 01</span>
            {renderTitle({})}
            <dl className={styles.swissFacts}>
              {text.kicker && (
                <div>
                  <dt>For</dt>
                  <dd>{text.kicker.replace(/^for\s+/i, "")}</dd>
                </div>
              )}
              {text.subtitle && (
                <div>
                  <dt>Date</dt>
                  <dd>{text.subtitle}</dd>
                </div>
              )}
              <div>
                <dt>From</dt>
                <dd>{brand.name ?? senderName}</dd>
              </div>
              <div>
                <dt>Files</dt>
                <dd>{fileCount}</dd>
              </div>
            </dl>
            {renderButton({ arrow: true })}
          </div>
        </>
      );
      break;
  }

  return (
    <section
      className={`${styles.root} ${fill ? styles.fill : ""}`}
      style={style}
      aria-labelledby={headingId}
      data-template={template}
    >
      {/* The template's own box: inside the cover, so the cover's width can rearrange it. */}
      <div className={`${styles.inner} ${styles[template]}`}>{body}</div>
    </section>
  );
}
