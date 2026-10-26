import type { Metadata } from "next";
import { Suspense } from "react";
import { ExplorerShell } from "@/components/explorer/ExplorerShell";
import { PageSkeleton } from "@/components/workspace/PageSkeleton";
import { loadExplorer } from "@/lib/library";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Memo Explorer" };

async function Library({ searchParams }: { searchParams: PageProps<"/explorer">["searchParams"] }) {
  const user = await requireUser();
  const [data, params] = await Promise.all([loadExplorer(user.id), searchParams]);
  const at = typeof params.at === "string" ? params.at : null;
  return <ExplorerShell data={data} initialAt={at} />;
}

export default function ExplorerPage({ searchParams }: PageProps<"/explorer">) {
  return (
    <Suspense fallback={<PageSkeleton blocks={2} />}>
      <Library searchParams={searchParams} />
    </Suspense>
  );
}
