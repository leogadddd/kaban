import { CloudUpload, MonitorSmartphone, ShieldCheck } from "lucide-react";

/** Why a (free, optional) cloud account helps. Shared by Welcome and Sync & backup. */
export const CLOUD_BENEFITS = [
  { icon: CloudUpload, t: "Automatic backup", d: "A lost phone or cleared browser doesn't lose your records." },
  { icon: MonitorSmartphone, t: "Use it on every device", d: "Phone, tablet and computer stay in sync." },
  { icon: ShieldCheck, t: "Private and protected", d: "Only you can read your records. Add two-factor sign-in any time." },
];
