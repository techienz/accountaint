"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  CalendarClock,
  Settings,
  Link2,
  LogOut,
  FileText,
  ChevronDown,
  ChevronRight,
  Bell,
  DollarSign,
  Scale,
  Receipt,
  Calculator,
  TrendingUp,
  Clock,
  Landmark,
  FileBarChart,
  ShieldCheck,
  Users,
  FileSpreadsheet,
  PiggyBank,
  Package,
  Home,
  Car,
  Gift,
  Shield,
  ScrollText,
  BarChart3,
  CreditCard,
  FolderOpen,
  Briefcase,
  Timer,
  Contact2,
  Wallet,
  Plane,
  ArrowLeftRight,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BusinessSwitcher } from "./business-switcher";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  collapsibleKey?: string;
  children?: { href: string; label: string; icon: React.ElementType; requiresEmployees?: boolean }[];
};

function buildNavItems(hasEmployees: boolean): NavItem[] {
  return [
    { href: "/", label: "Overview", icon: LayoutDashboard },
    { href: "/snapshot", label: "Business Snapshot", icon: BarChart3 },
    {
      href: "/deadlines",
      label: "Deadlines & Tax",
      icon: CalendarClock,
      collapsibleKey: "tax",
      children: [
        { href: "/deadlines", label: "Deadlines", icon: CalendarClock },
        { href: "/tax-prep", label: "Tax Prep", icon: FileSpreadsheet },
        { href: "/tax-savings", label: "Tax Savings", icon: PiggyBank },
        { href: "/shareholders", label: "Shareholders", icon: Users },
      ],
    },
    {
      href: "/reports",
      label: "Reports",
      icon: FileText,
      collapsibleKey: "reports",
      children: [
        { href: "/reports/profit-loss", label: "Profit & Loss", icon: DollarSign },
        { href: "/reports/balance-sheet", label: "Balance Sheet", icon: Scale },
        { href: "/reports/gst-history", label: "GST History", icon: Receipt },
        { href: "/reports/tax-position", label: "Tax Position", icon: Calculator },
        { href: "/reports/cash-flow", label: "Cash Flow", icon: TrendingUp },
        { href: "/reports/aging", label: "AP/AR Aging", icon: Clock },
        { href: "/reports/bank-summary", label: "Bank Summary", icon: Landmark },
        { href: "/reports/end-of-year", label: "End of Year", icon: FileBarChart },
      ],
    },
    {
      href: "/work-contracts",
      label: "Earn",
      icon: TrendingUp,
      collapsibleKey: "earn",
      children: [
        { href: "/work-contracts", label: "Work Contracts", icon: Briefcase },
        { href: "/timesheets", label: "Timesheets", icon: Timer },
        { href: "/invoices", label: "Invoices", icon: Receipt },
      ],
    },
    {
      href: "/expenses",
      label: "Spend",
      icon: CreditCard,
      collapsibleKey: "spend",
      children: [
        { href: "/contracts", label: "Contracts", icon: ScrollText },
        { href: "/expenses", label: "Expenses", icon: CreditCard },
        { href: "/assets", label: "Assets", icon: Package },
      ],
    },
    { href: "/contacts", label: "Contacts", icon: Contact2 },
    { href: "/documents", label: "Documents", icon: FolderOpen },
    {
      href: "/budget",
      label: "Personal",
      icon: Wallet,
      collapsibleKey: "personal",
      children: [
        { href: "/budget", label: "Budget Overview", icon: LayoutDashboard },
        { href: "/budget/recurring", label: "Bills & Income", icon: Receipt },
        { href: "/budget/accounts", label: "Bank Accounts", icon: Landmark },
        { href: "/budget/investments", label: "Investments", icon: TrendingUp },
        { href: "/budget/transactions", label: "Transactions", icon: ArrowLeftRight },
        { href: "/budget/debts", label: "Debts", icon: CreditCard },
        { href: "/budget/savings", label: "Savings", icon: PiggyBank },
        { href: "/budget/holidays", label: "Holidays", icon: Plane },
        { href: "/budget/import", label: "Import", icon: FileSpreadsheet },
      ],
    },
    {
      href: "/calculators",
      label: "Calculators",
      icon: Calculator,
      collapsibleKey: "calculators",
      children: [
        { href: "/calculators/home-office", label: "Home Office", icon: Home },
        { href: "/calculators/vehicle", label: "Motor Vehicle", icon: Car },
        ...(hasEmployees
          ? [{ href: "/calculators/fbt", label: "FBT", icon: Gift }]
          : []),
        { href: "/calculators/acc", label: "ACC Levies", icon: Shield },
      ],
    },
    {
      href: "/crosscheck",
      label: "Monitor",
      icon: ShieldCheck,
      collapsibleKey: "monitor",
      children: [
        { href: "/crosscheck", label: "Cross-check", icon: ShieldCheck },
        { href: "/notifications", label: "Notifications", icon: Bell },
      ],
    },
    {
      href: "/settings",
      label: "Settings",
      icon: Settings,
      collapsibleKey: "settings",
      children: [
        { href: "/settings/xero", label: "Xero", icon: Link2 },
        { href: "/settings/notifications", label: "Notifications", icon: Bell },
        { href: "/settings", label: "General", icon: Settings },
      ],
    },
  ];
}

