import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/workspace/PageSkeleton";
import { avatarSource } from "@/lib/avatar";
import { getBranding } from "@/lib/plan";
import { signInMethods } from "@/lib/profile";
import { requireUser } from "@/lib/session";
import { brandFrom, getStudio, ownerLogoPath } from "@/lib/studio";
import { NameForm, PhotoEditor } from "@/components/workspace/ProfileForms";
import { CustomDomainForm, HideBrandingForm } from "@/components/workspace/BrandingForms";
import { LogoEditor, StudioNameForm } from "@/components/workspace/StudioForms";
import styles from "@/components/workspace/Workspace.module.css";
import panels from "@/components/workspace/Settings.module.css";

export const metadata: Metadata = { title: "Profile" };

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" });
const methodText = { google: "Google", password: "Email and password" } as const;

async function ProfilePanels() {
  const user = await requireUser();
  const [methods, studio, branding] = await Promise.all([signInMethods(user.id), getStudio(user.id), getBranding(user.id)]);
  const brand = brandFrom(studio, ownerLogoPath);
  const hasPhoto = avatarSource(user.image, 96) !== null;
  return (
    <div className={panels.panels}>
      <section className={panels.panel} aria-labelledby="photo-title">
        <h2 id="photo-title" className={panels.panelTitle}>
          Your picture
        </h2>
        <PhotoEditor name={user.name} image={user.image ?? null} hasPhoto={hasPhoto} />
        <p className={panels.hint}>
          {methods.includes("google")
            ? "We took this from your Google account. Add your own and it replaces it."
            : "Add a picture so your workspace feels like yours. Until then you see your initials."}
        </p>
      </section>

      <section className={panels.panel} aria-labelledby="name-title">
        <h2 id="name-title" className={panels.panelTitle}>
          Your details
        </h2>
        <NameForm name={user.name} />
        <hr className={panels.divider} />
        <dl className={panels.facts}>
          <div className={panels.fact}>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div className={panels.fact}>
            <dt>You sign in with</dt>
            <dd>{methods.length ? methods.map((method) => methodText[method]).join(" and ") : "Email"}</dd>
          </div>
          <div className={panels.fact}>
            <dt>Member since</dt>
            <dd>{dateFormat.format(user.createdAt)}</dd>
          </div>
        </dl>
      </section>

      <section className={panels.panel} aria-labelledby="studio-title">
        <h2 id="studio-title" className={panels.panelTitle}>
          Your studio
        </h2>
        <p className={panels.panelText}>Your logo and studio name lead every client page, so clients remember who delivered.</p>
        <LogoEditor brand={brand} />
        <hr className={panels.divider} />
        <StudioNameForm name={brand.name} />
      </section>

      {/* Only shown to accounts whose plan includes it; there is no plan to buy yet, so it is turned on by hand. */}
      {branding.brandingTools && (
        <section className={panels.panel} aria-labelledby="branding-title">
          <h2 id="branding-title" className={panels.panelTitle}>
            Your branding
          </h2>
          <p className={panels.panelText}>Make client pages fully yours: no Memocraft name, and links on your own web address.</p>
          <HideBrandingForm hidden={branding.hideBranding} />
          <hr className={panels.divider} />
          <CustomDomainForm domain={branding.customDomain} status={branding.domainStatus} />
        </section>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <>
      <div className={styles.headRow}>
        <h1 className={styles.heading}>Profile</h1>
      </div>
      <p className={styles.sub}>How you appear in Memocraft and to your clients.</p>
      <Suspense fallback={<PageSkeleton blocks={3} />}>
        <ProfilePanels />
      </Suspense>
    </>
  );
}
