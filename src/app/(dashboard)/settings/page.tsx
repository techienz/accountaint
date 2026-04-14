import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getBusiness } from "@/lib/business";
import Link from "next/link";
import { BusinessForm } from "@/components/business-form";
import { ChangePasswordForm } from "./change-password-form";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const isNew = params.new === "true";

  // If creating new business, show empty form
  if (isNew) {
    return (
      <div className="mx-auto max-w-2xl">
        <BusinessForm />
      </div>
    );
  }

  // Otherwise edit active business
  if (!session.activeBusiness) {
    redirect("/settings?new=true");
  }

  const business = getBusiness(session.user.id, session.activeBusiness.id);
  if (!business) redirect("/settings?new=true");

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <BusinessForm business={business} />

      <div className="border-t pt-8">
        <h2 className="text-lg font-semibold mb-1">Tax Rules & Knowledge</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Verify tax rules against current IRD sources and manage IRD knowledge base.
        </p>
        <Link
          href="/settings/regulatory-updates"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
        >
          Manage Regulatory Updates &rarr;
        </Link>
      </div>

      <div className="border-t pt-8">
        <h2 className="text-lg font-semibold mb-1">Account Security</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Change your 4-digit PIN.
        </p>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
