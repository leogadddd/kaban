import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { LogoMark } from "@/lib/logo";

/** Shared shell for the Terms and Privacy pages. Body is empty until the policies are written. */
export function LegalPage({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="pt-safe mx-auto min-h-dvh max-w-2xl px-5 pb-[max(var(--safe-bottom),2rem)]">
      <Link href="/welcome" className="-ml-2 mt-2 grid size-11 place-items-center rounded-full active:bg-pale lg:hover:bg-pale" aria-label="Back">
        <ChevronLeft className="size-6" />
      </Link>
      <div className="mt-4 flex items-center gap-2">
        <LogoMark size={28} />
        <span className="font-semibold tracking-tight">Kaban</span>
      </div>
      <h1 className="mt-5 text-[1.9rem] leading-tight font-semibold tracking-tight">{title}</h1>
      <div className="mt-6 text-ink-2">{children}</div>
    </div>
  );
}
