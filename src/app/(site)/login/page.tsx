import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { RedirectIfSignedIn } from "@/components/auth/RedirectIfSignedIn";
import { googleConfigured } from "@/lib/providers";

export const metadata: Metadata = { title: "Log in", robots: { index: false, follow: true } };

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      lede="Log in to your deliveries."
      footer={
        <>
          New to Memocraft? <Link href="/signup">Create a free account</Link>
        </>
      }
    >
      <Suspense>
        <RedirectIfSignedIn />
      </Suspense>
      <AuthForm mode="login" googleEnabled={googleConfigured()} />
    </AuthShell>
  );
}
