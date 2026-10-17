import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import styles from "@/components/auth/AuthForm.module.css";

export const metadata: Metadata = { title: "Choose a new password | Memocraft", robots: { index: false } };

async function Form({ searchParams }: Pick<PageProps<"/reset-password">, "searchParams">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  if (!token || params.error) {
    return (
      <div className={styles.form}>
        <p className={styles.error} role="alert">
          This link has expired or was already used.
        </p>
        <Link href="/forgot-password" className={styles.forgot}>
          Send a new link
        </Link>
      </div>
    );
  }
  return <ResetPasswordForm token={token} />;
}

export default function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  return (
    <AuthShell
      title="Choose a new password"
      lede="Pick something you have not used before."
      footer={
        <>
          Back to <Link href="/login">log in</Link>
        </>
      }
    >
      <Suspense fallback={null}>
        <Form searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
