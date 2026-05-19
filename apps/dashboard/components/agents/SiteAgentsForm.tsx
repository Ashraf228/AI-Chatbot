"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../shared/Button";
import { ErrorState } from "../shared/ErrorState";
import { Input } from "../shared/Input";
import { LoadingState } from "../shared/LoadingState";
import { Select } from "../shared/Select";

type AgentTool = {
  key: string;
  label: string;
  description: string;
  category: string;
};

type AgentDefinition = {
  key: string;
  label: string;
  description: string;
  category: string;
  requiredModuleKeys: string[];
  toolKeys: string[];
  tools: AgentTool[];
  isAvailable: boolean;
  missingModules: string[];
};

type AgentExperienceCard = {
  key: string;
  title: string;
  benefit: string;
  whatItDoes: string;
  goodFor: string;
  collectedData: string;
  afterSuccess: string;
  missingHint: string;
  sourceAgent?: AgentDefinition;
  requiredModuleKeys: string[];
  toolLabels: string[];
  setupHref: "modules" | "integrations";
};

type AgentRun = {
  id: string;
  siteId: string;
  tenantId: string | null;
  agentKey: string;
  agentLabel: string;
  triggerSource: string;
  status: string;
  inputSummary: string | null;
  outputSummary: string | null;
  errorMessage: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
};

type ToolInvocation = {
  id: string;
  toolKey: string;
  toolLabel: string;
  status: string;
  inputPayload?: Record<string, unknown>;
  outputPayload?: Record<string, unknown>;
  errorMessage: string | null;
  createdAt?: string;
  completedAt?: string | null;
};

type AgentExecutionResult = {
  run: AgentRun;
  tools: ToolInvocation[];
};

type AgentTicket = {
  id: string;
  siteId: string;
  tenantId: string | null;
  agentRunId: string;
  title: string;
  description: string;
  reporterName: string | null;
  reporterEmail: string | null;
  location: string | null;
  priority: string;
  status: string;
  createdAt: string;
};

type WebhookJob = {
  id: string;
  siteId: string;
  tenantId: string | null;
  agentRunId: string | null;
  providerKey: string;
  connectionKey: string;
  endpointUrl?: string;
  payload?: Record<string, unknown>;
  status: string;
  retryCount: number;
  maxAttempts: number;
  lastError: string | null;
  lastResponseStatus?: number | null;
  lastResponseBody?: string | null;
  createdAt: string;
  completedAt: string | null;
};

type LeadSalesDraft = {
  need: string;
  name: string;
  email: string;
  phone: string;
  note: string;
  preferredChannel: string;
};

type EcommerceDraft = {
  query: string;
  size: string;
  color: string;
  maxPrice: string;
  availableOnly: boolean;
  note: string;
};

type PropertyDraft = {
  title: string;
  description: string;
  reporterName: string;
  reporterEmail: string;
  location: string;
  priority: "low" | "normal" | "high" | "urgent";
  forwardWebhook: boolean;
};

function getInitialLeadSalesDraft(): LeadSalesDraft {
  return {
    need: "",
    name: "",
    email: "",
    phone: "",
    note: "",
    preferredChannel: "email",
  };
}

function getInitialEcommerceDraft(): EcommerceDraft {
  return {
    query: "",
    size: "",
    color: "",
    maxPrice: "",
    availableOnly: false,
    note: "",
  };
}

function getInitialPropertyDraft(): PropertyDraft {
  return {
    title: "",
    description: "",
    reporterName: "",
    reporterEmail: "",
    location: "",
    priority: "normal",
    forwardWebhook: false,
  };
}

function statusTone(status: string) {
  switch (status) {
    case "completed":
      return "dashboard-status dashboard-status--success";
    case "failed":
      return "dashboard-status dashboard-status--error";
    case "processing":
    case "queued":
      return "dashboard-badge";
    case "sent":
      return "dashboard-status dashboard-status--success";
    default:
      return "dashboard-copy dashboard-copy--muted";
  }
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("de-DE");
}

const MODULE_LABELS: Record<string, string> = {
  "lead-sales": "Anfragen sammeln",
  "knowledge-faq": "Wissensbasis",
  "ecommerce-product-advisor": "Produktberatung",
  "property-ticketing": "Tickets",
  integrations: "Verbindungen",
  webhook: "externe Übergabe",
};

function formatModuleLabel(key: string) {
  return MODULE_LABELS[key] || key.replaceAll("-", " ");
}

function formatStatusLabel(status: string) {
  switch (status) {
    case "completed":
    case "sent":
      return "Erfolgreich";
    case "failed":
      return "Fehler";
    case "processing":
      return "In Bearbeitung";
    case "queued":
      return "Wartet";
    case "new":
      return "Neu";
    case "open":
      return "Offen";
    case "in_progress":
      return "In Bearbeitung";
    case "resolved":
      return "Gelöst";
    case "closed":
      return "Geschlossen";
    default:
      return status;
  }
}

function buildMissingRequirementMessage(card: AgentExperienceCard, agent?: AgentDefinition) {
  const missing = agent?.missingModules?.length
    ? agent.missingModules.map(formatModuleLabel)
    : card.requiredModuleKeys.map(formatModuleLabel);

  if (missing.some((item) => item.toLowerCase().includes("wissensbasis"))) {
    return "Für diesen Agenten muss zuerst eine Wissensbasis angelegt werden.";
  }

  if (missing.length === 0) {
    return card.missingHint;
  }

  return `${card.missingHint} Fehlend: ${missing.join(", ")}.`;
}

