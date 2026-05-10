export type SetupSitePayload = Record<string, unknown>;

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.message === "string" ? data.message : "Aktion konnte nicht ausgeführt werden.");
  }
  return data;
}

export async function getSite(siteId: string) {
  const response = await fetch(`/api/widget/sites/${encodeURIComponent(siteId)}`, { cache: "no-store" });
  return readJson(response);
}

export async function updateSiteSettings(siteId: string, payload: SetupSitePayload) {
  const response = await fetch(`/api/widget/config/${encodeURIComponent(siteId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readJson(response);
}

export async function updateSiteBranding(siteId: string, payload: SetupSitePayload) {
  const response = await fetch(`/api/widget/branding/${encodeURIComponent(siteId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readJson(response);
}

export async function updateSiteBasics(
  siteId: string,
  payload: { name: string; allowedDomains: string[] },
) {
  const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readJson(response);
}

export async function getKnowledgeSources(siteId: string) {
  const response = await fetch(`/api/ingest/sources?siteId=${encodeURIComponent(siteId)}`, { cache: "no-store" });
  return readJson(response);
}

export async function createManualKnowledgeSource(
  siteId: string,
  payload: { title: string; question?: string; content: string; tags?: string[] },
) {
  const response = await fetch("/api/ingest/manual", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ siteId, ...payload }),
  });
  return readJson(response);
}

export async function importUrlKnowledgeSource(siteId: string, payload: { url: string; title?: string }) {
  const response = await fetch("/api/ingest/url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ siteId, ...payload }),
  });
  return readJson(response);
}

export async function uploadKnowledgePdf(siteId: string, file: File) {
  const formData = new FormData();
  formData.append("siteId", siteId);
  formData.append("file", file);

  const response = await fetch("/api/ingest/pdf", {
    method: "POST",
    body: formData,
  });
  return readJson(response);
}

export async function setKnowledgeSourceActive(sourceId: string, isActive: boolean) {
  const response = await fetch(`/api/ingest/sources/${encodeURIComponent(sourceId)}/active`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isActive }),
  });
  return readJson(response);
}

export async function resyncKnowledgeSource(sourceId: string) {
  const response = await fetch(`/api/ingest/sources/${encodeURIComponent(sourceId)}/resync`, {
    method: "POST",
  });
  return readJson(response);
}

export async function deleteKnowledgeSource(sourceId: string) {
  const response = await fetch(`/api/ingest/sources/${encodeURIComponent(sourceId)}`, {
    method: "DELETE",
  });
  return readJson(response);
}

export async function setSiteGoLive(siteId: string) {
  const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/go-live`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return readJson(response);
}
