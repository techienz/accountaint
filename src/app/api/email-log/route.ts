import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listEmailLog, type EmailLogKind } from "@/lib/email-log";

const VALID_KINDS: EmailLogKind[] = [
  "invoice",
  "timesheet",
  "payslip",
  "notification",
  "other",
];

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const business = session.activeBusiness;
  if (!business) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const sp = request.nextUrl.searchParams;
  const kind = sp.get("kind");
  const relatedEntityType = sp.get("related_entity_type");
  const relatedEntityId = sp.get("related_entity_id");
  const sinceDaysRaw = sp.get("since_days");
  const limitRaw = sp.get("limit");

  const entries = listEmailLog(business.id, {
    kind: kind && VALID_KINDS.includes(kind as EmailLogKind) ? (kind as EmailLogKind) : undefined,
    relatedEntityType: relatedEntityType ?? undefined,
    relatedEntityId: relatedEntityId ?? undefined,
    sinceDays: sinceDaysRaw ? Number(sinceDaysRaw) : undefined,
    limit: limitRaw ? Number(limitRaw) : undefined,
  });

  return NextResponse.json({ entries });
}
