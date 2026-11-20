"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

/** Back to wherever the policy was opened from (the app, sign-up, the website); home if opened directly. */
export function LegalBack() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
      className="-ml-2 grid size-11 place-items-center rounded-full active:bg-pale lg:hover:bg-pale"
      aria-label="Back"
    >
      <ChevronLeft className="size-6" />
    </button>
  );
}
