"use client";

import { ActivityHub } from "@/components/activity-hub";

// All activity, Payments and Instalments share one swipeable screen; this route opens it on its pane.
export default function Page() {
  return <ActivityHub />;
}
