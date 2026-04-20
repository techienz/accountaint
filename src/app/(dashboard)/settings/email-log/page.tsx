import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listEmailLog } from "@/lib/email-log";
import { EmailLogClient } from "./email-log-client";

export default async function EmailLogPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const business = session.activeBusiness;
  if (!business) redirect("/");

  const entries = listEmailLog(business.id, { limit: 200 });

  return (
    <div className="mx-auto max-w-5xl">
      <EmailLogClient initialEntries={entries.map((e) => ({
        ...e,
        sent_at: e.sent_at.toISOString(),
      }))} />
    </div>
  );
}
