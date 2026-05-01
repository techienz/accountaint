/**
 * Pure resolver used by the AI invoice tool. Lives outside from-timesheets.ts
 * so it can be unit-tested without standing up a database. The AI sometimes
 * invents work_contract_ids (e.g. "contract_digital_uplift_2"); this resolver
 * treats that as a recoverable error rather than throwing, so the tool can
 * return a helpful list of real contracts and let the AI re-call.
 */

export type ContractCandidate = {
  id: string;
  client_name: string;
  status: string;
};

export type ResolveResult<T extends ContractCandidate> =
  | { ok: true; contract: T }
  | { ok: false; reason: "not_found"; tried: { id?: string; name?: string } }
  | { ok: false; reason: "ambiguous"; matches: T[] };

/**
 * Resolve a contract by exact id first, then by case-insensitive substring
 * match on client_name (only against active / expiring_soon contracts).
 * Returns ambiguous when more than one active contract matches the hint.
 */
export function resolveContractForInvoice<T extends ContractCandidate>(
  rawContractId: string | undefined,
  clientNameHint: string | undefined,
  allContracts: T[],
): ResolveResult<T> {
  const activeOnly = allContracts.filter(
    (c) => c.status === "active" || c.status === "expiring_soon",
  );

  if (rawContractId) {
    const exact = allContracts.find((c) => c.id === rawContractId);
    if (exact) return { ok: true, contract: exact };
  }

  const hint = clientNameHint?.trim();
  if (hint) {
    const needle = hint.toLowerCase();
    const matches = activeOnly.filter((c) =>
      c.client_name.toLowerCase().includes(needle),
    );
    if (matches.length === 1) return { ok: true, contract: matches[0] };
    if (matches.length > 1) return { ok: false, reason: "ambiguous", matches };
  }

  return {
    ok: false,
    reason: "not_found",
    tried: { id: rawContractId, name: clientNameHint },
  };
}
