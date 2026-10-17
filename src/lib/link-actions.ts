"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { pool } from "./auth";
import { getLinkBySlug } from "./deliveries";
import { guessLimit } from "./delivery-limits";
import { makeUnlockCookie, unlockCookieName, unlockSeconds, verifyPassword } from "./link-access";

export type UnlockResult = { error: string } | null;

const lockedMessage = (minutes: number) =>
  `Too many wrong tries. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;

// A client typing the password for a protected link. Wrong guesses are counted on the delivery, because the
// guesser is anyone holding the link and nothing identifies them; after a run of them the link stops taking
// guesses for a while. A right guess sets a cookie for this link only and shows the delivery.
export async function unlockDelivery(slug: string, _previous: UnlockResult, formData: FormData): Promise<UnlockResult> {
  const link = await getLinkBySlug(slug);
  if (!link) return { error: "This link is not available." };
  if (link.expired) return { error: "This link has expired." };
  if (!link.passwordHash) redirect(`/d/${slug}`);
  if (link.lockedMinutes) return { error: lockedMessage(link.lockedMinutes) };

  const password = formData.get("password");
  if (typeof password !== "string" || !password.trim()) return { error: "Type the password you were given." };

  if (!(await verifyPassword(password, link.passwordHash))) {
    const { rows } = await pool.query<{ minutes: number | null }>(
      `update "delivery"
          set "passwordFailures" = case when "passwordFailures" + 1 >= $2 then 0 else "passwordFailures" + 1 end,
              "passwordLockedUntil" = case when "passwordFailures" + 1 >= $2
                                           then now() + make_interval(mins => $3) else "passwordLockedUntil" end
        where "id" = $1
        returning case when "passwordLockedUntil" > now() then $3::int end as "minutes"`,
      [link.id, guessLimit.attempts, guessLimit.lockMinutes],
    );
    const minutes = rows[0]?.minutes;
    return { error: minutes ? lockedMessage(minutes) : "That password is not right. Check it and try again." };
  }

  await pool.query(`update "delivery" set "passwordFailures" = 0 where "id" = $1 and "passwordFailures" <> 0`, [link.id]);
  (await cookies()).set(unlockCookieName(link.id), makeUnlockCookie(link.id, link.passwordHash), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/d/${slug}`,
    maxAge: unlockSeconds,
  });
  redirect(`/d/${slug}`);
}
