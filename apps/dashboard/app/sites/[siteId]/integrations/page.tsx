import { redirect } from "next/navigation";

export default async function SiteIntegrationsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId: rawSiteId } = await params;
  redirect(`/sites/${rawSiteId}/advanced?section=connections`);
}
