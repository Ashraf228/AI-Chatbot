import { NextResponse } from "next/server";
import { assertSiteAccess, fetchDashboardBackend } from "../../../../../../../lib/dashboard-api";
import { requireSession } from "../../../../../../../lib/require-auth";

const MAX_PDF_UPLOAD_BYTES = 5 * 1024 * 1024;

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function sanitizeDisplayFileName(fileName: string) {
  return fileName
    .replace(/[\\/\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function isPdfFile(file: File) {
  if (!/\.pdf$/i.test(file.name)) {
    return false;
  }

  return !file.type || file.type === "application/pdf";
}

function isFileLike(value: unknown): value is File {
  return Boolean(
    value &&
      typeof value === "object" &&
      "name" in value &&
      typeof (value as { name?: unknown }).name === "string" &&
      "size" in value &&
      typeof (value as { size?: unknown }).size === "number" &&
      "arrayBuffer" in value &&
      typeof (value as { arrayBuffer?: unknown }).arrayBuffer === "function",
  );
}

export async function POST(
  req: Request,
  context: { params: Promise<{ siteId: string }> },
) {
  const auth = await requireSession();
  if (auth.response) return auth.response;

  if (!["admin", "operator"].includes(auth.session.role)) {
    return noStoreJson({ message: "Forbidden" }, 403);
  }

  const { siteId } = await context.params;
  try {
    await assertSiteAccess(auth.session, siteId);
  } catch {
    return noStoreJson({ message: "Forbidden" }, 403);
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!isFileLike(file)) {
    return noStoreJson({ message: "file missing" }, 400);
  }

  if (!isPdfFile(file)) {
    return noStoreJson({ message: "unsupported file type" }, 400);
  }

  if (file.size > MAX_PDF_UPLOAD_BYTES) {
    return noStoreJson({ message: "PDF too large" }, 413);
  }

  try {
    const proxyFormData = new FormData();
    proxyFormData.append("file", file, sanitizeDisplayFileName(file.name) || "demo-upload.pdf");

    const response = await fetchDashboardBackend(
      `/admin/sites/${encodeURIComponent(siteId)}/conversation-engine/knowledge/pdf-extract`,
      {
        method: "POST",
        cache: "no-store",
        session: auth.session,
        body: proxyFormData,
      },
    );

    const text = await response.text();
    return new NextResponse(text || "{}", {
      status: response.status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
      },
    });
  } catch {
    return noStoreJson({ message: "PDF could not be parsed" }, 400);
  }
}
