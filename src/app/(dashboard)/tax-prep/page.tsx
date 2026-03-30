import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prepareIR4 } from "@/lib/tax/ir4-prep";
import { getDb } from "@/lib/db";
import { shareholders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { getNzTaxYear } from "@/lib/tax/rules";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  FileSpreadsheet,
  Receipt,
  Calculator,
  ClipboardList,
} from "lucide-react";

export default async function TaxPrepPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const business = session.activeBusiness;
  if (!business) redirect("/onboarding");

  const taxYear = String(getNzTaxYear(new Date()));
  const ir4 = await prepareIR4(business.id, taxYear);

  const db = getDb();
  const shRows = await db
    .select()
    .from(shareholders)
    .where(eq(shareholders.business_id, business.id));

  const fmt = (n: number) =>
    "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tax Preparation</h1>
        <p className="text-muted-foreground">{taxYear} tax year</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {business.gst_registered && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                <CardTitle className="text-sm font-medium">
                  GST Returns
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Link href="/tax-prep/gst">
                <Button variant="outline" size="sm">
                  Open <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
        {business.provisional_tax_method && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                <CardTitle className="text-sm font-medium">
                  Provisional Tax
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Link href="/tax-prep/provisional">
                <Button variant="outline" size="sm">
                  Open <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              <CardTitle className="text-sm font-medium">
                Filing Checklist
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Link href="/tax-prep/checklist">
              <Button variant="outline" size="sm">
                Open <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            <CardTitle>IR4 — Company Tax Return</CardTitle>
          </div>
          <Link href="/tax-prep/ir4">
            <Button variant="outline" size="sm">
              Open Worksheet <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span>Gross Income</span>
              <span>{fmt(ir4.grossIncome)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Expenses</span>
              <span>{fmt(ir4.totalExpenses)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Estimated Taxable Income</span>
              <span>{fmt(ir4.taxableIncome)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Estimated Tax Payable</span>
              <span>{fmt(ir4.taxPayable)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">
          IR3 — Personal Tax Returns
        </h2>
        {shRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add shareholders to prepare IR3 returns.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {shRows.map((s) => (
              <Card key={s.id}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    {decrypt(s.name)}
                  </CardTitle>
                  <Badge variant="outline">IR3</Badge>
                </CardHeader>
                <CardContent>
                  <Link href={`/tax-prep/ir3/${s.id}`}>
                    <Button variant="outline" size="sm">
                      Open Worksheet <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
