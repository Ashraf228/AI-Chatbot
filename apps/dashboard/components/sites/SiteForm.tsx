import type { FormEvent } from "react";
import type { IndustryTemplate } from "../../lib/industry-templates";
import { Button } from "../shared/Button";
import { Input } from "../shared/Input";
import { Select } from "../shared/Select";

type SiteFormValues = {
  siteKey: string;
  tenantId: string;
  name: string;
  domain: string;
  businessDescription: string;
  targetUsers: string;
  assistantRole: string;
  assistantRoleCustom: string;
  enabledTasks: string[];
  industry: string;
  botType: string;
  leadNotificationEmail: string;
};

type SiteFormProps = {
  form: SiteFormValues;
  tenantOptions: Array<{ id: string; name: string }>;
  industryOptions: IndustryTemplate[];
  submitDisabled?: boolean;
  limitMessage?: string | null;
  planLabel?: string | null;
  onChange: (next: SiteFormValues) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

export function SiteForm({
  form,
  tenantOptions,
  industryOptions,
  submitDisabled = false,
  limitMessage = null,
  planLabel = null,
  onChange,
  onSubmit,
}: SiteFormProps) {
  const selectedTemplate = industryOptions.find((industry) => industry.key === form.industry);
  const enabledModules =
    selectedTemplate?.modules.filter((module) => module.isEnabled).map((module) => module.key) || [];
  const recommendedQuestions = Object.values(selectedTemplate?.recommendedQuestions || {}).flat();
  const roleOptions = [
    { value: "customer_service", label: "Kundenservice-Mitarbeiter" },
    { value: "support", label: "Support-Mitarbeiter" },
    { value: "product_advisor", label: "Produktberater" },
    { value: "reception", label: "Empfang / Erstkontakt" },
    { value: "knowledge_assistant", label: "Interner Wissensassistent" },
    { value: "custom", label: "Individuell" },
  ];
  const taskOptions = [
    { value: "answer_questions", label: "Fragen beantworten" },
    { value: "collect_requests", label: "Kundenanfragen aufnehmen" },
    { value: "support", label: "Supportfälle vorbereiten" },
    { value: "product_advice", label: "Produkte / Leistungen erklären" },
    { value: "appointment", label: "Termine oder Rückrufe vorbereiten" },
    { value: "prepare_handoff", label: "Daten an Systeme übergeben" },
  ];

  function toggleTask(task: string) {
    const enabledTasks = form.enabledTasks.includes(task)
      ? form.enabledTasks.filter((item) => item !== task)
      : [...form.enabledTasks, task];
    onChange({ ...form, enabledTasks });
  }

  return (
    <form onSubmit={onSubmit} className="dashboard-card dashboard-stack dashboard-stack--sm">
      <div className="dashboard-field">
        <label className="dashboard-field-label" htmlFor="site-name">
          Kundenname
        </label>
        <Input
          id="site-name"
          placeholder="Musterkunde GmbH"
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
        />
      </div>

      <div className="dashboard-field">
        <label className="dashboard-field-label" htmlFor="site-domain">
          Website oder Hauptdomain
        </label>
        <Input
          id="site-domain"
          placeholder="kunde.de"
          value={form.domain}
          onChange={(event) => onChange({ ...form, domain: event.target.value })}
        />
      </div>

      <div className="dashboard-field">
        <label className="dashboard-field-label" htmlFor="site-business-description">
          Unternehmensbeschreibung
        </label>
        <textarea
          id="site-business-description"
          className="dashboard-textarea"
          rows={4}
          placeholder="Was macht das Unternehmen? Welche Produkte, Leistungen oder Prozesse sind wichtig?"
          value={form.businessDescription}
          onChange={(event) => onChange({ ...form, businessDescription: event.target.value })}
        />
        <p className="dashboard-field-hint">Optional, aber empfohlen. Diese Information hilft später beim KI-Mitarbeiter-Profil.</p>
      </div>

      <div className="dashboard-field">
        <label className="dashboard-field-label" htmlFor="site-target-users">
          Zielgruppe / Nutzer
        </label>
        <Input
          id="site-target-users"
          placeholder="z. B. Kunden, Mitarbeiter, Kommunen, Patienten, Händler, interne Teams"
          value={form.targetUsers}
          onChange={(event) => onChange({ ...form, targetUsers: event.target.value })}
        />
      </div>

      <div className="dashboard-field">
        <label className="dashboard-field-label" htmlFor="site-assistant-role">
          KI-Mitarbeiter-Rolle
        </label>
        <Select
          id="site-assistant-role"
          value={form.assistantRole}
          onChange={(event) => onChange({ ...form, assistantRole: event.target.value })}
        >
          {roleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      {form.assistantRole === "custom" ? (
        <div className="dashboard-field">
          <label className="dashboard-field-label" htmlFor="site-assistant-role-custom">
            Individuelle Rolle
          </label>
          <Input
            id="site-assistant-role-custom"
            placeholder="z. B. Technischer Vorqualifizierer"
            value={form.assistantRoleCustom}
            onChange={(event) => onChange({ ...form, assistantRoleCustom: event.target.value })}
          />
        </div>
      ) : null}

      <fieldset className="dashboard-fieldset">
        <legend className="dashboard-field-label">Hauptaufgaben der KI</legend>
        <div className="dashboard-checkbox-grid">
          {taskOptions.map((task) => (
            <label key={task.value} className="dashboard-checkbox-card">
              <input
                type="checkbox"
                checked={form.enabledTasks.includes(task.value)}
                onChange={() => toggleTask(task.value)}
              />
              <span>{task.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="dashboard-card dashboard-card--soft">
        <strong>Universelles KI-Mitarbeiter-Profil</strong>
        <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
          Der Kunde wird ohne Branchenzwang angelegt. Legacy-Felder bleiben kompatibel, die neue Konfiguration startet neutral.
        </p>
      </div>

      <div className="dashboard-field">
        <label className="dashboard-field-label" htmlFor="site-lead-email">
          Übergabe-E-Mail optional
        </label>
        <Input
          id="site-lead-email"
          type="email"
          placeholder="info@unternehmen.de"
          value={form.leadNotificationEmail}
          onChange={(event) => onChange({ ...form, leadNotificationEmail: event.target.value })}
        />
        <p className="dashboard-field-hint">
          Wenn Kundenanfragen per E-Mail zugestellt werden sollen, wird diese Adresse später genutzt.
        </p>
      </div>

      <details className="dashboard-card dashboard-card--soft">
        <summary className="dashboard-accordion__summary">
          Erweiterte Angaben
        </summary>
        <div className="dashboard-stack dashboard-stack--sm dashboard-mt-14">
          <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
            Diese Angaben werden nur selten direkt benötigt und können später angepasst werden.
          </p>

          <div className="dashboard-field">
            <label className="dashboard-field-label" htmlFor="site-key">
              Einbindungscode
            </label>
            <Input
              id="site-key"
              placeholder="soule-smart-business"
              value={form.siteKey}
              onChange={(event) => onChange({ ...form, siteKey: event.target.value })}
            />
          </div>

          <div className="dashboard-field">
            <label className="dashboard-field-label" htmlFor="tenant-id">
              Mandant (intern)
            </label>
            <Select
              id="tenant-id"
              value={form.tenantId}
              onChange={(event) => onChange({ ...form, tenantId: event.target.value })}
              disabled={tenantOptions.length === 0}
            >
              {tenantOptions.length === 0 ? (
                <option value="">Keine Mandanten vorhanden</option>
              ) : null}
              {tenantOptions.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </Select>
          </div>

          <details className="dashboard-card dashboard-card--soft">
            <summary className="dashboard-accordion__summary">
              Erweitert / Legacy-Branchenprofile
            </summary>
            <div className="dashboard-stack dashboard-stack--sm dashboard-mt-14">
              <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
                Legacy-Branchenprofile nur für bestehende Vorlagen oder Alt-Konfigurationen verwenden.
              </p>
              <div className="dashboard-field">
                <label className="dashboard-field-label" htmlFor="site-industry">
                  Legacy-Branchenprofil
                </label>
                <Select
                  id="site-industry"
                  value={form.industry}
                  onChange={(event) => onChange({ ...form, industry: event.target.value })}
                >
                  <option value="">Keine Legacy-Vorlage</option>
                  {industryOptions.map((industry) => (
                    <option key={industry.key} value={industry.key}>
                      {industry.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="dashboard-field">
                <label className="dashboard-field-label" htmlFor="site-bot-type">
                  Legacy Bot-Typ
                </label>
                <Select
                  id="site-bot-type"
                  value={form.botType}
                  onChange={(event) => onChange({ ...form, botType: event.target.value })}
                >
                  <option value="universal-assistant">Universal Assistant</option>
                  <option value="handwerker-first-contact">Handwerker-Erstkontakt</option>
                </Select>
              </div>

              {selectedTemplate ? (
                <div className="site-template-preview dashboard-stack dashboard-stack--sm">
                  <div>
                    <strong className="site-template-preview__title">Legacy-Vorlage wird vorbereitet</strong>
                    <p className="dashboard-field-hint dashboard-no-margin-bottom">
                      Nach dem Anlegen werden Ziel, Begrüßung, Testfragen und Funktionen aus der Vorlage vorbelegt.
                    </p>
                  </div>
                  <div className="site-template-preview__item">
                    <span className="site-template-preview__label">Ziel</span>
                    <span className="site-template-preview__value">{formatGoal(selectedTemplate.setupGoal)}</span>
                  </div>
                  <div className="site-template-preview__item">
                    <span className="site-template-preview__label">Begrüßung</span>
                    <span className="site-template-preview__value">{selectedTemplate.welcomeMessage}</span>
                  </div>
                  {recommendedQuestions.length > 0 ? (
                    <div className="site-template-preview__item">
                      <span className="site-template-preview__label">Typische Fragen</span>
                      <span className="site-template-preview__value">{recommendedQuestions.slice(0, 2).join(" · ")}</span>
                    </div>
                  ) : null}
                  {enabledModules.length > 0 ? (
                    <div className="site-template-preview__item">
                      <span className="site-template-preview__label">Funktionen</span>
                      <span className="site-template-preview__value">{enabledModules.map(formatModule).join(", ")}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </details>
        </div>
      </details>

      {planLabel || limitMessage ? (
        <div className={limitMessage ? "dashboard-status dashboard-status--warning" : "dashboard-status"}>
          {limitMessage || `Aktueller Plan: ${planLabel}`}
        </div>
      ) : null}

      <Button type="submit" disabled={submitDisabled}>
        {submitDisabled ? "Limit erreicht" : "Kunde anlegen"}
      </Button>
    </form>
  );
}

function formatGoal(goal: string) {
  if (goal === "lead_capture") {
    return "Leads sammeln";
  }

  if (goal === "support") {
    return "Support beantworten";
  }

  if (goal === "product_advice") {
    return "Produkte empfehlen";
  }

  if (goal === "appointments") {
    return "Termine vorbereiten";
  }

  return goal;
}

function formatModule(moduleKey: string) {
  if (moduleKey === "lead-sales") {
    return "Lead/Sales";
  }

  if (moduleKey === "knowledge-faq") {
    return "Wissen/FAQ";
  }

  if (moduleKey === "ecommerce-product-advisor") {
    return "Produktberater";
  }

  if (moduleKey === "property-ticketing") {
    return "Ticket-Erstellung";
  }

  if (moduleKey === "reporting-insights") {
    return "Berichte";
  }

  return moduleKey;
}
