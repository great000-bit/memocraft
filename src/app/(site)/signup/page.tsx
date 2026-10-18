import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { RedirectIfSignedIn } from "@/components/auth/RedirectIfSignedIn";
import { googleConfigured } from "@/lib/providers";

export const metadata: Metadata = { title: "Create your Memocraft account" };

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your free account"
      lede="Send your first delivery in minutes. Your clients never need an account."
      footer={
        <>
          Already have an account? <Link href="/login">Log in</Link>
        </>
      }
    >
      <Suspense>
        <RedirectIfSignedIn />
      </Suspense>
      <AuthForm mode="signup" googleEnabled={googleConfigured()} />
    </AuthShell>
  );
}
