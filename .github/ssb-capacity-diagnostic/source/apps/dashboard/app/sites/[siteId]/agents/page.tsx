import { redirect } from "next/navigation";

export default async function SiteAgentsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId: rawSiteId } = await params;
  redirect(`/sites/${rawSiteId}/advanced?section=automations`);
}
