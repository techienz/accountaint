import { permanentRedirect } from "next/navigation";

/** /contracts/:id → /subscriptions/:id (308 redirect; audit #121 Option B). */
export default async function ContractDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  permanentRedirect(`/subscriptions/${id}`);
}
