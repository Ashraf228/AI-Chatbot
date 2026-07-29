import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { KnowledgeSourceCard } from "../components/customer/setup-wizard/KnowledgeSourceCard";

describe("KnowledgeSourceCard", () => {
  test("shows imported website sources as extracted but not answer-ready", () => {
    const source = {
      id: "source-1",
      type: "url",
      title: "FAQ",
      label: "FAQ",
      url: "https://example.com/faq",
      sourceUrl: "https://example.com/faq",
      normalizedSourceUrl: "https://example.com/faq",
      sourceDomain: "example.com",
      status: "processing",
      syncStatus: "processing",
      ingestStatus: "extracted",
      indexStatus: "not_requested",
      runtimeReadiness: "not_ready",
      isActive: true,
      lastSyncedAt: "2026-07-29T10:00:00.000Z",
      errorMessage: "",
      createdAt: "2026-07-29T09:30:00.000Z",
    };

    render(
      <KnowledgeSourceCard
        source={source}
        savingKey={null}
        onToggle={vi.fn()}
        onRefresh={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getAllByText("Importiert, noch nicht antwortbereit")).toHaveLength(2);
    expect(screen.getByText(/extracted · Index not_requested · Runtime not_ready/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Inhalt extrahiert, aber noch nicht fuer Antworten freigegeben/i),
    ).toBeInTheDocument();
  });
});
