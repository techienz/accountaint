import { redirect, permanentRedirect } from "next/navigation";

/**
 * /contracts has been renamed to /subscriptions (audit decision #121
 * Option B). The schema and API routes still use `contracts`. This shim
 * preserves bookmarks and any external links via a 301 redirect.
 */
export default function ContractsRedirect() {
  // permanentRedirect emits a 308 (preserves method); use redirect for 307
  // semantics on simple GET. Either is fine here — we use 308/permanent
  // so search engines + browsers cache the new location.
  permanentRedirect("/subscriptions");
  redirect("/subscriptions"); // unreachable, type satisfaction
}