function buildAgentExperienceCards(agents: AgentDefinition[]): AgentExperienceCard[] {
  const byKey = new Map(agents.map((agent) => [agent.key, agent]));
  const leadAgent = byKey.get("lead-sales-agent");
  const ecommerceAgent = byKey.get("ecommerce-product-advisor");
  const ticketAgent = byKey.get("property-ticket-agent");

  return [
    {
      key: "lead-agent",
      title: "Lead-Erfassung",
      benefit: "Macht aus klaren Anfragen verwertbare Kontakte.",
      whatItDoes: "Erkennt, wenn Besucher Beratung, ein Angebot oder eine Lösung suchen.",
      goodFor: "Sinnvoll, wenn die Website neue Anfragen erzeugen soll.",
      collectedData: "Name, E-Mail oder Telefon, Anliegen und gewünschter Kontaktweg.",
      afterSuccess: "Die Anfrage wird gespeichert und kann im Dashboard weiterbearbeitet werden.",
      missingHint: "Aktiviere zuerst Anfragen sammeln und eine Wissensbasis.",
      sourceAgent: leadAgent,
      requiredModuleKeys: leadAgent?.requiredModuleKeys ?? ["lead-sales", "knowledge-faq"],
      toolLabels: leadAgent?.tools.map((tool) => tool.label) ?? ["Anfrage speichern", "Wissensbasis nutzen"],
      setupHref: "modules",
    },
    {
      key: "schedule-agent",
      title: "Rückruf-/Kontakt-Agent",
      benefit: "Leitet Kontaktwünsche sauber an dein Team weiter.",
      whatItDoes: "Erkennt Rückruf-, Termin- und Kontaktwünsche und fragt fehlende Kontaktdaten ab.",
      goodFor: "Sinnvoll für Beratung, Erstgespräche und Rückrufwünsche.",
      collectedData: "Kontaktart, Name, E-Mail oder Telefon und Thema des Gesprächs.",
      afterSuccess: "Der Kontaktwunsch wird vorgemerkt und kann weitergegeben werden.",
      missingHint: "Aktiviere zuerst die Lead-Erfassung und hinterlege einen Kontaktweg.",
      sourceAgent: leadAgent,
      requiredModuleKeys: leadAgent?.requiredModuleKeys ?? ["lead-sales", "knowledge-faq"],
      toolLabels: ["Kontaktwunsch vorbereiten", "Anfrage speichern"],
      setupHref: "modules",
    },
    {
      key: "ecommerce-agent",
      title: "E-Commerce-Beratung",
      benefit: "Hilft Besuchern bei Produktfragen und Kaufentscheidungen.",
      whatItDoes: "Beantwortet Produktfragen und bereitet passende Empfehlungen vor.",
      goodFor: "Sinnvoll für Shops, Sortimente und wiederkehrende Produktberatung.",
      collectedData: "Produktwunsch, Größe, Farbe, Budget und Verfügbarkeit.",
      afterSuccess: "Der Besucher erhält eine passende Orientierung oder wird zur Anfrage geführt.",
      missingHint: "Aktiviere zuerst Produktberatung und eine Wissensbasis.",
      sourceAgent: ecommerceAgent,
      requiredModuleKeys: ecommerceAgent?.requiredModuleKeys ?? ["ecommerce-product-advisor", "knowledge-faq"],
      toolLabels: ecommerceAgent?.tools.map((tool) => tool.label) ?? ["Produkte prüfen", "Wissensbasis nutzen"],
      setupHref: "modules",
    },
    {
      key: "ticket-agent",
      title: "IT-Support-/Ticket-Agent",
      benefit: "Wandelt Supportfälle in klare Aufgaben um.",
      whatItDoes: "Erkennt Probleme, sammelt die wichtigsten Angaben und bereitet ein Ticket vor.",
      goodFor: "Sinnvoll für Support, Reklamationen, Störungen und interne Servicefälle.",
      collectedData: "Thema, Beschreibung, Priorität, Kontakt und betroffener Bereich.",
      afterSuccess: "Ein Ticket wird erstellt und kann intern weiterverfolgt werden.",
      missingHint: "Aktiviere zuerst Tickets und eine Wissensbasis.",
      sourceAgent: ticketAgent,
      requiredModuleKeys: ticketAgent?.requiredModuleKeys ?? ["property-ticketing", "knowledge-faq"],
      toolLabels: ticketAgent?.tools.map((tool) => tool.label) ?? ["Ticket erstellen", "Wissensbasis nutzen"],
      setupHref: "modules",
    },
    {
      key: "handoff-agent",
      title: "Externe Übergabe",
      benefit: "Gibt wichtige Ereignisse an andere Systeme oder Menschen weiter.",
      whatItDoes: "Übergibt Anfragen, Tickets oder Kontaktwünsche an angebundene Systeme.",
      goodFor: "Sinnvoll, wenn Leads oder Supportfälle automatisch im Team landen sollen.",
      collectedData: "Anliegen, Kontaktdaten, Status und die für die Übergabe nötigen Informationen.",
      afterSuccess: "Die Daten werden an die konfigurierte Verbindung übergeben.",
      missingHint: "Richte zuerst eine passende Verbindung ein.",
      sourceAgent: ticketAgent,
      requiredModuleKeys: ["integrations", "webhook"],
      toolLabels: ["Externe Übergabe starten", "Übergabe vorbereiten"],
      setupHref: "integrations",
    },
  ];
}

