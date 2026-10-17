import { pool } from "./auth";

// What an account may use beyond the free product, and the creative's own branding choices. "brandingTools" is
// off until plans exist; while it is off, "hideBranding" and the custom address have no effect anywhere.
export type BrandingSettings = {
  brandingTools: boolean;
  hideBranding: boolean;
  customDomain: string | null;
  domainStatus: "pending" | "active" | null;
};

export async function getBranding(userId: string): Promise<BrandingSettings> {
  const { rows } = await pool.query<BrandingSettings>(
    `select coalesce(ap."brandingTools", false) as "brandingTools",
            coalesce(st."hideBranding", false) as "hideBranding",
            st."customDomain", st."domainStatus"
       from (select $1::text as "id") u
       left join "accountPlan" ap on ap."userId" = u."id"
       left join "studio" st on st."userId" = u."id"`,
    [userId],
  );
  return rows[0];
}

// The address client links should use: the creative's own once it works, else null for this site's.
export function linkOrigin(branding: BrandingSettings): string | null {
  return branding.brandingTools && branding.domainStatus === "active" && branding.customDomain ? `https://${branding.customDomain}` : null;
}

export const showsBranding = (branding: BrandingSettings) => !(branding.brandingTools && branding.hideBranding);
