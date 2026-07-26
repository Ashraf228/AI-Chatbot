import { NextResponse } from "next/server";
import { assertSiteAccess } from "../../../../../../../lib/dashboard-api";
import { requireSession } from "../../../../../../../lib/require-auth";

const MAX_PDF_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 20_000;

type PdfParseResult = {
  text?: string;
};

type PdfParseInstance = {
  getText: () => Promise<PdfParseResult>;
  destroy: () => Promise<void>;
};

type PdfParseClass = new (input: { data: Buffer }) => PdfParseInstance;

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

function normalizeExtractedText(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\u0000/g, "").trim();
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

  const safeFileName = sanitizeDisplayFileName(file.name) || "demo-upload.pdf";
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let parser: PdfParseInstance | null = null;
  try {
    const { PDFParse } = (await import("pdf-parse")) as unknown as { PDFParse: PdfParseClass };
    parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    const normalized = normalizeExtractedText(parsed.text || "");

    if (!normalized) {
      return noStoreJson({ message: "PDF has no extractable text" }, 400);
    }

    const extractedText = normalized.slice(0, MAX_EXTRACTED_CHARS);
    return noStoreJson({
      fileName: safeFileName,
      extractedText,
      extractedChars: extractedText.length,
      originalChars: normalized.length,
      truncated: normalized.length > extractedText.length,
    });
  } catch {
    return noStoreJson({ message: "PDF could not be parsed" }, 400);
  } finally {
    if (parser) {
      await parser.destroy().catch(() => undefined);
    }
  }
}