function summarizeToolOutput(tool: ToolInvocation) {
  const output = tool.outputPayload || {};

  if (typeof output.resultCount === "number") {
    return `${output.resultCount} Treffer`;
  }

  if (typeof output.leadId === "string") {
    return "Lead gespeichert";
  }

  if (typeof output.contactRequestId === "string") {
    return "Kontaktwunsch vorgemerkt";
  }

  if (typeof output.ticketId === "string") {
    return `Ticket ${output.ticketId}`;
  }

  if (typeof output.webhookJobId === "string") {
    return `Übergabe ${output.webhookJobId}`;
  }

  return "";
}

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function renderToolDetails(tool: ToolInvocation) {
  const output = tool.outputPayload || {};

  if (tool.toolKey === "query_knowledge" && Array.isArray(output.hits) && output.hits.length > 0) {
    return (
      <div className="dashboard-stack dashboard-stack--xs">
        {output.hits.slice(0, 3).map((hit, index) => {
          const row = hit as { title?: string; content?: string; score?: number };
          return (
            <div key={`${tool.id}-hit-${index}`} className="dashboard-copy">
              <strong>{row.title || `Treffer ${index + 1}`}</strong>
              {typeof row.score === "number" ? ` · Score ${(row.score * 100).toFixed(0)}%` : ""}
              {row.content ? <div className="dashboard-copy dashboard-copy--muted">{row.content}</div> : null}
            </div>
          );
        })}
      </div>
    );
  }

  if (tool.toolKey === "search_catalog" && Array.isArray(output.products) && output.products.length > 0) {
    return (
      <div className="dashboard-stack dashboard-stack--xs">
        {output.products.slice(0, 3).map((product, index) => {
          const row = product as { title?: string; priceMin?: string; priceMax?: string; availableForSale?: boolean };
          return (
            <div key={`${tool.id}-product-${index}`} className="dashboard-copy">
              <strong>{row.title || `Produkt ${index + 1}`}</strong>
              {row.priceMin ? (
                <span className="dashboard-copy dashboard-copy--muted">
                  {" "}
                  · {row.priceMin}
                  {row.priceMax && row.priceMax !== row.priceMin ? ` - ${row.priceMax}` : ""} EUR
                </span>
              ) : null}
              <div className="dashboard-copy dashboard-copy--muted">
                {row.availableForSale === false ? "Derzeit nicht verfügbar" : "Verfügbar oder fortsetzbar"}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (tool.toolKey === "capture_lead" && typeof output.leadId === "string") {
    return (
      <div className="dashboard-copy">
        <strong>Lead-ID:</strong> {output.leadId}
      </div>
    );
  }

  if (tool.toolKey === "schedule_contact" && typeof output.contactRequestId === "string") {
    return (
      <div className="dashboard-copy">
        <strong>Kontaktwunsch:</strong> {output.contactRequestId}
      </div>
    );
  }

  if (tool.toolKey === "create_ticket" && typeof output.ticketId === "string") {
    return (
      <div className="dashboard-copy">
        <strong>Ticket:</strong> {output.ticketId}
        {typeof output.priority === "string" ? ` · Priorität ${output.priority}` : ""}
      </div>
    );
  }

  if (tool.toolKey === "push_webhook" && typeof output.webhookJobId === "string") {
    return (
      <div className="dashboard-copy">
        <strong>Webhook-Job:</strong> {output.webhookJobId}
      </div>
    );
  }

  return null;
}

export function SiteAgentsForm({ siteId }: { siteId: string }) {
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [tickets, setTickets] = useState<AgentTicket[]>([]);
  const [webhookJobs, setWebhookJobs] = useState<WebhookJob[]>([]);
  const [ticketStatusDrafts, setTicketStatusDrafts] = useState<Record<string, string>>({});
  const [toolDetails, setToolDetails] = useState<Record<string, ToolInvocation[]>>({});
  const [expandedRuns, setExpandedRuns] = useState<Record<string, boolean>>({});
  const [loadingRunId, setLoadingRunId] = useState<string | null>(null);
  const [leadDrafts, setLeadDrafts] = useState<Record<string, LeadSalesDraft>>({});
  const [ecommerceDrafts, setEcommerceDrafts] = useState<Record<string, EcommerceDraft>>({});
  const [propertyDrafts, setPropertyDrafts] = useState<Record<string, PropertyDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runStatusFilter, setRunStatusFilter] = useState("all");
  const [runSearch, setRunSearch] = useState("");
  const [webhookStatusFilter, setWebhookStatusFilter] = useState("all");
  const [expandedPayloads, setExpandedPayloads] = useState<Record<string, boolean>>({});

  async function loadOverview(showSpinner = false) {
    try {
      if (showSpinner) {
        setLoading(true);
      }
      setError(null);

      const res = await fetch(`/api/agents/${siteId}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.message || "Agenten konnten nicht geladen werden.");
        return;
      }

      const nextAgents = Array.isArray(data.agents) ? data.agents : [];
      setAgents(nextAgents);
      setRuns(Array.isArray(data.runs) ? data.runs : []);
      const nextTickets = Array.isArray(data.tickets) ? data.tickets : [];
      setTickets(nextTickets);
      setWebhookJobs(Array.isArray(data.webhookJobs) ? data.webhookJobs : []);
      setTicketStatusDrafts(
        Object.fromEntries(
          nextTickets.map((ticket: AgentTicket) => [ticket.id, ticket.status]),
        ),
      );
      setLeadDrafts(
        Object.fromEntries(
          nextAgents
            .filter((agent: AgentDefinition) => agent.key === "lead-sales-agent")
            .map((agent: AgentDefinition) => [agent.key, getInitialLeadSalesDraft()]),
        ),
      );
      setEcommerceDrafts(
        Object.fromEntries(
          nextAgents
            .filter((agent: AgentDefinition) => agent.key === "ecommerce-product-advisor")
            .map((agent: AgentDefinition) => [agent.key, getInitialEcommerceDraft()]),
        ),
      );
      setPropertyDrafts(
        Object.fromEntries(
          nextAgents
            .filter((agent: AgentDefinition) => agent.key === "property-ticket-agent")
            .map((agent: AgentDefinition) => [agent.key, getInitialPropertyDraft()]),
        ),
      );
    } catch {
      setError("Agenten konnten nicht geladen werden.");
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    loadOverview(true);
  }, [siteId]);

  const stats = useMemo(() => {
    const total = runs.length;
    const completed = runs.filter((run) => run.status === "completed").length;
    const failed = runs.filter((run) => run.status === "failed").length;
    const processing = runs.filter((run) => run.status === "processing").length;
    const openTickets = tickets.filter((ticket) => ticket.status !== "closed").length;
    const queuedWebhooks = webhookJobs.filter((job) => job.status === "queued" || job.status === "processing").length;
    const failedWebhooks = webhookJobs.filter((job) => job.status === "failed").length;
    return { total, completed, failed, processing, openTickets, queuedWebhooks, failedWebhooks };
  }, [runs, tickets, webhookJobs]);

  const filteredRuns = useMemo(() => {
    const search = runSearch.trim().toLowerCase();

    return runs.filter((run) => {
      if (runStatusFilter !== "all" && run.status !== runStatusFilter) {
        return false;
      }

      if (!search) {
        return true;
      }

      const haystack = [
        run.agentLabel,
        run.agentKey,
        run.inputSummary || "",
        run.outputSummary || "",
        run.errorMessage || "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [runs, runSearch, runStatusFilter]);

  const filteredWebhookJobs = useMemo(() => {
    if (webhookStatusFilter === "all") {
      return webhookJobs;
    }

    return webhookJobs.filter((job) => job.status === webhookStatusFilter);
  }, [webhookJobs, webhookStatusFilter]);

  const agentExperienceCards = useMemo(() => buildAgentExperienceCards(agents), [agents]);

  async function loadRunTools(runId: string, force = false) {
    if (!force && toolDetails[runId]) {
      setExpandedRuns((current) => ({ ...current, [runId]: !current[runId] }));
      return;
    }

    setLoadingRunId(runId);
    setError(null);

    try {
      const res = await fetch(`/api/agents/runs/${runId}/tools`, { cache: "no-store" });
      const data = await res.json().catch(() => []);

      if (!res.ok) {
        setError((data as { message?: string })?.message || "Automatische Aktionen konnten nicht geladen werden.");
        return;
      }

      setToolDetails((current) => ({
        ...current,
        [runId]: Array.isArray(data) ? (data as ToolInvocation[]) : [],
      }));
      setExpandedRuns((current) => ({ ...current, [runId]: true }));
    } finally {
      setLoadingRunId(null);
    }
  }

  function togglePayload(key: string) {
    setExpandedPayloads((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  function buildLeadSalesPayload(agentKey: string) {
    const draft = leadDrafts[agentKey] || getInitialLeadSalesDraft();
    return {
      agentKey,
      inputSummary: [draft.need, draft.note].filter(Boolean).join(" | ") || undefined,
      triggerSource: "manual",
      metadata: {
        source: "dashboard-preview",
        lead: {
          name: draft.name,
          email: draft.email,
          phone: draft.phone,
          message: draft.note || draft.need,
        },
        contact: {
          name: draft.name,
          email: draft.email,
          phone: draft.phone,
          preferredChannel: draft.preferredChannel,
          note: draft.note || draft.need,
        },
      },
    };
  }

  function buildEcommercePayload(agentKey: string) {
    const draft = ecommerceDrafts[agentKey] || getInitialEcommerceDraft();
    const queryParts = [
      draft.query,
      draft.size ? `Groesse ${draft.size}` : "",
      draft.color,
      draft.availableOnly ? "nur verfügbar" : "",
      draft.maxPrice ? `unter ${draft.maxPrice}` : "",
      draft.note,
    ].filter(Boolean);
    const query = queryParts.join(" ").trim();

    return {
      agentKey,
      inputSummary: query || undefined,
      triggerSource: "manual",
      metadata: {
        source: "dashboard-preview",
        query,
      },
      toolInputs: {
        search_catalog: { query, limit: 4 },
        query_knowledge: { query, limit: 4 },
      },
    };
  }

  function buildPropertyPayload(agentKey: string) {
    const draft = propertyDrafts[agentKey] || getInitialPropertyDraft();
    const description = [draft.title, draft.description, draft.location ? `Ort: ${draft.location}` : ""]
      .filter(Boolean)
      .join(" | ");

    return {
      agentKey,
      inputSummary: description || undefined,
      triggerSource: "manual",
      metadata: {
        source: "dashboard-preview",
        ticket: {
          title: draft.title || "Support-Fall",
          description: draft.description,
          reporterName: draft.reporterName,
          reporterEmail: draft.reporterEmail,
          location: draft.location,
          priority: draft.priority,
        },
        webhook: draft.forwardWebhook
          ? {
              providerKey: "ticket-webhook",
              payload: {
                title: draft.title || "Support-Fall",
                description: draft.description,
                reporterName: draft.reporterName,
                reporterEmail: draft.reporterEmail,
                location: draft.location,
                priority: draft.priority,
                source: "dashboard-preview",
              },
            }
          : undefined,
      },
    };
  }

  function buildExecutePayload(agentKey: string) {
    switch (agentKey) {
      case "lead-sales-agent":
        return buildLeadSalesPayload(agentKey);
      case "ecommerce-product-advisor":
        return buildEcommercePayload(agentKey);
      case "property-ticket-agent":
        return buildPropertyPayload(agentKey);
      default:
        return {
          agentKey,
          triggerSource: "manual",
          metadata: {
            source: "dashboard-preview",
          },
        };
    }
  }

  async function updateTicketStatus(ticketId: string) {
    const status = ticketStatusDrafts[ticketId];
    if (!status) {
      return;
    }

    setActionKey(`ticket:${ticketId}`);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/agents/tickets/${ticketId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const data = (await res.json().catch(() => ({}))) as Partial<AgentTicket> & { message?: string };
      if (!res.ok) {
        setError(data?.message || "Ticket-Status konnte nicht aktualisiert werden.");
        return;
      }

      if (data.id) {
        setTickets((current) =>
          current.map((ticket) => (ticket.id === data.id ? ({ ...ticket, ...data } as AgentTicket) : ticket)),
        );
      }
      setMessage(`Ticket ${ticketId} auf ${status} gesetzt.`);
    } finally {
      setActionKey(null);
    }
  }

  async function retryWebhookJob(jobId: string) {
    setActionKey(`webhook:${jobId}`);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/agents/webhooks/${jobId}/retry`, {
        method: "POST",
      });

      const data = (await res.json().catch(() => ({}))) as Partial<WebhookJob> & { message?: string };
      if (!res.ok) {
        setError(data?.message || "Externe Übergabe konnte nicht erneut vorbereitet werden.");
        return;
      }

      if (data.id) {
        setWebhookJobs((current) =>
          current.map((job) => (job.id === data.id ? ({ ...job, ...data } as WebhookJob) : job)),
        );
      }
      setMessage(`Externe Übergabe wurde erneut vorbereitet.`);
    } finally {
      setActionKey(null);
    }
  }

  async function executeRun(agentKey: string) {
    setSavingKey(agentKey);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/agents/${siteId}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildExecutePayload(agentKey)),
      });

      const data = (await res.json().catch(() => ({}))) as Partial<AgentExecutionResult> & {
        message?: string;
      };

      if (!res.ok) {
        setError(data?.message || "Automatische Aktion konnte nicht ausgeführt werden.");
        return;
      }

      if (data.run) {
        setRuns((current) => [data.run as AgentRun, ...current.filter((run) => run.id !== data.run?.id)]);
      }

      if (data.run?.id && Array.isArray(data.tools)) {
        setToolDetails((current) => ({
          ...current,
          [data.run!.id]: data.tools as ToolInvocation[],
        }));
        setExpandedRuns((current) => ({ ...current, [data.run!.id]: true }));
      }

      if (agentKey === "lead-sales-agent") {
        setLeadDrafts((current) => ({ ...current, [agentKey]: getInitialLeadSalesDraft() }));
      } else if (agentKey === "ecommerce-product-advisor") {
        setEcommerceDrafts((current) => ({ ...current, [agentKey]: getInitialEcommerceDraft() }));
      } else if (agentKey === "property-ticket-agent") {
        setPropertyDrafts((current) => ({ ...current, [agentKey]: getInitialPropertyDraft() }));
      }

      const toolSummary = Array.isArray(data.tools)
        ? data.tools.map((tool) => `${tool.toolLabel}: ${tool.status}`).join(" · ")
        : "";
      await loadOverview(false);
      setMessage(
        toolSummary
          ? `Automatische Aktion wurde ausgeführt. ${toolSummary}`
          : "Automatische Aktion wurde ausgeführt.",
      );
    } finally {
      setSavingKey(null);
    }
  }

  function renderStructuredFields(agent: AgentDefinition) {
    if (agent.key === "lead-sales-agent") {
      const draft = leadDrafts[agent.key] || getInitialLeadSalesDraft();
      return (
        <>
          <div className="dashboard-grid dashboard-grid--two">
            <label className="dashboard-field">
              <span className="dashboard-field-label">Bedarf / Anlass</span>
              <Input
                placeholder="z. B. KI für Kundensupport"
                value={draft.need}
                onChange={(event) =>
                  setLeadDrafts((current) => ({
                    ...current,
                    [agent.key]: { ...draft, need: event.target.value },
                  }))
                }
              />
            </label>
            <label className="dashboard-field">
              <span className="dashboard-field-label">Bevorzugter Kontaktweg</span>
              <Select
                value={draft.preferredChannel}
                onChange={(event) =>
                  setLeadDrafts((current) => ({
                    ...current,
                    [agent.key]: { ...draft, preferredChannel: event.target.value },
                  }))
                }
              >
                <option value="email">E-Mail</option>
                <option value="phone">Telefon</option>
                <option value="whatsapp">WhatsApp</option>
              </Select>
            </label>
          </div>
          <div className="dashboard-grid dashboard-grid--two">
            <label className="dashboard-field">
              <span className="dashboard-field-label">Name</span>
              <Input
                placeholder="Max Mustermann"
                value={draft.name}
                onChange={(event) =>
                  setLeadDrafts((current) => ({
                    ...current,
                    [agent.key]: { ...draft, name: event.target.value },
                  }))
                }
              />
            </label>
            <label className="dashboard-field">
              <span className="dashboard-field-label">E-Mail</span>
              <Input
                placeholder="max@firma.de"
                value={draft.email}
                onChange={(event) =>
                  setLeadDrafts((current) => ({
                    ...current,
                    [agent.key]: { ...draft, email: event.target.value },
                  }))
                }
              />
            </label>
          </div>
          <label className="dashboard-field">
            <span className="dashboard-field-label">Telefon</span>
            <Input
              placeholder="+49 ..."
              value={draft.phone}
              onChange={(event) =>
                setLeadDrafts((current) => ({
                  ...current,
                  [agent.key]: { ...draft, phone: event.target.value },
                }))
              }
            />
          </label>
          <label className="dashboard-field">
            <span className="dashboard-field-label">Zusatznotiz</span>
            <textarea
              className="dashboard-textarea"
              placeholder="Kurze Zusammenfassung oder Kontext"
              value={draft.note}
              onChange={(event) =>
                setLeadDrafts((current) => ({
                  ...current,
                  [agent.key]: { ...draft, note: event.target.value },
                }))
              }
            />
          </label>
        </>
      );
    }

    if (agent.key === "ecommerce-product-advisor") {
      const draft = ecommerceDrafts[agent.key] || getInitialEcommerceDraft();
      return (
        <>
          <label className="dashboard-field">
            <span className="dashboard-field-label">Produktsuche</span>
            <Input
              placeholder="z. B. Sneaker für Herren"
              value={draft.query}
              onChange={(event) =>
                setEcommerceDrafts((current) => ({
                  ...current,
                  [agent.key]: { ...draft, query: event.target.value },
                }))
              }
            />
          </label>
          <div className="dashboard-grid dashboard-grid--two">
            <label className="dashboard-field">
              <span className="dashboard-field-label">Größe</span>
              <Input
                placeholder="42"
                value={draft.size}
                onChange={(event) =>
                  setEcommerceDrafts((current) => ({
                    ...current,
                    [agent.key]: { ...draft, size: event.target.value },
                  }))
                }
              />
            </label>
            <label className="dashboard-field">
              <span className="dashboard-field-label">Farbe</span>
              <Input
                placeholder="schwarz"
                value={draft.color}
                onChange={(event) =>
                  setEcommerceDrafts((current) => ({
                    ...current,
                    [agent.key]: { ...draft, color: event.target.value },
                  }))
                }
              />
            </label>
          </div>
          <div className="dashboard-grid dashboard-grid--two">
            <label className="dashboard-field">
              <span className="dashboard-field-label">Max. Preis</span>
              <Input
                placeholder="100"
                value={draft.maxPrice}
                onChange={(event) =>
                  setEcommerceDrafts((current) => ({
                    ...current,
                    [agent.key]: { ...draft, maxPrice: event.target.value },
                  }))
                }
              />
            </label>
            <label className="dashboard-field dashboard-checkbox dashboard-checkbox--offset">
              <input
                type="checkbox"
                checked={draft.availableOnly}
                onChange={(event) =>
                  setEcommerceDrafts((current) => ({
                    ...current,
                    [agent.key]: { ...draft, availableOnly: event.target.checked },
                  }))
                }
              />
              <span>Nur verfügbare Produkte</span>
            </label>
          </div>
          <label className="dashboard-field">
            <span className="dashboard-field-label">Zusatzhinweis</span>
            <textarea
              className="dashboard-textarea"
              placeholder="z. B. eher sportlich oder alltagstauglich"
              value={draft.note}
              onChange={(event) =>
                setEcommerceDrafts((current) => ({
                  ...current,
                  [agent.key]: { ...draft, note: event.target.value },
                }))
              }
            />
          </label>
        </>
      );
    }

    if (agent.key === "property-ticket-agent") {
      const draft = propertyDrafts[agent.key] || getInitialPropertyDraft();
      return (
        <>
          <div className="dashboard-grid dashboard-grid--two">
            <label className="dashboard-field">
              <span className="dashboard-field-label">Titel</span>
              <Input
                placeholder="Wasserschaden im Bad"
                value={draft.title}
                onChange={(event) =>
                  setPropertyDrafts((current) => ({
                    ...current,
                    [agent.key]: { ...draft, title: event.target.value },
                  }))
                }
              />
            </label>
            <label className="dashboard-field">
              <span className="dashboard-field-label">Priorität</span>
              <Select
                value={draft.priority}
                onChange={(event) =>
                  setPropertyDrafts((current) => ({
                    ...current,
                    [agent.key]: { ...draft, priority: event.target.value as PropertyDraft["priority"] },
                  }))
                }
              >
                <option value="low">Niedrig</option>
                <option value="normal">Normal</option>
                <option value="high">Hoch</option>
                <option value="urgent">Dringend</option>
              </Select>
            </label>
          </div>
          <label className="dashboard-field">
            <span className="dashboard-field-label">Fallbeschreibung</span>
            <textarea
              className="dashboard-textarea"
              placeholder="Was ist passiert, wo und seit wann?"
              value={draft.description}
              onChange={(event) =>
                setPropertyDrafts((current) => ({
                  ...current,
                  [agent.key]: { ...draft, description: event.target.value },
                }))
              }
            />
          </label>
          <div className="dashboard-grid dashboard-grid--two">
            <label className="dashboard-field">
              <span className="dashboard-field-label">Mieter / Ansprechpartner</span>
              <Input
                placeholder="Name"
                value={draft.reporterName}
                onChange={(event) =>
                  setPropertyDrafts((current) => ({
                    ...current,
                    [agent.key]: { ...draft, reporterName: event.target.value },
                  }))
                }
              />
            </label>
            <label className="dashboard-field">
              <span className="dashboard-field-label">E-Mail</span>
              <Input
                placeholder="mieter@beispiel.de"
                value={draft.reporterEmail}
                onChange={(event) =>
                  setPropertyDrafts((current) => ({
                    ...current,
                    [agent.key]: { ...draft, reporterEmail: event.target.value },
                  }))
                }
              />
            </label>
          </div>
          <label className="dashboard-field">
            <span className="dashboard-field-label">Ort / Einheit</span>
            <Input
              placeholder="Wohnung 3, Bad"
              value={draft.location}
              onChange={(event) =>
                setPropertyDrafts((current) => ({
                  ...current,
                  [agent.key]: { ...draft, location: event.target.value },
                }))
              }
            />
          </label>
          <label className="dashboard-field dashboard-checkbox">
            <input
              type="checkbox"
              checked={draft.forwardWebhook}
              onChange={(event) =>
                setPropertyDrafts((current) => ({
                  ...current,
                  [agent.key]: { ...draft, forwardWebhook: event.target.checked },
                }))
              }
            />
            <span>Zusätzlich an externe Übergabe weiterleiten</span>
          </label>
        </>
      );
    }

    return null;
  }

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  return (
    <div className="dashboard-stack">
      <div className="dashboard-card dashboard-stack">
        <div>
          <h2 className="dashboard-card-title">Business-Agenten</h2>
          <p className="dashboard-copy">
            Aktiviere die Funktionen, die im Chat automatisch helfen sollen. Details und Testläufe bleiben einklappbar.
          </p>
        </div>

        <div className="dashboard-grid dashboard-grid--metrics-4 agent-metric-grid">
          <div className="dashboard-card dashboard-card--soft">
            <strong>{stats.total}</strong>
            <p className="dashboard-copy dashboard-copy--muted">Gesamte Läufe</p>
          </div>
          <div className="dashboard-card dashboard-card--soft">
            <strong>{stats.completed}</strong>
            <p className="dashboard-copy dashboard-copy--muted">Abgeschlossen</p>
          </div>
          <div className="dashboard-card dashboard-card--soft">
            <strong>{stats.failed}</strong>
            <p className="dashboard-copy dashboard-copy--muted">Fehlgeschlagen</p>
          </div>
          <div className="dashboard-card dashboard-card--soft">
            <strong>{stats.processing}</strong>
            <p className="dashboard-copy dashboard-copy--muted">In Bearbeitung</p>
          </div>
          <div className="dashboard-card dashboard-card--soft">
            <strong>{stats.openTickets}</strong>
            <p className="dashboard-copy dashboard-copy--muted">Offene Tickets</p>
          </div>
          <div className="dashboard-card dashboard-card--soft">
            <strong>{stats.queuedWebhooks}</strong>
            <p className="dashboard-copy dashboard-copy--muted">Übergaben aktiv</p>
          </div>
          <div className="dashboard-card dashboard-card--soft">
            <strong>{stats.failedWebhooks}</strong>
            <p className="dashboard-copy dashboard-copy--muted">Übergabe-Fehler</p>
          </div>
        </div>

        <div className="agent-card-list">
          {agentExperienceCards.map((card) => {
            const agent = card.sourceAgent;
            const isAvailable = agent?.isAvailable === true;

            return (
              <details key={card.key} className="dashboard-accordion agent-card">
                <summary className="dashboard-accordion__summary agent-card__summary">
                  <span>
                    <strong>{card.title}</strong>
                    <small>{card.benefit}</small>
                  </span>
                  <span className={isAvailable ? "dashboard-status dashboard-status--success" : "dashboard-badge"}>
                    {isAvailable ? "Aktiv" : "Unvollständig"}
                  </span>
                </summary>
                <div className="dashboard-accordion__content agent-card__content">
                  <div className="agent-card__body">
                    <div>
                      <span className="dashboard-field-label">Was macht dieser Agent?</span>
                      <p className="dashboard-copy dashboard-no-margin-bottom">{card.whatItDoes}</p>
                    </div>
                    <div>
                      <span className="dashboard-field-label">Wann ist er sinnvoll?</span>
                      <p className="dashboard-copy dashboard-no-margin-bottom">{card.goodFor}</p>
                    </div>
                    <div>
                      <span className="dashboard-field-label">Welche Daten werden erfasst?</span>
                      <p className="dashboard-copy dashboard-no-margin-bottom">{card.collectedData}</p>
                    </div>
                    <div>
                      <span className="dashboard-field-label">Was passiert danach?</span>
                      <p className="dashboard-copy dashboard-no-margin-bottom">{card.afterSuccess}</p>
                    </div>
                  </div>

                  <div className="agent-card__activation">
                    <div>
                      <strong>{isAvailable ? "Aktiviert" : "Noch nicht bereit"}</strong>
                      <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
                        {isAvailable
                          ? "Alle benötigten Funktionen sind aktiv."
                          : buildMissingRequirementMessage(card, agent)}
                      </p>
                    </div>
                    <div className="agent-card__actions">
                      <span className="dashboard-badge">
                        {card.requiredModuleKeys.length > 0
                          ? card.requiredModuleKeys.map(formatModuleLabel).join(", ")
                          : "Keine Voraussetzung"}
                      </span>
                      <Link
                        href={`/sites/${siteId}/${card.setupHref}`}
                        className="dashboard-button dashboard-button--secondary"
                      >
                        {isAvailable ? "Anpassen / deaktivieren" : "Aktivieren"}
                      </Link>
                    </div>
                  </div>

                  <div className="dashboard-copy dashboard-copy--muted">
                    <strong>Automatische Aktionen:</strong>{" "}
                    {card.toolLabels.length > 0 ? card.toolLabels.join(" / ") : "Keine Aktionen hinterlegt"}
                  </div>

                  {agent && !isAvailable ? (
                    <p className="dashboard-error">
                      {buildMissingRequirementMessage(card, agent)}
                    </p>
                  ) : null}

                  {agent ? (
                    <details className="dashboard-accordion dashboard-accordion--subtle">
                      <summary className="dashboard-accordion__summary">Technische Details und Testlauf</summary>
                      <div className="dashboard-accordion__content">
                        <p className="dashboard-copy dashboard-copy--muted">
                          {agent.category} · {agent.key}
                        </p>
                        {renderStructuredFields(agent)}
                        <Button
                          onClick={() => executeRun(agent.key)}
                          disabled={!agent.isAvailable || savingKey === agent.key}
                        >
                          {savingKey === agent.key ? "Test läuft..." : "Testlauf ausführen"}
                        </Button>
                      </div>
                    </details>
                  ) : (
                    <p className="dashboard-copy dashboard-copy--muted">
                      Diese Funktion wird sichtbar, sobald die passenden Voraussetzungen verfügbar sind.
                    </p>
                  )}
                </div>
              </details>
            );
          })}
        </div>

        {message ? <p className="dashboard-status dashboard-status--success">{message}</p> : null}
      </div>

      <div className="dashboard-card dashboard-stack">
        <div>
          <h2 className="dashboard-card-title">Ticket-Monitoring</h2>
          <p className="dashboard-copy">
            Interne Tickets aus Agentenläufen. Diese Liste zeigt, was bereits als Fall angelegt wurde.
          </p>
        </div>

        {tickets.length === 0 ? (
          <p className="dashboard-copy dashboard-copy--muted">Noch keine Tickets vorhanden.</p>
        ) : (
          <div className="dashboard-stack dashboard-stack--sm">
            {tickets.slice(0, 20).map((ticket) => (
              <div key={ticket.id} className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--xs">
                <div className="dashboard-info-row">
                  <strong>{ticket.title}</strong>
                  <span className={statusTone(ticket.status)}>{ticket.status}</span>
                </div>
                <div className="dashboard-copy dashboard-copy--muted">
                  Priorität {ticket.priority} · erstellt: {formatDate(ticket.createdAt)}
                </div>
                <div className="dashboard-copy">{ticket.description}</div>
                <div className="dashboard-copy dashboard-copy--muted">
                  {ticket.reporterName || "-"}
                  {ticket.reporterEmail ? ` · ${ticket.reporterEmail}` : ""}
                  {ticket.location ? ` · ${ticket.location}` : ""}
                </div>
                <div className="dashboard-copy dashboard-copy--muted">
                  Ticket-ID: <span className="dashboard-mono">{ticket.id}</span>
                  {" · "}
                  Run-ID: <span className="dashboard-mono">{ticket.agentRunId}</span>
                </div>
                <div className="dashboard-inline dashboard-inline--end dashboard-gap-12">
                  <label className="dashboard-field dashboard-field--grow">
                    <span className="dashboard-field-label">Status ändern</span>
                    <Select
                      value={ticketStatusDrafts[ticket.id] || ticket.status}
                      onChange={(event) =>
                        setTicketStatusDrafts((current) => ({
                          ...current,
                          [ticket.id]: event.target.value,
                        }))
                      }
                    >
                      <option value="new">new</option>
                      <option value="open">open</option>
                      <option value="in_progress">in_progress</option>
                      <option value="resolved">resolved</option>
                      <option value="closed">closed</option>
                    </Select>
                  </label>
                  <Button
                    variant="secondary"
                    onClick={() => updateTicketStatus(ticket.id)}
                    disabled={actionKey === `ticket:${ticket.id}` || (ticketStatusDrafts[ticket.id] || ticket.status) === ticket.status}
                  >
                    {actionKey === `ticket:${ticket.id}` ? "Speichert..." : "Status speichern"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="dashboard-card dashboard-stack">
        <div>
          <h2 className="dashboard-card-title">Externe Übergaben</h2>
          <p className="dashboard-copy">
            Hier siehst du, welche Informationen an angebundene Systeme weitergegeben wurden.
          </p>
        </div>

        <label className="dashboard-field dashboard-field--narrow">
          <span className="dashboard-field-label">Status filtern</span>
          <Select value={webhookStatusFilter} onChange={(event) => setWebhookStatusFilter(event.target.value)}>
            <option value="all">Alle</option>
            <option value="failed">Fehler</option>
            <option value="queued">Wartet</option>
            <option value="sent">Erfolgreich</option>
            <option value="processing">In Bearbeitung</option>
          </Select>
        </label>

        {filteredWebhookJobs.length === 0 ? (
          <p className="dashboard-copy dashboard-copy--muted">Noch keine externen Übergaben vorhanden.</p>
        ) : (
          <div className="dashboard-stack dashboard-stack--sm">
            {filteredWebhookJobs.slice(0, 20).map((job) => (
              <div key={job.id} className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--xs">
                <div className="dashboard-info-row">
                  <strong>{job.providerKey}</strong>
                  <span className={statusTone(job.status)}>{formatStatusLabel(job.status)}</span>
                </div>
                <div className="dashboard-copy dashboard-copy--muted">
                  Verbindung {job.connectionKey} · erstellt: {formatDate(job.createdAt)} · beendet:{" "}
                  {formatDate(job.completedAt)}
                </div>
                {job.endpointUrl ? (
                  <div className="dashboard-copy dashboard-copy--muted">
                    Zieladresse: <span className="dashboard-mono">{job.endpointUrl}</span>
                  </div>
                ) : null}
                <div className="dashboard-copy dashboard-copy--muted">
                  Wiederholungen {job.retryCount}/{job.maxAttempts}
                </div>
                {job.lastResponseStatus !== null && job.lastResponseStatus !== undefined ? (
                  <div className="dashboard-copy dashboard-copy--muted">
                    Letzte Antwort: HTTP {job.lastResponseStatus}
                  </div>
                ) : null}
                {job.lastError ? <div className="dashboard-error">{job.lastError}</div> : null}
                {job.lastResponseBody ? (
                  <div className="dashboard-stack dashboard-stack--xs">
                    <div className="dashboard-copy dashboard-copy--muted">Letzte technische Antwort</div>
                    <pre className="dashboard-textarea dashboard-mono dashboard-code-block dashboard-code-block--sm">
{job.lastResponseBody}
                    </pre>
                  </div>
                ) : null}
                <div className="dashboard-copy dashboard-copy--muted">
                  Job-ID: <span className="dashboard-mono">{job.id}</span>
                  {job.agentRunId ? (
                    <>
                      {" · "}
                      Run-ID: <span className="dashboard-mono">{job.agentRunId}</span>
                    </>
                  ) : null}
                </div>
                <div className="dashboard-inline dashboard-inline--spaced">
                  <span className="dashboard-copy dashboard-copy--muted">Zuletzt übergebene Daten</span>
                  <Button
                    variant="secondary"
                    onClick={() => togglePayload(`webhook:${job.id}`)}
                  >
                    {expandedPayloads[`webhook:${job.id}`] ? "Daten ausblenden" : "Daten anzeigen"}
                  </Button>
                </div>
                {expandedPayloads[`webhook:${job.id}`] ? (
                  <pre className="dashboard-textarea dashboard-mono dashboard-code-block dashboard-code-block--md">
{prettyJson(job.payload || {})}
                  </pre>
                ) : null}
                {job.status === "failed" ? (
                  <div className="dashboard-inline">
                    <Button
                      variant="secondary"
                      onClick={() => retryWebhookJob(job.id)}
                      disabled={actionKey === `webhook:${job.id}`}
                    >
                      {actionKey === `webhook:${job.id}` ? "Reiht ein..." : "Erneut einreihen"}
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="dashboard-card dashboard-stack">
        <div>
          <h2 className="dashboard-card-title">Automationsprotokoll</h2>
          <p className="dashboard-copy">
            Diese Übersicht zeigt ausgeführte Agenten, automatische Aktionen und Ergebnisse.
          </p>
        </div>

        <div className="dashboard-grid dashboard-grid--two dashboard-grid--tight">
          <label className="dashboard-field">
            <span className="dashboard-field-label">Status filtern</span>
            <Select value={runStatusFilter} onChange={(event) => setRunStatusFilter(event.target.value)}>
              <option value="all">Alle</option>
              <option value="completed">Abgeschlossen</option>
              <option value="failed">Fehlgeschlagen</option>
              <option value="processing">In Bearbeitung</option>
              <option value="queued">Wartet</option>
            </Select>
          </label>
          <label className="dashboard-field">
            <span className="dashboard-field-label">Suche</span>
            <Input
              placeholder="Agent, Eingabe, Ergebnis"
              value={runSearch}
              onChange={(event) => setRunSearch(event.target.value)}
            />
          </label>
        </div>

        {filteredRuns.length === 0 ? (
          <p className="dashboard-copy dashboard-copy--muted">Noch keine automatischen Aktionen vorhanden.</p>
        ) : (
          <div className="dashboard-stack dashboard-stack--sm">
            {filteredRuns.map((run) => {
              const tools = toolDetails[run.id] || [];
              const isExpanded = expandedRuns[run.id] === true;
              const orchestration = (run.metadata?.orchestration as Record<string, unknown> | undefined) || undefined;

              return (
                <div key={run.id} className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--xs">
                  <div className="dashboard-info-row">
                    <strong>{run.agentLabel}</strong>
                    <span className={statusTone(run.status)}>{formatStatusLabel(run.status)}</span>
                  </div>

                  <div className="dashboard-copy dashboard-copy--muted">
                    {run.triggerSource} · erstellt: {formatDate(run.createdAt)} · gestartet:{" "}
                    {formatDate(run.startedAt)} · beendet: {formatDate(run.completedAt)}
                  </div>

                  {run.inputSummary ? (
                    <div className="dashboard-copy">
                      <strong>Eingabe:</strong> {run.inputSummary}
                    </div>
                  ) : null}

                  {run.outputSummary ? (
                    <div className="dashboard-copy">
                      <strong>Ergebnis:</strong> {run.outputSummary}
                    </div>
                  ) : null}

                  {orchestration ? (
                    <div className="dashboard-copy dashboard-copy--muted">
                      <strong>Plan:</strong>{" "}
                      {Array.isArray(orchestration.plan) ? orchestration.plan.join(" → ") : "-"}
                    </div>
                  ) : null}

                  <div className="dashboard-inline dashboard-inline--spaced">
                    <Button
                      variant="secondary"
                      onClick={() => loadRunTools(run.id)}
                      disabled={loadingRunId === run.id}
                    >
                      {loadingRunId === run.id
                        ? "Aktionen laden..."
                        : isExpanded
                          ? "Automatische Aktionen ausblenden"
                          : "Automatische Aktionen anzeigen"}
                    </Button>

                    {tools.length > 0 ? (
                      <span className="dashboard-copy dashboard-copy--muted">{tools.length} Schritte</span>
                    ) : null}
                  </div>

                  {isExpanded ? (
                    tools.length === 0 ? (
                      <p className="dashboard-copy dashboard-copy--muted">
                        Für diesen Lauf wurden noch keine automatischen Aktionen geladen oder aufgezeichnet.
                      </p>
                    ) : (
                      <div className="dashboard-stack dashboard-stack--xs">
                        {tools.map((tool) => (
                          <div key={tool.id} className="dashboard-card">
                            <div className="dashboard-info-row">
                              <strong>{tool.toolLabel}</strong>
                              <span className={statusTone(tool.status)}>{formatStatusLabel(tool.status)}</span>
                            </div>
                            {summarizeToolOutput(tool) ? (
                              <div className="dashboard-copy">
                                <strong>Ergebnis:</strong> {summarizeToolOutput(tool)}
                              </div>
                            ) : null}
                            {renderToolDetails(tool)}
                            <div className="dashboard-inline dashboard-inline--spaced">
                              <span className="dashboard-copy dashboard-copy--muted">
                                {tool.createdAt ? `Gestartet: ${formatDate(tool.createdAt)}` : ""}
                                {tool.completedAt ? ` · Beendet: ${formatDate(tool.completedAt)}` : ""}
                              </span>
                              <Button
                                variant="secondary"
                                onClick={() => togglePayload(`tool:${tool.id}`)}
                              >
                                {expandedPayloads[`tool:${tool.id}`] ? "Daten ausblenden" : "Daten anzeigen"}
                              </Button>
                            </div>
                            {expandedPayloads[`tool:${tool.id}`] ? (
                              <div className="dashboard-grid dashboard-grid--two dashboard-grid--tight dashboard-mt-8">
                                <div>
                                  <div className="dashboard-copy"><strong>Eingehende Daten</strong></div>
                                  <pre className="dashboard-textarea dashboard-mono dashboard-code-block dashboard-code-block--md">
{prettyJson(tool.inputPayload || {})}
                                  </pre>
                                </div>
                                <div>
                                  <div className="dashboard-copy"><strong>Ergebnisdaten</strong></div>
                                  <pre className="dashboard-textarea dashboard-mono dashboard-code-block dashboard-code-block--md">
{prettyJson(tool.outputPayload || {})}
                                  </pre>
                                </div>
                              </div>
                            ) : null}
                            {tool.errorMessage ? <div className="dashboard-error">{tool.errorMessage}</div> : null}
                          </div>
                        ))}
                      </div>
                    )
                  ) : null}

                  <div className="dashboard-inline dashboard-inline--spaced">
                    <span className="dashboard-copy dashboard-copy--muted">
                      Run-ID: <span className="dashboard-mono">{run.id}</span>
                    </span>
                    <Button
                      variant="secondary"
                      onClick={() => togglePayload(`run:${run.id}`)}
                    >
                      {expandedPayloads[`run:${run.id}`] ? "Technische Details ausblenden" : "Technische Details anzeigen"}
                    </Button>
                  </div>
                  {expandedPayloads[`run:${run.id}`] ? (
                    <pre className="dashboard-textarea dashboard-mono dashboard-code-block dashboard-code-block--lg">
{prettyJson(run.metadata || {})}
                    </pre>
                  ) : null}

                  {run.errorMessage ? <div className="dashboard-error">{run.errorMessage}</div> : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
