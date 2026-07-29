import { Button } from "../../shared/Button";
import { Input } from "../../shared/Input";
import type { KnowledgeDraftForm, KnowledgeMethod } from "./setupWizardTypes";

type KnowledgeAddSourcePanelProps = {
  method: KnowledgeMethod;
  onMethodChange: (method: KnowledgeMethod) => void;
  draft: KnowledgeDraftForm;
  onDraftChange: (draft: KnowledgeDraftForm) => void;
  onFileChange: (file: File | null) => void;
  selectedFile: File | null;
  savingKey: string | null;
  onAddManual: () => void;
  onAddUrl: () => void;
  onAddPdf: () => void;
};

const KNOWLEDGE_METHODS: Array<{ key: KnowledgeMethod; title: string; text: string }> = [
  { key: "manual", title: "FAQ oder Text einfügen", text: "Kurze Fragen, Antworten oder freie Texte direkt speichern." },
  { key: "url", title: "Website einlesen", text: "Eine einzelne Webseite in das Wissen übernehmen." },
  { key: "pdf", title: "Dokument hochladen", text: "Ein PDF-Dokument als Wissen verarbeiten." },
];

export function KnowledgeAddSourcePanel({
  method,
  onMethodChange,
  draft,
  onDraftChange,
  onFileChange,
  selectedFile,
  savingKey,
  onAddManual,
  onAddUrl,
  onAddPdf,
}: KnowledgeAddSourcePanelProps) {
  return (
    <div className="knowledge-step__add-panel dashboard-stack">
      <div className="knowledge-step__method-grid">
        {KNOWLEDGE_METHODS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`wizard-method-card${method === item.key ? " wizard-method-card--active" : ""}`}
            onClick={() => onMethodChange(item.key)}
          >
            <strong>{item.title}</strong>
            <span>{item.text}</span>
          </button>
        ))}
      </div>

      <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
        {method === "manual" ? (
          <>
            <h3 className="dashboard-card-title dashboard-card-title--sm">FAQ oder eigener Text</h3>
            <Input
              value={draft.title}
              onChange={(event) => onDraftChange({ ...draft, title: event.target.value })}
              placeholder="Titel, z. B. Leistungen oder Preise"
            />
            <Input
              value={draft.question}
              onChange={(event) => onDraftChange({ ...draft, question: event.target.value })}
              placeholder="Frage (optional)"
            />
            <textarea
              className="dashboard-textarea wizard-textarea-compact"
              value={draft.content}
              onChange={(event) => onDraftChange({ ...draft, content: event.target.value })}
              placeholder="Antwort, FAQ oder Wissenstext einfügen (Pflicht)"
            />
            <Button type="button" onClick={onAddManual} disabled={savingKey === "manual"}>
              {savingKey === "manual" ? "Speichert..." : "In Wissen speichern"}
            </Button>
          </>
        ) : null}

        {method === "url" ? (
          <>
            <h3 className="dashboard-card-title dashboard-card-title--sm">Website-Seite einlesen</h3>
            <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
              Importiert nur diese einzelne öffentlich erreichbare Seite. Kein automatisches Website- oder Domain-Crawling.
              Die Quelle ist danach noch nicht automatisch für Antworten freigegeben.
            </p>
            <Input
              value={draft.url}
              onChange={(event) => onDraftChange({ ...draft, url: event.target.value })}
              placeholder="https://www.kunde.de/faq"
            />
            <Input
              value={draft.urlTitle}
              onChange={(event) => onDraftChange({ ...draft, urlTitle: event.target.value })}
              placeholder="Titel (optional)"
            />
            <Button type="button" onClick={onAddUrl} disabled={savingKey === "url"}>
              {savingKey === "url" ? "Liest ein..." : "Website einlesen"}
            </Button>
          </>
        ) : null}

        {method === "pdf" ? (
          <>
            <h3 className="dashboard-card-title dashboard-card-title--sm">PDF-Dokument</h3>
            <input
              type="file"
              accept="application/pdf"
              className="dashboard-control"
              onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
            />
            {selectedFile ? <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">{selectedFile.name}</p> : null}
            <Button type="button" variant="secondary" onClick={onAddPdf} disabled={savingKey === "pdf"}>
              {savingKey === "pdf" ? "Lädt hoch..." : "PDF in Wissen hochladen"}
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
