import type { Metadata } from "next";
import { Suspense } from "react";
import { EnhancerTool } from "@/components/workspace/EnhancerTool";
import { PageSkeleton } from "@/components/workspace/PageSkeleton";
import { requireUser } from "@/lib/session";
import panels from "@/components/workspace/Settings.module.css";
import styles from "@/components/workspace/Workspace.module.css";

export const metadata: Metadata = { title: "Enhancer" };

async function Tool() {
  await requireUser();
  return <EnhancerTool />;
}

export default function EnhancerPage() {
  return (
    <>
      <div className={styles.headRow}>
        <h1 className={styles.heading}>Enhancer</h1>
      </div>
      <p className={styles.sub}>
        Make a soft or small photo sharper and four times bigger. It runs on your own device, so the photo is never
        uploaded, and it is free.
      </p>
      <div className={panels.panels}>
        <section className={panels.panel}>
          <Suspense fallback={<PageSkeleton blocks={1} />}>
            <Tool />
          </Suspense>
        </section>
      </div>
    </>
  );
}
