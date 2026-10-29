import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The terms for using Memocraft to deliver files to clients: your account, your files, what you must not do, and ending your account.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated="17 October 2026">
      <p>By creating an account or using Memocraft, you agree to these terms.</p>

      <h2>Your account</h2>
      <p>
        Keep your login details safe. You are responsible for what happens under your account. You must give accurate
        information when you sign up.
      </p>

      <h2>Your content</h2>
      <p>
        You keep ownership of everything you upload. You give us permission to store it and show it to the people you
        share it with, only so the service works. You confirm you have the right to share what you upload.
      </p>

      <h2>Google Drive backup</h2>
      <p>
        When you sign in with Google, Memocraft asks for permission to save a copy of your deliveries in a Memocraft
        folder in your own Google Drive, so you always keep your files. It can only see the files and folders it
        creates there, nothing else in your Drive. The copies use your Drive space. You can turn this off any time in
        Settings, and deleting a file in Memocraft never deletes your Drive copy. See the privacy policy for how we
        handle the permission.
      </p>

      <h2>What you must not do</h2>
      <ul>
        <li>Upload anything illegal, or that infringes someone else&rsquo;s rights.</li>
        <li>Upload malware, or try to break or overload the service.</li>
        <li>Use Memocraft to harass people or to send spam.</li>
      </ul>
      <p>We may remove content or suspend accounts that break these rules.</p>

      <h2>Availability</h2>
      <p>
        We work to keep Memocraft running, but we cannot promise it will always be available or error free. Keep your
        own copies of important files.
      </p>

      <h2>Liability</h2>
      <p>
        Memocraft is provided as it is. To the extent the law allows, we are not liable for lost data, lost income or
        indirect damages arising from your use of the service.
      </p>

      <h2>Ending your account</h2>
      <p>You can stop using Memocraft and delete your account at any time. We may end accounts that break these terms.</p>

      <h2>Changes</h2>
      <p>We may update these terms. If we make a significant change, we will say so on this page.</p>

      <h2>Contact</h2>
      <p>
        Questions: <a href="mailto:greatemmanwori@gmail.com">greatemmanwori@gmail.com</a>. See also our{" "}
        <a href="/privacy">privacy policy</a>.
      </p>
    </LegalPage>
  );
}
