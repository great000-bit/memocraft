import { Phone } from "./Phone";
import { Photo } from "./Photo";
import type { PhotoKey } from "./photos";
import styles from "./Mockups.module.css";

// Drawn product previews used on the landing page.
function Thumb({ photo, sizes }: { photo: PhotoKey; sizes: string }) {
  return (
    <i className={styles.thumb} aria-hidden="true">
      <Photo name={photo} sizes={sizes} />
    </i>
  );
}

const lookbook: PhotoKey[] = [
  "printLaugh",
  "capFists",
  "purplePhone",
  "printSmile",
  "beretPhone",
  "limePhone",
  "faceSculpture",
  "headphones",
];

export function DeliveryMock() {
  return (
    <div className={styles.window} role="img" aria-label="A Memocraft delivery page with labelled sections">
      <div className={styles.chrome} aria-hidden="true">
        <span />
        <span />
        <span />
        <p className={styles.url}>memocraft.app/d/spring-lookbook</p>
      </div>
      <div className={styles.deliveryBody}>
        <aside className={styles.side}>
          <p className={styles.studio}>Lumen Studio</p>
          <p className={styles.title}>Spring Lookbook</p>
          <p className={styles.meta}>Lookbook &middot; 48 files</p>
          <ul className={styles.toc}>
            <li className={styles.active}>Hero shots</li>
            <li>Portraits</li>
            <li>For Instagram</li>
            <li>Film</li>
          </ul>
          <span className={styles.save}>Save all to phone</span>
        </aside>
        <div className={styles.main}>
          <div className={styles.sectionHead}>
            <p className={styles.sectionTitle}>Hero shots</p>
            <p className={styles.note}>Full resolution. These are the ones for print.</p>
          </div>
          <div className={styles.grid}>
            {lookbook.map((photo) => (
              <Thumb key={photo} photo={photo} sizes="(min-width: 720px) 120px, 22vw" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SectionsMock() {
  return (
    <div className={styles.card} role="img" aria-label="Files grouped into sections, each with a note">
      {[
        { name: "Hero shots", note: "Full resolution, for your printer", photo: "printLaugh" as PhotoKey },
        { name: "Social crops", note: "Sized for Instagram, ready to post", photo: "purplePhone" as PhotoKey },
        { name: "Campaign artwork", note: "Layered PSD and a flat PNG", photo: "headphones" as PhotoKey },
      ].map((s) => (
        <div key={s.name} className={styles.row}>
          <Thumb photo={s.photo} sizes="72px" />
          <div>
            <p className={styles.rowTitle}>{s.name}</p>
            <p className={styles.note}>{s.note}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ActivityMock() {
  return (
    <div className={styles.card} role="img" aria-label="Delivery activity: link opened, files downloaded, file updated">
      <div className={styles.activityHead}>
        <p className={styles.rowTitle}>Brand launch film</p>
        <span className={styles.badge}>Downloaded</span>
      </div>
      <ol className={styles.timeline}>
        <li>
          <b>Sent</b> to Kemi at Orbit Foods <span>Mon 09:12</span>
        </li>
        <li>
          <b>Opened</b> on iPhone in Lagos <span>Mon 09:40</span>
        </li>
        <li>
          <b>Downloaded</b> launch-film-4k.mp4 <span>Mon 09:44</span>
        </li>
        <li className={styles.updatedItem}>
          <b>Updated</b> subtitles fixed, same link <span>Tue 14:03</span>
        </li>
      </ol>
    </div>
  );
}

const phonePhotos: PhotoKey[] = ["printLaugh", "capFists", "faceSculpture", "purplePhone", "limePhone", "beretPhone"];

// The client's view on an iPhone: the gallery scrolls under a Save to phone bar pinned to the bottom.
export function PhoneMock({ className = "", tilt = true }: { className?: string; tilt?: boolean }) {
  return (
    <Phone label="A delivery open on an iPhone with Save to phone and Ask for a file" className={className} tilt={tilt}>
      <div className={styles.phoneInner}>
        <p className={styles.phoneStudio}>Lumen Studio</p>
        <p className={styles.phoneTitle}>Spring Lookbook</p>
        <div className={styles.phoneGrid}>
          {phonePhotos.map((photo) => (
            <i key={photo}>
              <Photo name={photo} sizes="120px" />
            </i>
          ))}
        </div>
        <div className={styles.phoneBar}>
          <span className={styles.phoneSave}>Save to phone</span>
          <span className={styles.phoneAsk}>Ask for a file</span>
        </div>
      </div>
    </Phone>
  );
}
