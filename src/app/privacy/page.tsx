import type { Metadata } from "next";
import Link from "next/link";
import { Contact, LegalPage, type LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Kaban stores, where it lives, who can see it, and the choices you have.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

const SECTIONS: LegalSection[] = [
  {
    id: "scope",
    title: "Who we are and what this covers",
    body: (
      <>
        <p>
          This policy explains how Kaban (&quot;we&quot;, &quot;us&quot;) handles personal information when you use the Kaban website and app. We handle it in line with
          the Philippine Data Privacy Act of 2012 (Republic Act No. 10173) and its implementing rules.
        </p>
        <p>
          Kaban is built local-first: the app reads and writes your records on your device, and anything sent to us happens in the background only when you
          have chosen to sign in.
        </p>
      </>
    ),
  },
  {
    id: "no-account",
    title: "Without an account",
    body: (
      <>
        <p>
          If you use Kaban without signing in, <b>your records never leave your device</b>. Accounts, transactions, people, instalments and settings are stored
          in your browser&apos;s storage (IndexedDB and local storage) on that device only. We can&apos;t see them, and we can&apos;t recover them for you.
        </p>
        <p>Backups you export are files you keep. Where you store them is up to you.</p>
      </>
    ),
  },
  {
    id: "collect",
    title: "What we collect when you sign in",
    body: (
      <>
        <p>If you create an account, we store the following so we can back up and sync your data:</p>
        <ul>
          <li><b>Sign-in details:</b> your email address, a securely hashed password (we never see it in plain text), and your two-factor authenticator if you set one up.</li>
          <li><b>Your records:</b> the accounts, transactions, instalments, people, splits and balances you enter, including any notes and categories.</li>
          <li><b>Your profile, if you fill it in:</b> display name, photo and birthday. Your birthday is never shown to others.</li>
          <li><b>Family details, if you use families:</b> the families you belong to, your role, join requests, and the snapshots of accounts you choose to share.</li>
          <li><b>Quick add:</b> your quick add tokens (stored as a one-way hash, never the token itself) and the entries sent with them, with whether you approved or rejected each one.</li>
          <li><b>Your agreement:</b> which version of these policies and the Terms you agreed to, and when.</li>
          <li><b>Technical data:</b> the server keeps standard logs (such as IP address, time and request type) for security and troubleshooting.</li>
        </ul>
        <p>We don&apos;t collect your bank, card or e-wallet logins, ever.</p>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use it",
    body: (
      <>
        <p>Only to provide Kaban to you:</p>
        <ul>
          <li>to sign you in, keep your account secure and send emails you ask for, such as account confirmation and password resets;</li>
          <li>to back up your records and keep your devices in sync;</li>
          <li>to show the people in your families what you have chosen to share with them;</li>
          <li>to enforce storage limits, prevent abuse and fix problems.</li>
        </ul>
        <p>
          We process this information to perform our agreement with you (the Terms of Service), and for our legitimate interest in keeping the service secure.
          Where the law requires consent, we rely on the consent you give when you agree in the app.
        </p>
      </>
    ),
  },
  {
    id: "not",
    title: "What we don't do",
    body: (
      <ul>
        <li>We don&apos;t sell or rent your personal information.</li>
        <li>We don&apos;t show ads, and we don&apos;t use your records for advertising or profiling.</li>
        <li>We don&apos;t use third-party analytics or tracking cookies.</li>
        <li>We don&apos;t read your records except when you ask us to help with a problem, or when the law requires it.</li>
      </ul>
    ),
  },
  {
    id: "sharing",
    title: "Who can see your information",
    body: (
      <>
        <ul>
          <li><b>You.</b> Database access rules only let your signed-in account read your records.</li>
          <li>
            <b>Your family members,</b> only for what you share: your display name and photo, and for each shared account the balance, or the balance with
            recent activity if you choose that. They never see your other accounts, notes or people.
          </li>
          <li>
            <b>Service providers</b> who run Kaban for us under contract: our database and authentication provider (Supabase) and our website hosting
            provider. They process data only on our instructions and may store it on servers outside the Philippines, with safeguards in place.
          </li>
          <li><b>Authorities,</b> only when the law requires it, and we will push back on requests that are not lawful.</li>
        </ul>
      </>
    ),
  },
  {
    id: "security",
    title: "How we protect it",
    body: (
      <p>
        Data is encrypted in transit (HTTPS). Database rules isolate each account, and two-factor sign-in, when you enable it, is required for sync too. Each
        signed-in account keeps its own copy on the device, separate from any local-only ledger. No system is perfectly secure; if a breach affects your
        personal information, we will notify you and the National Privacy Commission as the law requires.
      </p>
    ),
  },
  {
    id: "device",
    title: "Storage on your device",
    body: (
      <p>
        Kaban uses your browser&apos;s storage to work offline: your ledger, preferences such as theme and privacy mode, and a flag that you have finished setup.
        Signing in also stores a session token so you stay signed in. These are needed for the app to work; they aren&apos;t used for tracking.
      </p>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <p>
        We keep your cloud data for as long as you have an account. You can delete your synced records at any time from <b>Settings</b>, and revoke quick add
        tokens there too. If you want your whole account removed, including your sign-in, profile and family memberships,
        contact us and we will delete it, except anything we must keep by law. Server logs are kept for a short period.
      </p>
    ),
  },
  {
    id: "rights",
    title: "Your rights",
    body: (
      <>
        <p>Under the Data Privacy Act you have the right to:</p>
        <ul>
          <li>be informed about how your data is used (this page);</li>
          <li>access your data, and get a copy in a portable format (Kaban&apos;s export does this for your records);</li>
          <li>correct inaccurate data (you can edit everything in the app);</li>
          <li>object to processing, or withdraw consent, and ask us to erase or block your data;</li>
          <li>file a complaint with the National Privacy Commission, and claim damages where the law allows.</li>
        </ul>
        <p>To use any of these, reach us at <Contact />. We may need to confirm it&apos;s you first.</p>
      </>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: <p>Kaban isn&apos;t meant for children under 18 without a parent or guardian. If you think a child gave us personal information, contact us and we will delete it.</p>,
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        When we change this policy in a way that matters, we update the date at the top and ask you to review and agree again the next time you open Kaban.
        Your agreement is saved with your account so you are asked once, not on every device.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Questions or requests about your data? Reach us at <Contact />. You can also read our{" "}
        <Link href="/terms" className="font-medium text-brand hover:underline">Terms of Service</Link>.
      </p>
    ),
  },
];

export default function Page() {
  return (
    <LegalPage
      title="Privacy Policy"
      other={{ href: "/terms", label: "Terms of Service" }}
      sections={SECTIONS}
      summary={
        <>
          <p>Without an account, your records stay on your device. We never see them.</p>
          <p>With an account, we store your email and records only to back them up and sync them, protected so only your account can read them.</p>
          <p>No ads, no selling your data, no tracking. Families see only what you choose to share.</p>
        </>
      }
    />
  );
}
