"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireUser } from "./session";
import { disableBackup, driveStatus, enableBackup, retryAll, runDriveBackup, type DriveStatus } from "./drive";

// Settings reads this to draw the Drive card, and again while files are still being copied.
export async function getDriveStatus(): Promise<DriveStatus> {
  const user = await requireUser();
  return driveStatus(user.id);
}

// For someone who already granted Drive and turned the backup off: no trip to Google is needed.
export async function turnOnDriveBackup(): Promise<void> {
  const user = await requireUser();
  const status = await driveStatus(user.id);
  if (!status.connected) return;
  await enableBackup(user.id);
  after(() => runDriveBackup(user.id));
  revalidatePath("/settings");
}

export async function turnOffDriveBackup(): Promise<void> {
  const user = await requireUser();
  await disableBackup(user.id);
  revalidatePath("/settings");
}

// "Back up now": queue everything that is waiting or failed and copy for a while in the background.
export async function backUpNow(): Promise<void> {
  const user = await requireUser();
  await retryAll(user.id);
  after(() => runDriveBackup(user.id));
}
