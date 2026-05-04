import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { KnowledgeManager } from "../knowledge-manager";
import { ArrowLeft } from "lucide-react";

export default async function KnowledgePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeBusiness) redirect("/settings?new=true");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/settings"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to settings
      </Link>

      <div>
        <h1 className="text-2xl font-bold">IRD Knowledge Base</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Download and index the official IRD guides (IR320, IR334, IR340, IR341,
          IR365, IR409, etc.) the chat uses to ground its answers. Re-ingest any
          time IRD publishes a new edition.
        </p>
      </div>

      <KnowledgeManager />
    </div>
  );
}
