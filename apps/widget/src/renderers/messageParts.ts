import type { ChatMessage, ChatMessagePart, MessageSource } from "../types/chat";

const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const URL_PATTERN = /(https?:\/\/[^\s<]+[^\s<\).,!?:;"'])/g;

function normalizeUrl(url: string) {
  return url.trim();
}

function pushTextPart(parts: ChatMessagePart[], text: string) {
  if (!text) {
    return;
  }

  parts.push({ kind: "text", text });
}

function parseInlineText(text: string) {
  const parts: ChatMessagePart[] = [];
  let cursor = 0;

  for (const match of text.matchAll(MARKDOWN_LINK_PATTERN)) {
    const start = match.index ?? 0;
    const full = match[0] || "";
    const label = match[1] || "";
    const url = normalizeUrl(match[2] || "");

    pushTextPart(parts, text.slice(cursor, start));
    if (url) {
      parts.push({
        kind: "link",
        text: label || url,
        url,
      });
    } else {
      pushTextPart(parts, full);
    }
    cursor = start + full.length;
  }

  const markdownProcessed = parts.length > 0;
  const remainder = markdownProcessed ? text.slice(cursor) : text;
  const baseParts = markdownProcessed ? parts : [];
  let remainderCursor = 0;

  for (const match of remainder.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    const full = match[0] || "";
    const url = normalizeUrl(full);

    pushTextPart(baseParts, remainder.slice(remainderCursor, start));
    baseParts.push({
      kind: "link",
      text: url,
      url,
    });
    remainderCursor = start + full.length;
  }

  pushTextPart(baseParts, remainder.slice(remainderCursor));
  return baseParts.length > 0 ? baseParts : ([{ kind: "text", text }] satisfies ChatMessagePart[]);
}

function uniqueSourceCards(sources: MessageSource[] | undefined) {
  const seen = new Set<string>();
  const cards: ChatMessagePart[] = [];

  for (const source of sources || []) {
    const title = typeof source.title === "string" ? source.title.trim() : "";
    const url = typeof source.url === "string" ? normalizeUrl(source.url) : "";

    if (!url || seen.has(url)) {
      continue;
    }

    seen.add(url);
    cards.push({
      kind: "source-card",
      title: title || url,
      url,
    });
  }

  return cards;
}

export function buildMessageParts(message: Pick<ChatMessage, "content" | "parts" | "sources">) {
  if (Array.isArray(message.parts) && message.parts.length > 0) {
    return message.parts;
  }

  const content = typeof message.content === "string" ? message.content : "";
  const inlineParts = parseInlineText(content);
  const sourceCards = uniqueSourceCards(message.sources);

  return [...inlineParts, ...sourceCards];
}
