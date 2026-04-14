import { parseDateLocal } from "@/lib/utils/dates";

export type UrgencyInfo = {
  variant: "default" | "secondary" | "destructive" | "outline";
  label: string;
  className: string;
  daysRemaining: number;
};

export function getUrgencyInfo(dueDateStr: string): UrgencyInfo {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDate = parseDateLocal(dueDateStr);
  const diffMs = dueDate.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    return {
      variant: "destructive",
      label: `${Math.abs(daysRemaining)} days overdue`,
      className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      daysRemaining,
    };
  }
  if (daysRemaining <= 7) {
    return {
      variant: "secondary",
      label: daysRemaining === 0 ? "Due today" : `${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
      className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
      daysRemaining,
    };
  }
  if (daysRemaining <= 30) {
    return {
      variant: "secondary",
      label: `${daysRemaining} days`,
      className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      daysRemaining,
    };
  }
  return {
    variant: "outline",
    label: `${daysRemaining} days`,
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    daysRemaining,
  };
}

export const typeColors: Record<string, string> = {
  gst: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  provisional_tax: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  income_tax: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  paye: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  ir4: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  ir3: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
  annual_return: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  acc_levy: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  fbt: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400",
  schedular_payment: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
};

export const typeLabels: Record<string, string> = {
  gst: "GST",
  provisional_tax: "Provisional Tax",
  income_tax: "Income Tax",
  paye: "PAYE",
  ir4: "IR4",
  ir3: "IR3",
  annual_return: "Annual Return",
  acc_levy: "ACC Levy",
  fbt: "FBT",
  schedular_payment: "Schedular Payment",
};

export const statusColors: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  ready: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  filed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

export const statusLabels: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  ready: "Ready",
  filed: "Filed",
};
