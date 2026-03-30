import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq, and, desc, gte } from "drizzle-orm";
import { ChangesTimeline } from "@/components/crosscheck/changes-timeline";
import { AnomalyList } from "@/components/crosscheck/anomaly-list";
import { QuestionsList } from "@/components/crosscheck/questions-list";
import { ReviewButton } from "@/components/crosscheck/review-button";
import type { Change } from "@/lib/crosscheck/diff";

export default async function CrosscheckPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeBusiness) redirect("/onboarding");

  const db = getDb();
  const businessId = session.activeBusiness.id;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Get recent change reports
  const reports = db
    .select()
    .from(schema.changeReports)
    .where(
      and(
        eq(schema.changeReports.business_id, businessId),
        gte(schema.changeReports.created_at, thirtyDaysAgo)
      )
    )
    .orderBy(desc(schema.changeReports.created_at))
    .limit(50)
    .all();

  const parsedReports = reports.map((r) => ({
    id: r.id,
    entity_type: r.entity_type,
    change_count: r.change_count,
    created_at: r.created_at,
    changes: JSON.parse(r.changes_json) as Change[],
  }));

  // Get anomalies
  const allAnomalies = db
    .select()
    .from(schema.anomalies)
    .where(
      and(
        eq(schema.anomalies.business_id, businessId),
        gte(schema.anomalies.created_at, thirtyDaysAgo)
      )
    )
    .orderBy(desc(schema.anomalies.created_at))
    .limit(100)
    .all();

  // Questions: anomalies with suggested_question
  const questions = allAnomalies
    .filter((a) => a.suggested_question)
    .map((a) => ({
      id: a.id,
      suggested_question: a.suggested_question!,
      title: a.title,
      severity: a.severity,
      status: a.status,
    }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Accountant Cross-check</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track what changes in your Xero data and prepare questions for your
            accountant.
          </p>
        </div>
        <ReviewButton />
      </div>

      {/* Changes section */}
      <section>
        <h2 className="text-lg font-medium mb-4">Recent Changes</h2>
        <ChangesTimeline reports={parsedReports} />
      </section>

      {/* Anomalies section */}
      <section>
        <h2 className="text-lg font-medium mb-4">Flagged Items</h2>
        <AnomalyList anomalies={allAnomalies} />
      </section>

      {/* Questions section */}
      <section>
        <h2 className="text-lg font-medium mb-4">Questions for Accountant</h2>
        <QuestionsList questions={questions} />
      </section>
    </div>
  );
}
