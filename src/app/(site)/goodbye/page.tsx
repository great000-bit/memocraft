import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Account deleted | Memocraft", robots: { index: false, follow: false } };

// Where someone lands after deleting their account.
export default function GoodbyePage() {
  return (
    <LegalPage title="Your account is deleted">
      <p>
        Your deliveries, files, notes and sign-in are gone, and your client links no longer open. We are sorry to see
        you go.
      </p>
      <p>
        If you change your mind you are welcome back any time with a new account. <Link href="/signup">Create one</Link>.
      </p>
    </LegalPage>
  );
}
