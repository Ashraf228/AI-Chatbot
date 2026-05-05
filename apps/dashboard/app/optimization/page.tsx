import { redirect } from "next/navigation";
import { encodeSiteId } from "../../lib/site-id";

export default async function OptimizationPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string }>;
}) {
  const params = await searchParams;
  const siteId = params.siteId?.trim();

  if (siteId) {
    redirect(`/sites/${encodeSiteId(siteId)}/analytics`);
  }

  redirect("/sites");
}
