const NZBN_API_BASE = "https://api.business.govt.nz/gateway/nzbn/v5";

function getApiKey(): string | null {
  return (process.env.NZBN_API_KEY || "").trim() || null;
}

export function isNzbnConfigured(): boolean {
  return !!getApiKey();
}

export type NzbnSearchResult = {
  nzbn: string;
  name: string;
  status: string;
  companyNumber: string | null;
};

export type NzbnCompanyDetail = {
  nzbn: string;
  name: string;
  status: string;
  companyNumber: string | null;
  incorporationDate: string | null;
  registeredAddress: string | null;
  directors: Array<{ name: string; appointmentDate: string }>;
  shareholders: Array<{ name: string; shares: number; shareClass: string }>;
};

export async function searchCompanies(query: string): Promise<NzbnSearchResult[]> {
  const apiKey = getApiKey();
  if (!apiKey || !query.trim()) return [];

  const url = `${NZBN_API_BASE}/entities?search-term=${encodeURIComponent(query)}&entity-type=LTD&page-size=10`;

  const res = await fetch(url, {
    headers: {
      "Ocp-Apim-Subscription-Key": apiKey,
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    console.error(`[nzbn] Search failed: ${res.status}`);
    return [];
  }

  const data = await res.json();
  const items = data?.items || [];

  return items.map((item: Record<string, unknown>) => ({
    nzbn: (item.nzbn as string) || "",
    name: (item.entityName as string) || "",
    status: (item.entityStatusDescription as string) || "",
    companyNumber: (item.sourceRegisterUniqueIdentifier as string) || null,
  }));
}

export async function getCompanyDetail(nzbn: string): Promise<NzbnCompanyDetail | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const url = `${NZBN_API_BASE}/entities/${nzbn}`;

  const res = await fetch(url, {
    headers: {
      "Ocp-Apim-Subscription-Key": apiKey,
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    console.error(`[nzbn] Company lookup failed: ${res.status}`);
    return null;
  }

  const data = await res.json();

  // Parse registered address
  const addresses = (data.addresses || []) as Array<Record<string, unknown>>;
  const registered = addresses.find((a) => (a.addressType as string)?.toLowerCase().includes("registered"));
  const registeredAddress = registered
    ? [registered.address1, registered.address2, registered.address3, registered.postCode]
        .filter(Boolean)
        .join(", ")
    : null;

  // Parse incorporation date
  const incorporationDate = data.registrationDate
    ? new Date(data.registrationDate as string).toISOString().slice(0, 10)
    : null;

  // Parse directors
  const roles = (data.roles || []) as Array<Record<string, unknown>>;
  const directors = roles
    .filter((r) => (r.roleType as string)?.toLowerCase() === "director" && (r.roleStatus as string)?.toLowerCase() === "active")
    .map((r) => ({
      name: (r.roleName as string) || "",
      appointmentDate: r.startDate ? new Date(r.startDate as string).toISOString().slice(0, 10) : "",
    }));

  // Parse shareholders
  const shareholdings = (data.shareholdings || []) as Array<Record<string, unknown>>;
  const shareholders: NzbnCompanyDetail["shareholders"] = [];
  for (const sh of shareholdings) {
    const allocations = (sh.shareAllocation || []) as Array<Record<string, unknown>>;
    for (const alloc of allocations) {
      shareholders.push({
        name: (alloc.shareholderName as string) || "",
        shares: Number(alloc.numberOfShares) || 0,
        shareClass: (sh.shareClass as string) || "Ordinary",
      });
    }
  }

  return {
    nzbn: data.nzbn || nzbn,
    name: (data.entityName as string) || "",
    status: (data.entityStatusDescription as string) || "",
    companyNumber: (data.sourceRegisterUniqueIdentifier as string) || null,
    incorporationDate,
    registeredAddress,
    directors,
    shareholders,
  };
}