type SidebarProps = {
  userName: string;
  businesses: { id: string; name: string }[];
  activeBusinessId: string | null;
  hasEmployees?: boolean;
};

export function Sidebar({ userName, businesses, activeBusinessId, hasEmployees = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    tax: pathname.startsWith("/deadlines") || pathname.startsWith("/tax-") || pathname.startsWith("/shareholders"),
    reports: pathname.startsWith("/reports"),
    earn: pathname.startsWith("/work-contracts") || pathname.startsWith("/timesheets") || pathname.startsWith("/invoices"),
    spend: pathname.startsWith("/contracts") || pathname.startsWith("/expenses") || pathname.startsWith("/assets"),
    personal: pathname.startsWith("/budget"),
    calculators: pathname.startsWith("/calculators"),
    monitor: pathname.startsWith("/crosscheck") || pathname.startsWith("/notifications"),
    settings: pathname.startsWith("/settings"),
  });

  const navItems = buildNavItems(hasEmployees);

  function toggleSection(key: string) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-[260px] flex-col bg-sidebar text-sidebar-foreground" data-print-hidden>
      {/* Brand */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary/20 shadow-inner shadow-sidebar-primary/10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-sidebar-primary">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="currentColor" opacity="0.3"/>
              <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h1 className="text-[0.95rem] font-semibold tracking-tight text-sidebar-foreground">Accountaint</h1>
          </div>
        </div>
      </div>

      <div className="px-4 pb-3">
        <BusinessSwitcher
          businesses={businesses}
          activeBusinessId={activeBusinessId}
        />
      </div>

      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          if (item.children && item.collapsibleKey) {
            const sectionKey = item.collapsibleKey;
            const isOpen = openSections[sectionKey] ?? false;
            const isChildActive = item.children.some((c) =>
              pathname.startsWith(c.href)
            );
            return (
              <div key={item.href}>
                <button
                  onClick={() => toggleSection(sectionKey)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-200",
                    isChildActive
                      ? "text-sidebar-foreground font-medium"
                      : "text-sidebar-foreground/45 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground/75"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <item.icon className="h-[18px] w-[18px] opacity-70" />
                    {item.label}
                  </span>
                  {isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 opacity-30" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 opacity-30" />
                  )}
                </button>
                {isOpen && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-sidebar-border/40 pl-3">
                    {item.children.map((child) => {
                      const isActive = pathname === child.href;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[0.8rem] transition-all duration-200",
                            isActive
                              ? "bg-sidebar-primary/15 text-sidebar-primary font-medium"
                              : "text-sidebar-foreground/40 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground/65"
                          )}
                        >
                          <child.icon className="h-3.5 w-3.5" />
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-200",
                isActive
                  ? "bg-sidebar-primary/15 text-sidebar-primary font-medium"
                  : "text-sidebar-foreground/45 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground/75"
              )}
            >
              <item.icon className={cn("h-[18px] w-[18px]", isActive ? "text-sidebar-primary" : "opacity-60")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-sidebar-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sidebar-primary/30 to-sidebar-primary/10 text-xs font-semibold text-sidebar-primary">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm text-sidebar-foreground/55 truncate">
              {userName}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {mounted && (
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2 rounded-lg text-sidebar-foreground/25 hover:text-sidebar-foreground/55 hover:bg-sidebar-accent/50 transition-all duration-200"
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            )}
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-sidebar-foreground/25 hover:text-sidebar-foreground/55 hover:bg-sidebar-accent/50 transition-all duration-200"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
