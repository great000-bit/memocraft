"use client";

import { useEffect, useState } from "react";
import { ActivityMock, EnhanceMock, PhoneMock, SectionsMock } from "./Mockups";
import styles from "./FeatureTabs.module.css";

const DURATION = 6000;

const tabs = [
  {
    title: "Files that explain themselves",
    body: "Group files into sections and put a note on each. Your client sees \u201cFor print\u201d and \u201cFor Instagram\u201d and knows which to use, without messaging you.",
    visual: <SectionsMock />,
  },
  {
    title: "One link that stays current",
    body: "Fix a file and the same link shows the new version, marked Updated. No \u201cfinal_v3_REAL\u201d zip in anyone\u2019s inbox, and you see when it was opened.",
    visual: <ActivityMock />,
  },
  {
    title: "A free photo enhancer",
    body: "Soft or small photo? Make it sharper and four times bigger before you send it. It runs on your own device, so the photo is never uploaded, and it costs nothing.",
    visual: <EnhanceMock />,
  },
  {
    title: "Made for your client’s phone",
    body: "Most clients open your link on their phone. They save photos straight to the camera roll and ask for a missing file in one tap. No account, no app, no zip they cannot open.",
    visual: <PhoneMock className={styles.phone} />,
  },
];

// Feature switcher: each tab plays for a few seconds with a progress bar, then moves to the next.
export function FeatureTabs() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => setActive((i) => (i + 1) % tabs.length), DURATION);
    return () => window.clearTimeout(timer);
  }, [active, paused]);

  return (
    <div className={styles.wrap} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className={styles.list} role="tablist" aria-label="Features">
        {tabs.map((t, i) => (
          <button
            key={t.title}
            type="button"
            role="tab"
            id={`feature-tab-${i}`}
            aria-selected={i === active}
            aria-controls="feature-panel"
            className={`${styles.tab} ${i === active ? styles.activeTab : ""}`}
            onClick={() => setActive(i)}
          >
            <span className={styles.track} aria-hidden="true">
              <span
                key={active}
                className={`${styles.bar} ${i === active ? styles.running : ""}`}
                style={{ animationDuration: `${DURATION}ms`, animationPlayState: paused ? "paused" : "running" }}
              />
            </span>
            <span className={styles.tabTitle}>{t.title}</span>
            <span className={styles.tabBody}>{t.body}</span>
          </button>
        ))}
      </div>
      <div className={styles.stage} id="feature-panel" role="tabpanel" aria-labelledby={`feature-tab-${active}`}>
        <div key={active} className={styles.visual}>
          {tabs[active].visual}
        </div>
      </div>
    </div>
  );
}
