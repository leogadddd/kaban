import Link from "next/link";
import type { ReactNode } from "react";
import { LegalBack } from "./legal-back";
import { ChestArt } from "./chest-art";
import { LogoMark } from "@/lib/logo";
import { LEGAL_UPDATED } from "@/lib/legal-versions";
import { SITE_CONTACT_EMAIL } from "@/lib/site";

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

/** Shared shell for the Terms of Service and Privacy Policy: summary, contents, numbered sections. */
export function LegalPage({ title, summary, sections, other }: { title: string; summary: ReactNode; sections: LegalSection[]; other: { href: string; label: string } }) {
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="pt-safe sticky top-0 z-30 border-b border-line/70 bg-bg/85 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-2 px-4 sm:px-6">
          <LegalBack />
          <Link href="/" className="flex items-center gap-2">
            <LogoMark size={26} />
            <span className="font-semibold tracking-tight">Kaban</span>
          </Link>
          <Link href={other.href} className="ml-auto text-sm font-medium text-ink-2 hover:text-ink">
            {other.label}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-10 pb-[max(var(--safe-bottom),4rem)] sm:px-6">
        <p className="text-sm font-semibold tracking-wide text-brand-2 uppercase">Last updated {LEGAL_UPDATED}</p>
        <h1 className="mt-3 text-[2.2rem] leading-tight font-semibold tracking-tight sm:text-5xl">{title}</h1>

        <div className="mt-8 flex gap-4 rounded-3xl border border-line bg-surface p-5 sm:p-6">
          <ChestArt lidLift={12} effects={false} className="hidden h-16 w-[4.3rem] shrink-0 sm:block" />
          <div className="text-[0.95rem] leading-relaxed text-ink-2">
            <p className="font-semibold text-ink">The short version</p>
            <div className="mt-2 space-y-2">{summary}</div>
          </div>
        </div>

        <nav aria-label="Contents" className="mt-8 rounded-3xl bg-pale/60 p-5 sm:p-6">
          <p className="text-sm font-semibold">Contents</p>
          <ol className="mt-3 grid gap-x-6 gap-y-1.5 text-sm text-ink-2 sm:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="hover:text-brand">
                  <span className="num mr-2 text-ink-3">{i + 1}.</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 space-y-10">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2 className="text-xl font-semibold tracking-tight">
                <span className="num mr-2 text-ink-3">{i + 1}.</span>
                {s.title}
              </h2>
              <div className="legal-body mt-3 space-y-3 leading-relaxed text-ink-2">{s.body}</div>
            </section>
          ))}
        </div>

        <p className="mt-12 border-t border-line pt-6 text-sm text-ink-3">
          {SITE_CONTACT_EMAIL ? (
            <>
              Questions? Email{" "}
              <a href={`mailto:${SITE_CONTACT_EMAIL}`} className="font-medium text-brand hover:underline">
                {SITE_CONTACT_EMAIL}
              </a>
              .
            </>
          ) : (
            "Questions? Reach us through the contact details on the Kaban website."
          )}{" "}
          See also our <Link href={other.href} className="font-medium text-brand hover:underline">{other.label}</Link>.
        </p>
      </main>
    </div>
  );
}

/** How people reach us, for use inside a section. */
export function Contact() {
  return SITE_CONTACT_EMAIL ? (
    <a href={`mailto:${SITE_CONTACT_EMAIL}`} className="font-medium text-brand hover:underline">
      {SITE_CONTACT_EMAIL}
    </a>
  ) : (
    <>the contact details on the Kaban website</>
  );
}
