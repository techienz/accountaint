import { permanentRedirect } from "next/navigation";

/** /contracts/new → /subscriptions/new (308 redirect; audit #121 Option B). */
export default function ContractsNewRedirect() {
  permanentRedirect("/subscriptions/new");
}
