import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { AcceptInvite } from "@/components/team/AcceptInvite";
import { googleConfigured } from "@/lib/providers";
import { getSession } from "@/lib/session";
import { findInvite, invitePath } from "@/lib/team";

export const metadata: Metadata = { title: "Join a team", robots: { index: false, follow: false } };

async function Invite({ params }: Pick<PageProps<"/join/[token]">, "params">) {
  const { token } = await params;
  const [invite, session] = await Promise.all([findInvite(token), getSession()]);
  const home = <Link href={session ? "/dashboard" : "/"}>{session ? "Go to your dashboard" : "Go to Memocraft"}</Link>;

  if (!invite || invite.expired) {
    return (
      <AuthShell title="This invite has run out" lede="Invite links work for 14 days and only once. Ask whoever invited you to send a new one." footer={home}>
        {null}
      </AuthShell>
    );
  }

  const can = invite.role === "editor" ? "work on their deliveries and files" : "see their deliveries and files";
  const lede = `${invite.ownerName} invited ${invite.email} to ${can}.`;
  if (!session) {
    return (
      <AuthShell title={`Join ${invite.teamName}`} lede={lede} footer={<>Sign in with Google using {invite.email}. New here? The same button creates your free account.</>}>
        <AuthForm mode="login" googleEnabled={googleConfigured()} next={invitePath(token)} />
      </AuthShell>
    );
  }

  const matches = session.user.email.toLowerCase() === invite.email.toLowerCase();
  return (
    <AuthShell title={`Join ${invite.teamName}`} lede={lede} footer={home}>
      {matches ? (
        <AcceptInvite token={token} teamName={invite.teamName} />
      ) : (
        <p role="alert">
          This invite is for {invite.email}, and you are signed in as {session.user.email}. Log out and sign in with {invite.email}, or ask
          for an invite to this address.
        </p>
      )}
    </AuthShell>
  );
}

export default function JoinPage({ params }: PageProps<"/join/[token]">) {
  return (
    <Suspense fallback={null}>
      <Invite params={params} />
    </Suspense>
  );
}
