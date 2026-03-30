import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createInvestment } from "@/lib/budget";

type ParsedHolding = {
  name: string;
  ticker: string;
  exchange: string;
  currency: string;
  units: number;
  cost_basis: number;
  current_value: number;
  dividends: number;
  isFif: boolean;
  portfolio: string;
};

function parseSharesiesHoldingsCsv(csvText: string): ParsedHolding[] {
  const lines = csvText.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Parse header to find column indices
  const header = parseCSVLine(lines[0]);
  const col = (name: string) => header.findIndex((h) => h.trim() === name);

  const iName = col("Investment name");
  const iTicker = col("Investment ticker symbol");
  const iExchange = col("Exchange");
  const iCurrency = col("Currency");
  const iEndValue = col("Ending investment dollar value");
  const iEndShares = col("Ending shareholding");
  const iPurchased = col(
    "Dollar value of shares purchased (including the value of transferred shares)"
  );
  const iDividends = col("Dividends and distributions");
  const iFif = col("Is FIF");
  const iPortfolio = col("Portfolio");

  if (iName === -1 || iEndValue === -1) {
    throw new Error(
      "CSV does not match Sharesies Investment Holdings Report format"
    );
  }

  const results: ParsedHolding[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 2) continue;

    const endValue = parseFloat(fields[iEndValue] || "0");
    const endShares = parseFloat(fields[iEndShares] || "0");

    // Skip rows with no ending value and no ending shares (fully sold)
    if (endValue === 0 && endShares === 0) continue;

    results.push({
      name: (fields[iName] || "").trim(),
      ticker: iTicker !== -1 ? (fields[iTicker] || "").trim() : "",
      exchange: iExchange !== -1 ? (fields[iExchange] || "").trim() : "",
      currency: iCurrency !== -1 ? (fields[iCurrency] || "").trim() : "NZD",
      units: endShares,
      cost_basis: iPurchased !== -1 ? parseFloat(fields[iPurchased] || "0") : 0,
      current_value: endValue,
      dividends:
        iDividends !== -1 ? parseFloat(fields[iDividends] || "0") : 0,
      isFif: iFif !== -1 ? fields[iFif]?.trim() === "TRUE" : false,
      portfolio: iPortfolio !== -1 ? (fields[iPortfolio] || "").trim() : "",
    });
  }

  return results;
}

/** Parse a single CSV line handling quoted fields with commas */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

function mapCurrency(sharesiesCurrency: string): "NZD" | "AUD" | "USD" {
  const upper = sharesiesCurrency.toUpperCase();
  if (upper === "AUD") return "AUD";
  if (upper === "USD") return "USD";
  return "NZD";
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  if (body.preview) {
    // Preview mode — parse and return what would be imported
    try {
      const holdings = parseSharesiesHoldingsCsv(body.csv);
      return NextResponse.json({ holdings });
    } catch (e) {
      return NextResponse.json(
        { error: (e as Error).message },
        { status: 400 }
      );
    }
  }

  // Import mode — create investments
  try {
    const holdings = parseSharesiesHoldingsCsv(body.csv);
    const created = [];

    for (const h of holdings) {
      const displayName = h.ticker
        ? `${h.name} (${h.ticker})`
        : h.name;
      const currency = mapCurrency(h.currency);

      const investment = createInvestment(session.user.id, {
        name: displayName,
        type: "shares",
        platform: "Sharesies",
        units: h.units || null,
        cost_basis: h.cost_basis,
        current_value: h.current_value,
        currency,
        nzd_rate: 1, // Sharesies values are already in the stated currency
        notes: [
          h.exchange ? `Exchange: ${h.exchange}` : "",
          h.portfolio ? `Portfolio: ${h.portfolio}` : "",
          h.dividends ? `Dividends: $${h.dividends.toFixed(2)}` : "",
          h.isFif ? "FIF: Yes" : "",
        ]
          .filter(Boolean)
          .join(", ") || null,
      });
      created.push(investment);
    }

    return NextResponse.json(
      { imported: created.length, investments: created },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 400 }
    );
  }
}
