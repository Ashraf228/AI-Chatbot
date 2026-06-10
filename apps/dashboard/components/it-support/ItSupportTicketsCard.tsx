"use client";

import { useCallback, useEffect, useState } from "react";
import { encodeSiteId } from "../../lib/site-id";
import { EmptyStateCard } from "../shared/EmptyStateCard";
import { ErrorState } from "../shared/ErrorState";
import { LoadingState } from "../shared/LoadingState";

type ForwardingStatus = "queued" | "not_configured" | "failed" | "unknown";

type ItSupportTicketListItem = {
  id: string;
  subject: string;
  status?: string;
  priority?: string;
  issueType?: string;
  affectedSystem?: string;
  impact?: string;
  urgency?: string;
  reporterEmail?: string;
  reporterName?: string;
  reporterPhone?: string;
  device?: string;
  operatingSystem?: string;
  forwardingStatus?: ForwardingStatus;
  conversationId?: string;
  createdAt: string | null;
};

type ItSupportTicketDetail = ItSupportTicketListItem & {
  description?: string | null;
  category?: string;
  affectedUsers?: string;
  reporter?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    department?: string | null;
    location?: string | null;
  };
  technicalContext?: {
    device?: string | null;
    operatingSystem?: string | null;
    errorMessage?: string | null;
    alreadyTried?: string | null;
  };
  source?: string;
};

type TicketListResponse = {
  items: ItSupportTicketListItem[];
  total: number;
  limit: number;
  offset: number;
};

const FORWARDING_LABELS: Record<ForwardingStatus, string> = {
  queued: "Zur Weiterleitung eingereiht",
  not_configured: "Keine Weiterleitung eingerichtet",
  failed: "Weiterleitung fehlgeschlagen",
  unknown: "Unbekannt",
};

function statusClass(status: ForwardingStatus | undefined) {
  if (status === "queued") return "dashboard-status dashboard-status--success";
  if (status === "failed") return "dashboard-status dashboard-status--error";
  if (status === "not_configured") return "dashboard-status dashboard-status--warning";
  return "dashboard-status";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "unbekannt";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("de-DE");
}

function shortText(value: string | null | undefined, fallback = "nicht angegeben") {
  if (!value) return fallback;
  return value.length > 130 ? `${value.slice(0, 130)}...` : value;
}

function forwardingLabel(value: ForwardingStatus | undefined) {
  return FORWARDING_LABELS[value || "unknown"];
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="compact-list__row">
      <span>{label}</span>
      <strong>{value || "nicht angegeben"}</strong>
    </div>
  );
}

