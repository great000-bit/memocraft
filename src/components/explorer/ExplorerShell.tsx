"use client";

import dynamic from "next/dynamic";
import type { ExplorerData } from "@/lib/library";
import styles from "./Explorer.module.css";

// The Explorer reads saved view settings and groups files by the viewer's own clock, so it is drawn in the browser
// only. The frame below holds its place while it loads.
const Explorer = dynamic(() => import("./Explorer").then((module) => module.Explorer), {
  ssr: false,
  loading: () => <div className={styles.window} data-wide aria-busy="true" />,
});

export function ExplorerShell({ data, initialAt }: { data: ExplorerData; initialAt: string | null }) {
  return <Explorer data={data} initialAt={initialAt} />;
}
