"use client";

import { ClearNotifications, NotificationsList } from "@/components/notifications-panel";
import { PageHeader } from "@/components/ui";

/** Phones. Desktop opens the same list in a side panel from the bell (notifications-ui). */
export default function NotificationsPage() {
  return (
    <>
      <PageHeader title="Notifications" back="/home" profile={false} action={<ClearNotifications />} />
      <div className="px-4 pb-6">
        <NotificationsList />
      </div>
    </>
  );
}
