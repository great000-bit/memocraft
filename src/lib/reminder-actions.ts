"use server";

import { revalidatePath } from "next/cache";
import { pool } from "./auth";
import { isUuid } from "./deliveries";
import { reminderChoices } from "./reminders";
import { requireUser } from "./session";

export type ReminderResult = { ok: true } | { ok: false; error: string };

// How long to wait before reminding, or null to switch reminders off for this delivery.
export async function setReminderDays(deliveryId: string, days: number | null): Promise<ReminderResult> {
  const user = await requireUser();
  if (!isUuid(deliveryId)) return { ok: false, error: "This delivery was not found." };
  if (days !== null && !(reminderChoices as readonly number[]).includes(days)) return { ok: false, error: "Pick one of the choices." };
  const result = await pool.query(`update "delivery" set "reminderDays" = $1 where "id" = $2 and "ownerId" = $3`, [
    days,
    deliveryId,
    user.id,
  ]);
  if (!result.rowCount) return { ok: false, error: "This delivery was not found." };
  revalidatePath(`/deliveries/${deliveryId}`);
  return { ok: true };
}

// The creative sent the reminder themselves (or decided not to): it stops showing as waiting.
export async function markRemindersHandled(deliveryId: string): Promise<ReminderResult> {
  const user = await requireUser();
  if (!isUuid(deliveryId)) return { ok: false, error: "This delivery was not found." };
  await pool.query(
    `update "deliveryReminder" r set "handledAt" = now()
       from "delivery" d
      where r."deliveryId" = d."id" and d."id" = $1 and d."ownerId" = $2 and r."handledAt" is null`,
    [deliveryId, user.id],
  );
  revalidatePath(`/deliveries/${deliveryId}`);
  revalidatePath("/notifications");
  return { ok: true };
}
