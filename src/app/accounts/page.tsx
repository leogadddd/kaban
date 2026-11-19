"use client";

import { AccountsHub } from "@/components/accounts-hub";

// Accounts, People and Owed to me share one swipeable screen; this route opens it on its pane.
export default function Page() {
  return <AccountsHub />;
}
