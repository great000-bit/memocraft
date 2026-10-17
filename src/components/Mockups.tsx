import styles from "./Mockups.module.css";

// Drawn product previews used on the landing page. Thumbnails are colour blocks standing in for photos.
function Thumb({ tone }: { tone: number }) {
  return <i className={`${styles.thumb} ${styles[`tone${tone}`]}`} aria-hidden="true" />;
}

export function DeliveryMock() {
  return (
    <div className={styles.window} role="img" aria-label="A Memocraft delivery page with labelled sections">
      <div className={styles.chrome} aria-hidden="true">
        <span />
        <span />
        <span />
        <p className={styles.url}>memocraft.app/d/adaeze-tobi</p>
      </div>
      <div className={styles.deliveryBody}>
        <aside className={styles.side}>
          <p className={styles.studio}>Lumen Studio</p>
          <p className={styles.title}>Adaeze &amp; Tobi</p>
          <p className={styles.meta}>Wedding &middot; 48 files</p>
          <ul className={styles.toc}>
            <li className={styles.active}>Ceremony</li>
            <li>Portraits</li>
            <li>For Instagram</li>
            <li>Film</li>
          </ul>
          <span className={styles.save}>Save all to phone</span>
        </aside>
        <div className={styles.main}>
          <div className={styles.sectionHead}>
            <p className={styles.sectionTitle}>Ceremony</p>
            <p className={styles.note}>Full resolution. These are the ones for print.</p>
          </div>
          <div className={styles.grid}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <Thumb key={n} tone={(n % 4) + 1} />
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
        { name: "Logo files", note: "SVG for web, EPS for your printer", tone: 1 },
        { name: "Brand colours", note: "Hex and CMYK in one PDF", tone: 2 },
        { name: "Social templates", note: "Edit in Canva, sized for Instagram", tone: 3 },
      ].map((s) => (
        <div key={s.name} className={styles.row}>
          <Thumb tone={s.tone} />
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

export function PhoneMock() {
  return (
    <div className={styles.phone} role="img" aria-label="A delivery open on a phone with a save to phone button">
      <div className={styles.notch} aria-hidden="true" />
      <p className={styles.studio}>Lumen Studio</p>
      <p className={styles.title}>Adaeze &amp; Tobi</p>
      <div className={styles.phoneGrid}>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <Thumb key={n} tone={(n % 4) + 1} />
        ))}
      </div>
      <span className={styles.save}>Save to phone</span>
      <span className={styles.request}>Ask for a file</span>
    </div>
  );
}
