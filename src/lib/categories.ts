import {
  Car,
  Coffee,
  GraduationCap,
  Heart,
  Home,
  Lightbulb,
  type LucideIcon,
  Package,
  Plane,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Utensils,
  Wallet,
  Gift,
  Briefcase,
  ArrowLeftRight,
  CreditCard,
  SlidersHorizontal,
  HandCoins,
  Undo2,
} from "lucide-react";
import type { TxnType } from "./types";

export const EXPENSE_CATEGORIES: { name: string; icon: LucideIcon }[] = [
  { name: "Groceries", icon: ShoppingCart },
  { name: "Food & Dining", icon: Utensils },
  { name: "Coffee", icon: Coffee },
  { name: "Transport", icon: Car },
  { name: "Bills & Utilities", icon: Lightbulb },
  { name: "Shopping", icon: ShoppingBag },
  { name: "Home", icon: Home },
  { name: "Health", icon: Heart },
  { name: "Education", icon: GraduationCap },
  { name: "Phone & Internet", icon: Smartphone },
  { name: "Travel", icon: Plane },
  { name: "Gifts", icon: Gift },
  { name: "Personal", icon: Sparkles },
  { name: "Other", icon: Package },
];

export const INCOME_CATEGORIES: { name: string; icon: LucideIcon }[] = [
  { name: "Salary", icon: Briefcase },
  { name: "Allowance", icon: Wallet },
  { name: "Gift", icon: Gift },
  { name: "Other", icon: Package },
];

const ALL = new Map([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].map((c) => [c.name, c.icon]));

const TYPE_ICON: Record<TxnType, LucideIcon> = {
  expense: Package,
  income: Wallet,
  transfer: ArrowLeftRight,
  card_payment: CreditCard,
  adjustment: SlidersHorizontal,
  reimbursement: HandCoins,
  refund: Undo2,
};

export function iconFor(type: TxnType, category?: string): LucideIcon {
  if (type === "expense" || type === "income") return (category && ALL.get(category)) || TYPE_ICON[type];
  return TYPE_ICON[type];
}

export const TYPE_LABEL: Record<TxnType, string> = {
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
  card_payment: "Card payment",
  adjustment: "Adjustment",
  reimbursement: "Reimbursement",
  refund: "Refund",
};

/** Chart palette (greens + supporting hues), ordered for distinguishability. */
export const CHART_COLORS = ["#1E8A5A", "#3B7DD8", "#D99A1E", "#7B5CD6", "#E0662F", "#159B9B"]; // validated (CVD-safe adjacent pairs)
