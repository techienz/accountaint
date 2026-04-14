import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { syncAccounts, syncTransactions } from "@/lib/akahu/sync";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const accountResult = await syncAccounts(session.user.id);
    const txResult = await syncTransactions(session.user.id);

    return NextResponse.json({
      success: true,
      accounts: accountResult,
      transactions: txResult,
    });
  } catch (error) {
    console.error("Akahu sync error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Sync failed",
      },
      { status: 500 }
    );
  }
}
