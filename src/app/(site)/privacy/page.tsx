import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy policy | Memocraft" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="17 October 2026">
      <p>
        Memocraft helps photographers, designers and filmmakers send finished work to clients. This page explains what
        we collect, why, and who handles it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Your account.</strong> Your name and email, and a password if you sign up with email. If you choose
          Continue with Google, we receive your name, email address and profile picture from Google. We do not get
          your Google password, and we do not read your Gmail, Drive or any other Google data.
        </li>
        <li>
          <strong>Your deliveries.</strong> The files, notes and settings you add to a delivery, and the link options
          you choose, such as a password or an end date.
        </li>
        <li>
          <strong>Client activity.</strong> When a client opens a link, downloads a file or sends a file request, we
          record that so you can see it.
        </li>
      </ul>

      <h2>How we use it</h2>
      <p>
        To run your account, store and deliver your files, show you when clients view or download, and send account
        emails such as password reset. We do not sell your data and we do not use it for advertising.
      </p>

      <h2>Who handles it</h2>
      <p>
        We use trusted providers to run Memocraft: Vercel for hosting, Cloudflare for file storage, a managed database
        provider for account and delivery records, Resend for email, and Google for sign-in when you choose it. They
        process data only to provide their service to us.
      </p>

      <h2>Your files and your clients</h2>
      <p>
        Your files are private to your account and to the people you share a link with. Anyone with a link, and its
        password if you set one, can open that delivery until you pause it, it expires, or you delete it.
      </p>

      <h2>Keeping and deleting data</h2>
      <p>
        You can delete a delivery or a file at any time. To delete your account and the data tied to it, email us and
        we will remove it.
      </p>

      <h2>Cookies</h2>
      <p>We use a cookie to keep you signed in. We do not use advertising or tracking cookies.</p>

      <h2>Contact</h2>
      <p>
        Questions or requests about your data: <a href="mailto:greatemmanwori@gmail.com">greatemmanwori@gmail.com</a>.
      </p>
    </LegalPage>
  );
}
