"use server";

import { revalidatePath } from "next/cache";
import { pool } from "./auth";
import { cleanDomain, domainProblem } from "./hosts";
import { getBranding } from "./plan";
import { requireUser } from "./session";

export type BrandingResult = { ok: true; message?: string } | { ok: false; error: string };

const fail = (error: string): BrandingResult => ({ ok: false, error });
const notOnPlan = fail("This is part of a paid plan, which is not on for your account.");

function refresh() {
  revalidatePath("/profile");
  revalidatePath("/deliveries", "layout");
}

// Hides "Sent with Memocraft" at the foot of the creative's client pages.
export async function setHideBranding(hide: boolean): Promise<BrandingResult> {
  const user = await requireUser();
  if (!(await getBranding(user.id)).brandingTools) return notOnPlan;
  await pool.query(
    `insert into "studio" ("userId", "hideBranding") values ($1, $2)
     on conflict ("userId") do update set "hideBranding" = excluded."hideBranding", "updatedAt" = now()`,
    [user.id, hide === true],
  );
  refresh();
  return { ok: true };
}

// Adding the address to the Memocraft project on Vercel needs an access token. Without one the address waits until
// someone at Memocraft adds it by hand; "Check again" then finds it working.
const vercel = () => {
  const token = process.env.VERCEL_API_TOKEN;
  const project = process.env.VERCEL_PROJECT_ID;
  if (!token || !project) return null;
  const team = process.env.VERCEL_TEAM_ID ? `?teamId=${encodeURIComponent(process.env.VERCEL_TEAM_ID)}` : "";
  return { token, project, team };
};

async function addToVercel(domain: string): Promise<void> {
  const api = vercel();
  if (!api) return;
  const response = await fetch(`https://api.vercel.com/v10/projects/${encodeURIComponent(api.project)}/domains${api.team}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${api.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: domain }),
  });
  // 409 means it is already on the project, which is what we want.
  if (!response.ok && response.status !== 409) console.error("Vercel did not add a custom domain:", response.status);
}

async function removeFromVercel(domain: string): Promise<void> {
  const api = vercel();
  if (!api) return;
  const response = await fetch(
    `https://api.vercel.com/v9/projects/${encodeURIComponent(api.project)}/domains/${encodeURIComponent(domain)}${api.team}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${api.token}` } },
  );
  if (!response.ok && response.status !== 404) console.error("Vercel did not remove a custom domain:", response.status);
}

// The address works when Memocraft answers on it. Only this fixed path is asked, over https, without following
// redirects, and only for an address that passed the format check.
async function answers(domain: string): Promise<boolean> {
  try {
    const response = await fetch(`https://${domain}/api/domain-check`, {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return false;
    const body = (await response.json()) as { app?: string };
    return body.app === "memocraft";
  } catch {
    return false;
  }
}

export async function connectDomain(input: string): Promise<BrandingResult> {
  const user = await requireUser();
  if (!(await getBranding(user.id)).brandingTools) return notOnPlan;
  const domain = cleanDomain(typeof input === "string" ? input : "");
  const problem = domainProblem(domain);
  if (problem) return fail(problem);
  try {
    await pool.query(
      `insert into "studio" ("userId", "customDomain", "domainStatus") values ($1, $2, 'pending')
       on conflict ("userId") do update set "customDomain" = excluded."customDomain", "domainStatus" = 'pending', "updatedAt" = now()`,
      [user.id, domain],
    );
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return fail("Another Memocraft account already uses that address.");
    throw error;
  }
  await addToVercel(domain);
  return checkDomain();
}

export async function checkDomain(): Promise<BrandingResult> {
  const user = await requireUser();
  const branding = await getBranding(user.id);
  if (!branding.brandingTools) return notOnPlan;
  if (!branding.customDomain) return fail("Add an address first.");
  const works = await answers(branding.customDomain);
  await pool.query(`update "studio" set "domainStatus" = $2, "updatedAt" = now() where "userId" = $1`, [
    user.id,
    works ? "active" : "pending",
  ]);
  refresh();
  return works
    ? { ok: true, message: "Your address works. New links use it from now on." }
    : { ok: true, message: "Not working yet. DNS changes can take up to a day; check again later." };
}

// Links go back to Memocraft's address straight away. Links already sent on the old address stop working there.
export async function removeDomain(): Promise<BrandingResult> {
  const user = await requireUser();
  const branding = await getBranding(user.id);
  if (!branding.customDomain) return { ok: true };
  await pool.query(`update "studio" set "customDomain" = null, "domainStatus" = null, "updatedAt" = now() where "userId" = $1`, [user.id]);
  await removeFromVercel(branding.customDomain);
  refresh();
  return { ok: true };
}
