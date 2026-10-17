"use client";

import { useEffect, useState } from "react";
import { ActivityMock, PhoneMock, SectionsMock } from "./Mockups";
import styles from "./FeatureTabs.module.css";

const DURATION = 6000;

const tabs = [
  {
    title: "Files that explain themselves",
    body: "Group files into sections and add a short note to each. Your client knows which file is for print and which is for Instagram without asking you.",
    visual: <SectionsMock />,
  },
  {
    title: "One link that stays current",
    body: "Replace a file and the same link shows the new version, marked Updated. See when your client opened it and what they downloaded.",
    visual: <ActivityMock />,
  },
  {
    title: "Made for your client’s phone",
    body: "Clients save straight to their camera roll and ask for a missing file in one tap. No account, no app, no zip they cannot open.",
    visual: <PhoneMock />,
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