export function ItSupportTicketsCard({ siteId }: { siteId: string }) {
  const [tickets, setTickets] = useState<ItSupportTicketListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("");
  const [issueType, setIssueType] = useState("");
  const [status, setStatus] = useState("");
  const [forwardingStatus, setForwardingStatus] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [detail, setDetail] = useState<ItSupportTicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ limit: "10", offset: "0" });
    if (search.trim()) params.set("search", search.trim());
    if (priority) params.set("priority", priority);
    if (issueType.trim()) params.set("issueType", issueType.trim());
    if (status.trim()) params.set("status", status.trim());
    if (forwardingStatus) params.set("forwardingStatus", forwardingStatus);

    const response = await fetch(
      `/api/sites/${encodeURIComponent(siteId)}/it-support/tickets?${params.toString()}`,
      { cache: "no-store" },
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data?.message || "IT-Support-Tickets konnten nicht geladen werden.");
      setLoading(false);
      return;
    }
    const list = data as TicketListResponse;
    setTickets(Array.isArray(list.items) ? list.items : []);
    setTotal(Number(list.total || 0));
    setLoading(false);
  }, [forwardingStatus, issueType, priority, search, siteId, status]);

  useEffect(() => {
    void loadTickets();
  }, [siteId]);

  async function openDetail(ticketId: string) {
    setSelectedTicketId(ticketId);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    const response = await fetch(
      `/api/sites/${encodeURIComponent(siteId)}/it-support/tickets/${encodeURIComponent(ticketId)}`,
      { cache: "no-store" },
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setDetailError(data?.message || "Ticket-Details konnten nicht geladen werden.");
      setDetailLoading(false);
      return;
    }
    setDetail(data as ItSupportTicketDetail);
    setDetailLoading(false);
  }

  return (
    <section className="dashboard-card dashboard-card--compact dashboard-stack">
      <div className="dashboard-section-heading">
        <div>
          <p className="dashboard-eyebrow">IT-Support</p>
          <h2 className="dashboard-card-title">IT-Support-Tickets</h2>
          <p className="dashboard-copy dashboard-copy--muted">
            Vom IT-Support-Agenten erstellte Supportfälle. Die Übersicht ist read-only.
          </p>
        </div>
        <span className="dashboard-status">{total} Tickets</span>
      </div>

      <form
        className="dashboard-grid dashboard-grid--four dashboard-gap-12"
        onSubmit={(event) => {
          event.preventDefault();
          void loadTickets();
        }}
      >
        <label className="dashboard-field">
          Suche
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Betreff, System oder Reporter"
          />
        </label>
        <label className="dashboard-field">
          Priorität
          <select value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="">Alle</option>
            <option value="low">Niedrig</option>
            <option value="normal">Normal</option>
            <option value="high">Hoch</option>
            <option value="urgent">Dringend</option>
            <option value="critical">Kritisch</option>
          </select>
        </label>
        <label className="dashboard-field">
          Issue Type
          <input
            value={issueType}
            onChange={(event) => setIssueType(event.target.value)}
            placeholder="vpn, mfa, printer ..."
          />
        </label>
        <label className="dashboard-field">
          Weiterleitung
          <select value={forwardingStatus} onChange={(event) => setForwardingStatus(event.target.value)}>
            <option value="">Alle</option>
            <option value="queued">Eingereiht</option>
            <option value="not_configured">Nicht eingerichtet</option>
            <option value="failed">Fehlgeschlagen</option>
            <option value="unknown">Unbekannt</option>
          </select>
        </label>
        <label className="dashboard-field">
          Status
          <input
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            placeholder="new, open ..."
          />
        </label>
        <div className="dashboard-actions">
          <button type="submit" className="dashboard-button dashboard-button--secondary">
            Filter anwenden
          </button>
        </div>
      </form>

      {error ? <ErrorState message={error} /> : null}
      {loading ? <LoadingState /> : null}

      {!loading && !error && tickets.length === 0 ? (
        <EmptyStateCard title="Noch keine IT-Support-Tickets vorhanden." />
      ) : null}

      {!loading && !error && tickets.length > 0 ? (
        <div className="compact-list">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="compact-list__row">
              <span>
                <strong>{ticket.subject}</strong>
                <small>
                  {shortText(ticket.affectedSystem, "System nicht angegeben")} · {formatDate(ticket.createdAt)}
                </small>
                <small>
                  Reporter: {shortText(ticket.reporterName || ticket.reporterEmail || ticket.reporterPhone)}
                </small>
              </span>
              <span className={statusClass(ticket.forwardingStatus)}>
                {forwardingLabel(ticket.forwardingStatus)}
              </span>
              <button
                type="button"
                className="dashboard-button dashboard-button--ghost"
                onClick={() => void openDetail(ticket.id)}
              >
                Details
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {selectedTicketId ? (
        <section className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
          <div className="dashboard-section-heading">
            <div>
              <h3 className="dashboard-card-title dashboard-card-title--sm">Ticket-Details</h3>
              <p className="dashboard-copy dashboard-copy--muted">Referenz: {selectedTicketId}</p>
            </div>
            <button
              type="button"
              className="dashboard-button dashboard-button--ghost"
              onClick={() => {
                setSelectedTicketId("");
                setDetail(null);
                setDetailError("");
              }}
            >
              Schließen
            </button>
          </div>

          {detailLoading ? <LoadingState /> : null}
          {detailError ? <ErrorState message={detailError} /> : null}

          {detail && !detailLoading ? (
            <>
              <p className="dashboard-copy">{shortText(detail.description, "Keine Beschreibung hinterlegt.")}</p>
              <div className="dashboard-grid dashboard-grid--three dashboard-gap-12">
                <div className="compact-list">
                  <DetailRow label="Betreff" value={detail.subject} />
                  <DetailRow label="Status" value={detail.status} />
                  <DetailRow label="Priorität" value={detail.priority} />
                  <DetailRow label="Issue Type" value={detail.issueType} />
                  <DetailRow label="Impact" value={detail.impact} />
                </div>
                <div className="compact-list">
                  <DetailRow label="Reporter" value={detail.reporter?.name} />
                  <DetailRow label="E-Mail" value={detail.reporter?.email} />
                  <DetailRow label="Telefon" value={detail.reporter?.phone} />
                  <DetailRow label="Abteilung" value={detail.reporter?.department} />
                  <DetailRow label="Standort" value={detail.reporter?.location} />
                </div>
                <div className="compact-list">
                  <DetailRow label="System" value={detail.affectedSystem} />
                  <DetailRow label="Gerät" value={detail.technicalContext?.device} />
                  <DetailRow label="Betriebssystem" value={detail.technicalContext?.operatingSystem} />
                  <DetailRow label="Fehlermeldung" value={detail.technicalContext?.errorMessage} />
                  <DetailRow label="Bereits versucht" value={detail.technicalContext?.alreadyTried} />
                </div>
              </div>
              <div className="dashboard-actions">
                <span className={statusClass(detail.forwardingStatus)}>
                  {forwardingLabel(detail.forwardingStatus)}
                </span>
                {detail.conversationId ? (
                  <a
                    className="dashboard-button dashboard-button--secondary"
                    href={`/sites/${encodeSiteId(siteId)}/conversations`}
                  >
                    Gespräch öffnen
                  </a>
                ) : null}
              </div>
            </>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
