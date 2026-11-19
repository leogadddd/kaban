import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms and Conditions", robots: { index: false } };

// Placeholder: content to be written.
export default function Page() {
  return <LegalPage title="Terms and Conditions" />;
}
