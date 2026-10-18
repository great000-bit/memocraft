import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/workspace/PageSkeleton";
import { getDashboardStats } from "@/lib/dashboard";
import { driveStatus } from "@/lib/drive";
import { signInMethods } from "@/lib/profile";
import { requireUser } from "@/lib/session";
import { formatSize } from "@/lib/storage-limits";
import { DriveBackup } from "@/components/workspace/DriveBackup";
import { ThemeToggle } from "@/components/workspace/ThemeToggle";
import { DeleteAccount, OtherDevices } from "@/components/workspace/SettingsForms";
import styles from "@/components/workspace/Workspace.module.css";
import panels from "@/components/workspace/Settings.module.css";
import editor from "@/components/deliveries/Editor.module.css";

export const metadata: Metadata = { title: "Settings" };

async function SettingsPanels() {
  const user = await requireUser();
  const [methods, stats, drive] = await Promise.all([signInMethods(user.id), getDashboardStats(user.id), driveStatus(user.id)]);
  const hasPassword = methods.includes("password");
  const storage = stats.storage.usedBytes === 0 ? "0 MB" : formatSize(stats.storage.usedBytes);

  return (
    <div className={panels.panels}>
      <section className={panels.panel} aria-labelledby="look-title">
        <h2 id="look-title" className={panels.panelTitle}>
          Appearance
        </h2>
        <p className={panels.panelText}>
          Your workspace opens dark. Switch to light if you prefer; this device remembers the choice. Client pages always
          stay light.
        </p>
        <div className={panels.buttonRow}>
          <ThemeToggle className={`${editor.button} ${editor.secondary}`} />
        </div>
      </section>

      <section className={panels.panel} aria-labelledby="security-title">
        <h2 id="security-title" className={panels.panelTitle}>
          Sign-in and security
        </h2>
        <p className={panels.panelText}>
          You sign in with Google, so there is no Memocraft password to manage. Google keeps your account safe.
        </p>
        <hr className={panels.divider} />
        <p className={panels.panelText}>
          Signed in somewhere you no longer use? This logs you out everywhere except this device.
        </p>
        <OtherDevices />
      </section>

      <section className={panels.panel} aria-labelledby="drive-title">
        <h2 id="drive-title" className={panels.panelTitle}>
          Back up to your Google Drive
        </h2>
        <p className={panels.panelText}>
          Optional. Memocraft saves a copy of your files in a Memocraft folder in your own Google Drive, so you always hold
          them yourself. It can only see the files and folders it makes there, nothing else in your Drive. Your client links
          keep working either way, and deleting a file here never deletes your Drive copy. The copies use your Drive space.
        </p>
        <Suspense fallback={null}>
          <DriveBackup initial={drive} />
        </Suspense>
      </section>

      <section className={panels.panel} aria-labelledby="data-title">
        <h2 id="data-title" className={panels.panelTitle}>
          Your data
        </h2>
        <p className={panels.panelText}>
          You are using {storage} of {formatSize(stats.storage.limitBytes)} across {stats.storage.fileCount}{" "}
          {stats.storage.fileCount === 1 ? "file" : "files"}. You can download a copy of everything Memocraft keeps about you:
          your details, deliveries, notes, requests and the proof of delivery history. The files themselves are not in it.
        </p>
        <div className={panels.buttonRow}>
          {/* A plain link on purpose: the browser saves the file, no page change. */}
          <a href="/api/account/export" download className={`${editor.button} ${editor.secondary}`}>
            Download my data
          </a>
        </div>
      </section>

      <section className={`${panels.panel} ${panels.dangerPanel}`} aria-labelledby="delete-title">
        <h2 id="delete-title" className={panels.panelTitle}>
          Delete account
        </h2>
        <p className={panels.panelText}>This removes your account for good. It cannot be undone.</p>
        <ul className={panels.dangerList}>
          <li>Every delivery and every file you uploaded, including earlier versions.</li>
          <li>Your client links stop working straight away.</li>
          <li>Your notes, client requests and proof of delivery history.</li>
          <li>Your profile and your sign-in.</li>
        </ul>
        <DeleteAccount email={user.email} hasPassword={hasPassword} />
      </section>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <>
      <div className={styles.headRow}>
        <h1 className={styles.heading}>Settings</h1>
      </div>
      <p className={styles.sub}>Your sign-in, your data, and your account.</p>
      <Suspense fallback={<PageSkeleton blocks={3} />}>
        <SettingsPanels />
      </Suspense>
    </>
  );
}
