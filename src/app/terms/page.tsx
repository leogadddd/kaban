import type { Metadata } from "next";
import Link from "next/link";
import { Contact, LegalPage, type LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms for using Kaban, the free offline-first personal finance tracker.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

const SECTIONS: LegalSection[] = [
  {
    id: "agreement",
    title: "Agreeing to these terms",
    body: (
      <>
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your use of Kaban, the personal finance tracker available on the Kaban website and as an installable app
          (&quot;Kaban&quot;, &quot;we&quot;, &quot;us&quot;). By tapping <b>Agree</b> in the app, creating an account, or otherwise using Kaban, you agree to these Terms and to our{" "}
          <Link href="/privacy" className="font-medium text-brand hover:underline">Privacy Policy</Link>.
        </p>
        <p>If you don&apos;t agree, please don&apos;t use Kaban. You can export your records at any time before you stop.</p>
      </>
    ),
  },
  {
    id: "service",
    title: "What Kaban is",
    body: (
      <>
        <p>
          Kaban is a tool for recording and organising your own money: cash, bank and e-wallet accounts, credit cards, pay-later plans, instalments, split bills,
          money owed to you, and optional family groups. You enter every record yourself.
        </p>
        <ul>
          <li><b>Kaban doesn&apos;t connect to banks.</b> It never asks for bank, card or e-wallet logins and can&apos;t move, hold or send money.</li>
          <li><b>Kaban isn&apos;t financial advice.</b> Totals, due dates, utilisation and charts are calculated from what you enter. They are for your own reference and may be wrong if a record is wrong. Always check amounts and due dates with your bank or provider before you rely on them.</li>
          <li><b>Kaban isn&apos;t a bank or payment service</b> and isn&apos;t affiliated with any bank, e-wallet or pay-later provider whose name or logo appears in it.</li>
        </ul>
      </>
    ),
  },
  {
    id: "eligibility",
    title: "Who can use Kaban",
    body: (
      <>
        <p>You need to be at least <b>13 years old</b> to use Kaban.</p>
        <p>
          If you are between 13 and 17, a parent or guardian must read these Terms and the Privacy Policy and agree to them with you. They are responsible
          for your use of Kaban, including any account you create. We ask for your birthday when you create an account to check this, and we don&apos;t
          create accounts for anyone under 13.
        </p>
        <p>If you are 18 or older, you confirm that you can enter into a binding agreement under the laws that apply to you.</p>
      </>
    ),
  },
  {
    id: "local",
    title: "Using Kaban without an account",
    body: (
      <>
        <p>
          Without an account, everything you enter is stored only in your browser on that device. We never receive it. That also means we can&apos;t recover it:
          clearing your browser&apos;s site data, uninstalling the app, resetting or losing the device can erase it permanently.
        </p>
        <p>You are responsible for keeping backups. Kaban lets you export a full backup from <b>Sync &amp; Backup</b> at any time.</p>
      </>
    ),
  },
  {
    id: "account",
    title: "Accounts and sync",
    body: (
      <>
        <p>
          An account is optional and free. It backs up your records and syncs them between your devices. When you create one, you agree to give a real email
          address you control and to keep your password secret. Turning on two-factor sign-in is strongly recommended.
        </p>
        <ul>
          <li>You are responsible for everything done with your account. Tell us promptly if you think someone else has accessed it.</li>
          <li>Each account has a cloud storage allowance (currently 10,000 records and 10 MB). Kaban keeps working on your device beyond it, but new changes stop uploading until you make room.</li>
          <li>Kaban saves to your device first and syncs in the background. Sync can be delayed or fail, for example when you are offline. Changes made on two devices before they sync are merged record by record, and the newer edit of a record wins.</li>
        </ul>
      </>
    ),
  },
  {
    id: "families",
    title: "Families and sharing",
    body: (
      <>
        <p>
          Families let you share selected accounts with people you invite. You choose what each family sees: a balance only, or a balance with recent activity.
          Only share what you are comfortable with others seeing, and only invite people you trust.
        </p>
        <ul>
          <li>Family owners and admins approve who joins, and can remove members. Members can leave at any time.</li>
          <li>When you allow it, members can add entries to an account you share. Those entries arrive on your device for you to keep or reject.</li>
          <li>Stopping a share or leaving a family removes the shared view. It never deletes your own records.</li>
          <li>You are responsible for the names, photos and details you put on your profile and in families. Don&apos;t share other people&apos;s personal information without their permission.</li>
        </ul>
      </>
    ),
  },
  {
    id: "quick-add",
    title: "Quick add",
    body: (
      <p>
        Quick add tokens let tools like iOS Shortcuts send entries to your account. Anyone who has a token can send entries with it, so keep tokens private and
        revoke any you no longer use in <b>Settings → Quick add</b>. Entries sent this way are never added to your records until you approve them in the app.
      </p>
    ),
  },
  {
    id: "use",
    title: "Acceptable use",
    body: (
      <>
        <p>Please use Kaban only for keeping track of your own finances and those you have a right to track. You agree not to:</p>
        <ul>
          <li>break the law, or use Kaban to harass, defraud or harm anyone;</li>
          <li>try to access another person&apos;s account or data, or get around storage limits, rate limits or security controls;</li>
          <li>overload, disrupt, scrape or probe the service, or run automated sign-ups;</li>
          <li>upload malware, or content that is illegal, hateful or that you don&apos;t have the right to share.</li>
        </ul>
        <p>We may suspend or remove accounts that break these rules, especially where others are put at risk.</p>
      </>
    ),
  },
  {
    id: "yours",
    title: "Your data stays yours",
    body: (
      <p>
        You own the records you put into Kaban. We only use them to run the service for you, as described in the{" "}
        <Link href="/privacy" className="font-medium text-brand hover:underline">Privacy Policy</Link>. We don&apos;t sell them and we don&apos;t show ads. You can
        export your records at any time, and delete your cloud data from Settings.
      </p>
    ),
  },
  {
    id: "ours",
    title: "Kaban's name and software",
    body: (
      <p>
        The Kaban name, logo, mascot, design and software belong to us. You may use the app as offered, but not copy, resell or rebrand it. Bank, e-wallet and
        pay-later names and logos belong to their owners and are shown only so you can recognise your accounts.
      </p>
    ),
  },
  {
    id: "free",
    title: "Price and changes to the service",
    body: (
      <p>
        Kaban is free today. We may add, change or remove features over time, including optional paid features in the future. We will never start charging
        for something you already use without telling you first and giving you a way to export your records.
      </p>
    ),
  },
  {
    id: "warranty",
    title: "No warranty",
    body: (
      <p>
        We work hard to keep Kaban accurate, available and secure, but it is provided <b>&quot;as is&quot;</b> and <b>&quot;as available&quot;</b>. To the extent the law
        allows, we make no promises that it will be uninterrupted, error-free, or that calculations will always be correct, and we disclaim implied
        warranties of merchantability, fitness for a particular purpose and non-infringement.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: (
      <p>
        To the extent the law allows, we aren&apos;t liable for indirect or consequential losses, or for losses caused by relying on figures in Kaban, missed due
        dates, late fees, lost data you didn&apos;t back up, or someone using your account or a quick add token. Because Kaban is free, our total liability to you
        for any claim is limited to ₱1,000. Nothing in these Terms limits liability that can&apos;t be limited by law.
      </p>
    ),
  },
  {
    id: "ending",
    title: "Ending your use",
    body: (
      <p>
        You can stop using Kaban whenever you like. Export your records, then use <b>Settings → Delete account</b>: your account is erased 30 days later, and
        you can recover it by signing in before then. We may close accounts that break these Terms, or that have been inactive for a long time, after giving notice where we reasonably can.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <p>
        We may update these Terms. When we make a change you should know about, we update the date at the top and ask you to review and agree again the next
        time you open Kaban. If you don&apos;t agree to the new Terms, you can export your records and stop using the service.
      </p>
    ),
  },
  {
    id: "law",
    title: "Governing law",
    body: (
      <p>
        These Terms are governed by the laws of the Republic of the Philippines. If a dispute comes up, please contact us first and we will try to resolve it
        informally. Otherwise, disputes go to the proper courts of the Philippines, unless the law where you live gives you the right to bring them elsewhere.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: <p>Questions about these Terms? Reach us at <Contact />.</p>,
  },
];

export default function Page() {
  return (
    <LegalPage
      title="Terms of Service"
      other={{ href: "/privacy", label: "Privacy Policy" }}
      sections={SECTIONS}
      summary={
        <>
          <p>Kaban is a free tool for tracking your own money. It never connects to your bank and isn&apos;t financial advice: check important figures with your bank.</p>
          <p>Without an account your records live only on your device, so keep backups. With an account, keep your password safe and turn on two-factor sign-in.</p>
          <p>Your records are yours. Be kind, don&apos;t abuse the service, and we&apos;ll ask you to agree again if these terms change.</p>
        </>
      }
    />
  );
}
