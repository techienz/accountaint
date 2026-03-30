import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listBusinesses } from "@/lib/business";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const businesses = listBusinesses(session.user.id);
  if (businesses.length > 0) redirect("/");

  return (
    <div className="mx-auto max-w-lg">
      <OnboardingWizard />
    </div>
  );
}
