import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/workspace/PageSkeleton";
import { DeliveryEditor } from "@/components/deliveries/DeliveryEditor";
import { getDeliveryForOwner } from "@/lib/deliveries";
import { getActivity } from "@/lib/delivery-events";
import { emailConfigured } from "@/lib/email";
import { loadFeedback } from "@/lib/feedback";
import { getBranding, linkOrigin } from "@/lib/plan";
import { clientLink, getReminderState, raiseDueReminders, reminderMessage } from "@/lib/reminders";
import { getStudio } from "@/lib/studio";
import { listRequests } from "@/lib/requests";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Edit delivery" };

async function Editor({ params }: Pick<PageProps<"/deliveries/[id]">, "params">) {
  const user = await requireUser();
  const { id } = await params;
  // Reminders that came due since the daily job ran show up as soon as the creative looks.
  await raiseDueReminders(user.id).catch((error) => console.error("Could not raise reminders:", error));
  const delivery = await getDeliveryForOwner(id, user.id);
  if (!delivery) notFound();
  const [activity, requests, feedback, reminders, branding, studio] = await Promise.all([
    getActivity(delivery.id, user.id),
    listRequests(user.id, { deliveryId: delivery.id }),
    loadFeedback(delivery),
    getReminderState(delivery.id, user.id),
    getBranding(user.id),
    getStudio(user.id),
  ]);
  const origin = linkOrigin(branding);
  const message = reminderMessage({
    clientName: delivery.clientName,
    title: delivery.title,
    senderName: studio?.name ?? user.name,
    url: clientLink(delivery.slug, origin ? branding.customDomain : null),
  });
  return (
    <DeliveryEditor
      delivery={delivery}
      activity={activity}
      requests={requests}
      feedback={feedback}
      reminders={{
        nextAt: reminders.nextAt?.toISOString() ?? null,
        opened: reminders.opened,
        sent: reminders.sent.map((reminder) => ({ ...reminder, at: reminder.at.toISOString() })),
        message,
        emailOn: emailConfigured(),
      }}
      linkOrigin={origin}
    />
  );
}

export default function DeliveryPage({ params }: PageProps<"/deliveries/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton blocks={4} label="Loading delivery" />}>
      <Editor params={params} />
    </Suspense>
  );
}
