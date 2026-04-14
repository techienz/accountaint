import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listBusinesses } from "@/lib/business";
import { hasXeroConnection } from "@/lib/xero/status";
import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { NotificationBell } from "@/components/notification-bell";
import { ChatPanel } from "@/components/chat-panel";
import { ClientProviders } from "@/components/client-providers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const businesses = listBusinesses(session.user.id);
  const needsFirstBusiness = businesses.length === 0;

  const today = new Date().toLocaleDateString("en-NZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const sidebarProps = {
    userName: session.user.name,
    businesses: businesses.map((b: { id: string; name: string }) => ({ id: b.id, name: b.name })),
    activeBusinessId: session.activeBusiness?.id || null,
    hasEmployees: session.activeBusiness?.has_employees ?? false,
    xeroConnected: session.activeBusiness ? hasXeroConnection(session.activeBusiness.id) : false,
  };

  return (
    <ClientProviders>
      <div className="flex h-screen">
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <Sidebar {...sidebarProps} />
        </div>
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-[52px] items-center justify-between border-b border-border/40 bg-background/60 backdrop-blur-md px-4 md:px-7">
            <div className="flex items-center gap-3">
              {/* Mobile hamburger */}
              <MobileNav {...sidebarProps} />
              <h2 className="text-sm font-medium text-foreground/80">
                {session.activeBusiness?.name || "Accountaint"}
              </h2>
              <span className="text-xs text-muted-foreground/50 hidden sm:inline">
                {today}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <ChatPanel businessId={session.activeBusiness?.id || null} />
              <NotificationBell businessId={session.activeBusiness?.id || null} />
            </div>
          </header>
          <main className="flex-1 overflow-y-auto px-4 py-4 md:px-7 md:py-6">
            {needsFirstBusiness ? (
              <div className="mx-auto max-w-md">
                <p className="mb-4 text-muted-foreground">
                  Add your first business to get started.
                </p>
                <meta httpEquiv="refresh" content="0;url=/onboarding" />
              </div>
            ) : (
              children
            )}
          </main>
        </div>
      </div>
    </ClientProviders>
  );
}
