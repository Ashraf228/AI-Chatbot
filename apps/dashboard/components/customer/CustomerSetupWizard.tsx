"use client";

import { useEffect, useMemo, useState } from "react";
import { type IndustryTemplate, templatesByKey } from "../../lib/industry-templates";
import {
  createManualKnowledgeSource,
  deleteKnowledgeSource,
  getKnowledgeSources,
  getSite,
  importUrlKnowledgeSource,
  resyncKnowledgeSource,
  setKnowledgeSourceActive,
  setSiteGoLive,
  updateSiteBasics,
  updateSiteBranding,
  updateSiteSettings,
  uploadKnowledgePdf,
} from "../../lib/setup-wizard-api";
import { encodeSiteId } from "../../lib/site-id";
import { resolveWidgetLoaderUrl } from "../../lib/widget-loader-url";
import { ErrorState } from "../shared/ErrorState";
import { LoadingState } from "../shared/LoadingState";
import { CustomerStatusBadge } from "./CustomerStatusBadge";
import {
  mapOverallStatusToTone,
  mapStatusSeverityToTone,
  type CustomerApiStatus,
  type CustomerOverallStatus,
} from "./customer-status";
import {
  CustomerDataStep,
  ConversationFlowStep,
  DesignPrivacyStep,
  KnowledgeStep,
  LaunchStep,
  LeadDeliveryStep,
  STATUS_STEP_GROUPS,
  STEP_EXPLANATIONS,
  UseCaseStep,
  WIZARD_STEPS,
  SetupWizardActions,
  SetupWizardShell,
  SetupWizardSidebar,
  createEmbedCode,
  domainFromUrl,
  isValidEmail,
  normalizeDomains,
  normalizeSite,
  statusForWizardStep,
  wizardStepStatusLabel,
  type CustomerSetupWizardProps,
  type FallbackBehavior,
  type KnowledgeMethod,
  type KnowledgeMode,
  type KnowledgeSource,
  type SiteDetails,
  type TestChatMessage,
} from "./setup-wizard";

export function CustomerSetupWizard({ siteId }: CustomerSetupWizardProps) {
  const siteSlug = encodeSiteId(siteId);
  const [site, setSite] = useState<SiteDetails | null>(null);
  const [templates, setTemplates] = useState<IndustryTemplate[]>([]);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [overallStatus, setOverallStatus] = useState<CustomerOverallStatus | string>("Setup unvollständig");
  const [serverStatus, setServerStatus] = useState<CustomerApiStatus | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [loaderUrl, setLoaderUrl] = useState(
    process.env.NEXT_PUBLIC_WIDGET_LOADER_URL || "http://localhost:8080/loader.js",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [profileForm, setProfileForm] = useState({
    companyName: "",
    botName: "",
    industry: "",
    websiteUrl: "",
    allowedDomains: "",
    supportEmail: "",
    phone: "",
    language: "de" as "de" | "en",
  });
  const [goalForm, setGoalForm] = useState({
    primaryGoal: "" as SiteDetails["primaryGoal"],
    botType: "handwerker-first-contact",
    tone: "" as SiteDetails["tone"],
    knowledgeMode: "flexible" as KnowledgeMode,
    fallbackBehavior: "ask_followup" as FallbackBehavior,
    ctaText: "",
    systemPrompt: "",
  });
  const [deliveryForm, setDeliveryForm] = useState({
    leadCaptureEnabled: true,
    leadNotificationEmail: "",
  });
  const [knowledgeForm, setKnowledgeForm] = useState({
    title: "FAQ",
    question: "",
    content: "",
    url: "",
    urlTitle: "",
  });
  const [knowledgeMethod, setKnowledgeMethod] = useState<KnowledgeMethod>("manual");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [designForm, setDesignForm] = useState({
    brandColor: "#b55400",
    accentColor: "#fff0d9",
    logoUrl: "",
    welcomeMessage: "",
    placeholderText: "Nachricht schreiben...",
    widgetPosition: "bottom_right" as "bottom_right" | "bottom_left",
    launcherLabel: "Chat",
    privacyUrl: "",
    privacyNoticeText: "",
    consentRequired: true,
  });
  const [testQuestion, setTestQuestion] = useState("");
  const [testSessionId, setTestSessionId] = useState("");
  const [testMessages, setTestMessages] = useState<TestChatMessage[]>([]);
  useEffect(() => {
    setLoaderUrl(resolveWidgetLoaderUrl(process.env.NEXT_PUBLIC_WIDGET_LOADER_URL));
  }, []);

  const templateMap = useMemo(() => templatesByKey(templates), [templates]);
  const activeStep = WIZARD_STEPS[activeStepIndex];
  const selectedTemplate = profileForm.industry ? templateMap[profileForm.industry] : undefined;
  const readyActiveSources = sources.filter((source) => source.isActive && source.status === "ready");
  const embedCode = site ? createEmbedCode(loaderUrl, site.siteKey) : "";
  const canGoLive = Boolean(serverStatus?.isLiveReady);
  const liveDone = serverStatus?.lifecycleStatus === "live" || Boolean(site?.goLiveAt);

  async function refreshStatus() {
    const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/status`, { cache: "no-store" });
    const data = (await response.json().catch(() => ({}))) as CustomerApiStatus & { status?: string };
    if (response.ok && data?.code) {
      setOverallStatus(data.status || data.label);
      setServerStatus(data);
    }
  }

  async function refreshSources() {
    const data = await getKnowledgeSources(siteId);
    setSources(Array.isArray(data) ? (data as KnowledgeSource[]) : []);
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [siteData, sourcesData, templatesResponse, statusResponse] = await Promise.all([
        getSite(siteId),
        getKnowledgeSources(siteId),
        fetch("/api/industry-templates", { cache: "no-store" }),
        fetch(`/api/sites/${encodeURIComponent(siteId)}/status`, { cache: "no-store" }),
      ]);
      const templatesData = await templatesResponse.json().catch(() => []);
      const statusData = (await statusResponse.json().catch(() => ({}))) as CustomerApiStatus & { status?: string };
      const nextSite = normalizeSite(siteData as Record<string, unknown>);

      setSite(nextSite);
      setSources(Array.isArray(sourcesData) ? (sourcesData as KnowledgeSource[]) : []);
      setTemplates(Array.isArray(templatesData) ? templatesData : []);
      if (statusResponse.ok && statusData?.code) {
        setOverallStatus(statusData.status || statusData.label);
        setServerStatus(statusData);
      }
      setProfileForm({
        companyName: nextSite.companyName || nextSite.name,
        botName: nextSite.botName,
        industry: nextSite.industry,
        websiteUrl: nextSite.websiteUrl,
        allowedDomains: nextSite.allowedDomains.join("\n"),
        supportEmail: nextSite.supportEmail,
        phone: nextSite.phone,
        language: nextSite.language,
      });
      setGoalForm({
        primaryGoal: nextSite.primaryGoal,
        botType: nextSite.botType || "handwerker-first-contact",
        tone: nextSite.tone,
        knowledgeMode: nextSite.knowledgeMode,
        fallbackBehavior: nextSite.fallbackBehavior,
        ctaText: nextSite.ctaText,
        systemPrompt: nextSite.systemPrompt,
      });
      setDeliveryForm({
        leadCaptureEnabled: nextSite.leadCaptureEnabled,
        leadNotificationEmail: nextSite.leadNotificationEmail,
      });
      setDesignForm({
        brandColor: nextSite.brandColor,
        accentColor: nextSite.accentColor,
        logoUrl: nextSite.logoUrl,
        welcomeMessage: nextSite.welcomeMessage,
        placeholderText: nextSite.placeholderText,
        widgetPosition: nextSite.widgetPosition,
        launcherLabel: nextSite.launcherLabel,
        privacyUrl: nextSite.privacyUrl,
        privacyNoticeText: nextSite.privacyNoticeText,
        consentRequired: nextSite.consentRequired,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [siteId]);

  async function runAction<T>(key: string, action: () => Promise<T>, successMessage: string) {
    setSavingKey(key);
    setError(null);
    setMessage(null);
    try {
      const result = await action();
      setMessage(successMessage);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aktion konnte nicht ausgeführt werden.");
      return null;
    } finally {
      setSavingKey(null);
    }
  }

  async function saveProfile() {
    const rawDomains = normalizeDomains(profileForm.allowedDomains);
    const websiteDomain = domainFromUrl(profileForm.websiteUrl);
    const allowedDomains = rawDomains.length > 0 ? rawDomains : websiteDomain ? [websiteDomain] : [];
    const companyName = profileForm.companyName.trim();

    const saved = await runAction(
      "profile",
      async () => {
        const [siteResult, brandingResult, configResult] = await Promise.all([
          updateSiteBasics(siteId, { name: companyName || site?.name || siteId, allowedDomains }),
          updateSiteBranding(siteId, {
            companyName: companyName || site?.companyName || site?.name || "",
            botName: profileForm.botName.trim() || site?.botName || "Service-Assistent",
            welcomeMessage: designForm.welcomeMessage.trim() || site?.welcomeMessage || "",
          }),
          updateSiteSettings(siteId, {
            websiteUrl: profileForm.websiteUrl.trim(),
            domain: websiteDomain,
            allowedDomains,
            supportEmail: profileForm.supportEmail.trim(),
            phone: profileForm.phone.trim(),
            language: profileForm.language,
          }),
        ]);
        return { siteResult, brandingResult, configResult };
      },
      "Unternehmensprofil gespeichert.",
    );

    if (!saved) {
      return false;
    }

    await load();
    return true;
  }

  async function applyIndustryTemplate() {
    if (!profileForm.industry) {
      setError("Bitte zuerst eine Branche auswählen.");
      return false;
    }

    const template = templateMap[profileForm.industry];
    if (!template) {
      setError("Für diese Branche ist noch keine Vorlage hinterlegt.");
      return false;
    }

    const response = await runAction(
      "template",
      async () => {
        const templateResponse = await fetch(`/api/sites/${encodeURIComponent(siteId)}/apply-template`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId: template.key, mode: "fill_missing_only" }),
        });
        const data = await templateResponse.json().catch(() => ({}));
        if (!templateResponse.ok) {
          throw new Error(typeof data?.message === "string" ? data.message : "Vorlage konnte nicht angewendet werden.");
        }
        return data;
      },
      `Vorlage „${template.label}“ angewendet.`,
    );

    if (!response) {
      return false;
    }
    await load();
    return true;
  }

  async function saveGoal() {
    const saved = await runAction(
      "goal",
      () =>
        updateSiteSettings(siteId, {
          primaryGoal: goalForm.primaryGoal,
          setupGoal: goalForm.primaryGoal,
          industry: profileForm.industry,
          botType: goalForm.botType,
          tone: goalForm.tone,
          knowledgeMode: goalForm.knowledgeMode,
          fallbackBehavior: goalForm.fallbackBehavior,
          ctaText: goalForm.ctaText.trim(),
          systemPrompt: goalForm.systemPrompt.trim(),
        }),
      "KI-Ziel gespeichert.",
    );
    if (!saved) {
      return false;
    }
    setSite((current) =>
      current
        ? {
            ...current,
            primaryGoal: goalForm.primaryGoal,
            setupGoal: goalForm.primaryGoal,
            botType: goalForm.botType,
            tone: goalForm.tone,
            knowledgeMode: goalForm.knowledgeMode,
            fallbackBehavior: goalForm.fallbackBehavior,
            ctaText: goalForm.ctaText,
            systemPrompt: goalForm.systemPrompt,
          }
        : current,
    );
    await refreshStatus();
    return true;
  }

  async function saveDelivery() {
    if (deliveryForm.leadCaptureEnabled && !isValidEmail(deliveryForm.leadNotificationEmail.trim())) {
      setError("Bitte eine gültige Empfänger-E-Mail für neue Anfragen eintragen.");
      return false;
    }

    const saved = await runAction(
      "delivery",
      () =>
        updateSiteSettings(siteId, {
          leadCaptureEnabled: deliveryForm.leadCaptureEnabled,
          leadNotificationEmail: deliveryForm.leadNotificationEmail.trim(),
        }),
      "Anfrage-Zustellung gespeichert.",
    );
    if (!saved) {
      return false;
    }
    setSite((current) =>
      current
        ? {
            ...current,
            leadCaptureEnabled: deliveryForm.leadCaptureEnabled,
            leadNotificationEmail: deliveryForm.leadNotificationEmail.trim(),
          }
        : current,
    );
    await refreshStatus();
    return true;
  }

  async function saveDesign() {
    const saved = await runAction(
      "design",
      async () => {
        const [branding, config] = await Promise.all([
          updateSiteBranding(siteId, {
            brandColor: designForm.brandColor,
            accentColor: designForm.accentColor,
            logoUrl: designForm.logoUrl.trim(),
            welcomeMessage: designForm.welcomeMessage.trim(),
            privacyUrl: designForm.privacyUrl.trim(),
          }),
          updateSiteSettings(siteId, {
            placeholderText: designForm.placeholderText.trim(),
            widgetPosition: designForm.widgetPosition,
            launcherLabel: designForm.launcherLabel.trim(),
            privacyNoticeText: designForm.privacyNoticeText.trim(),
            consentRequired: designForm.consentRequired,
          }),
        ]);
        return { branding, config };
      },
      "Design gespeichert.",
    );
    if (!saved) {
      return false;
    }
    setSite((current) =>
      current
        ? {
            ...current,
            ...designForm,
            consentRequired: designForm.consentRequired,
          }
        : current,
    );
    await refreshStatus();
    return true;
  }

  async function addManualKnowledge() {
    if (!knowledgeForm.content.trim()) {
      setError("Bitte Inhalt für das Wissen eintragen.");
      return;
    }

    const created = await runAction(
      "manual",
      () =>
        createManualKnowledgeSource(siteId, {
          title: knowledgeForm.title.trim() || "Wissen",
          question: knowledgeForm.question.trim() || undefined,
          content: knowledgeForm.content.trim(),
        }),
      "Wissen gespeichert.",
    );
    if (created) {
      setKnowledgeForm((current) => ({ ...current, question: "", content: "" }));
      await refreshSources();
      await refreshStatus();
    }
  }

  async function addUrlKnowledge() {
    if (!knowledgeForm.url.trim()) {
      setError("Bitte Website-URL eintragen.");
      return;
    }

    const imported = await runAction(
      "url",
      () =>
        importUrlKnowledgeSource(siteId, {
          url: knowledgeForm.url.trim(),
          title: knowledgeForm.urlTitle.trim() || undefined,
        }),
      "Website-Wissen importiert.",
    );
    if (imported) {
      setKnowledgeForm((current) => ({ ...current, url: "", urlTitle: "" }));
      await refreshSources();
      await refreshStatus();
    }
  }

  async function addPdfKnowledge() {
    if (!pdfFile) {
      setError("Bitte eine PDF-Datei auswählen.");
      return;
    }

    const uploaded = await runAction("pdf", () => uploadKnowledgePdf(siteId, pdfFile), "PDF verarbeitet.");
    if (uploaded) {
      setPdfFile(null);
      await refreshSources();
      await refreshStatus();
    }
  }

  async function toggleKnowledgeSource(source: KnowledgeSource) {
    const updated = await runAction(
      `source-${source.id}`,
      () => setKnowledgeSourceActive(source.id, !source.isActive),
      source.isActive ? "Wissensquelle deaktiviert." : "Wissensquelle aktiviert.",
    );
    if (updated) {
      await refreshSources();
      await refreshStatus();
    }
  }

  async function resyncSource(source: KnowledgeSource) {
    const updated = await runAction(
      `resync-${source.id}`,
      () => resyncKnowledgeSource(source.id),
      "Wissensquelle wird aktualisiert.",
    );
    if (updated) {
      await refreshSources();
      await refreshStatus();
    }
  }

  async function removeSource(source: KnowledgeSource) {
    const confirmed = window.confirm(`Wissensquelle „${source.title || source.label || source.id}“ wirklich löschen?`);
    if (!confirmed) {
      return;
    }

    const deleted = await runAction(
      `delete-${source.id}`,
      () => deleteKnowledgeSource(source.id),
      "Wissensquelle gelöscht.",
    );
    if (deleted) {
      await refreshSources();
      await refreshStatus();
    }
  }

  async function sendTestMessage() {
    const messageText = testQuestion.trim();
    if (!messageText) {
      setError("Bitte eine Testfrage eingeben.");
      return;
    }

    setSavingKey("test-chat");
    setError(null);
    setTestMessages((current) => [...current, { role: "user", text: messageText }]);
    setTestQuestion("");

    try {
      const response = await fetch(`/api/widget/test-chat/${encodeURIComponent(siteId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageText, sessionId: testSessionId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data?.message === "string" ? data.message : "Test-Chat konnte nicht antworten.");
      }
      setTestSessionId(typeof data.sessionId === "string" ? data.sessionId : testSessionId);
      const answer = typeof data.answer === "string" ? data.answer : "";
      setTestMessages((current) => [
        ...current,
        { role: "assistant", text: answer, sources: Array.isArray(data.sources) ? data.sources : [] },
      ]);
      await updateSiteSettings(siteId, {
        lastTestedAt: new Date().toISOString(),
        lastTestQuestion: messageText,
        lastTestAnswer: answer,
      });
      await load();
      setMessage("Test gespeichert.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test-Chat konnte nicht ausgeführt werden.");
    } finally {
      setSavingKey(null);
    }
  }

  async function copyEmbedCode() {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Einbau-Code konnte nicht kopiert werden.");
    }
  }

  async function goLive() {
    const result = await runAction("live", () => setSiteGoLive(siteId), "Kunde live geschaltet.");
    if (result) {
      await load();
    }
  }

  async function saveCurrentStep() {
    switch (activeStep.key) {
      case "customer":
        return saveProfile();
      case "bot":
        return saveGoal();
      case "delivery":
        return saveDelivery();
      case "design":
        return saveDesign();
      default:
        await refreshStatus();
        return true;
    }
  }

  async function nextStep() {
    const saved = await saveCurrentStep();
    if (saved) {
      setActiveStepIndex((current) => Math.min(current + 1, WIZARD_STEPS.length - 1));
    }
  }

  function jumpToStatusStep(stepKey?: string) {
    const index = WIZARD_STEPS.findIndex((step) => STATUS_STEP_GROUPS[step.key].includes(stepKey || ""));
    if (index >= 0) {
      setActiveStepIndex(index);
    }
  }

  function renderStep() {
    if (!site) {
      return null;
    }

    switch (activeStep.key) {
      case "customer":
        return (
          <CustomerDataStep
            value={profileForm}
            onChange={setProfileForm}
            explanation={STEP_EXPLANATIONS.customer}
            status={statusForWizardStep(serverStatus, "customer")}
            statusLabel={wizardStepStatusLabel(serverStatus, "customer")}
          />
        );

      case "bot":
        return (
          <UseCaseStep
            profileValue={profileForm}
            onProfileChange={setProfileForm}
            goalValue={goalForm}
            onGoalChange={setGoalForm}
            templates={templates}
            selectedTemplate={selectedTemplate}
            templateAppliedAt={site.templateAppliedAt}
            hasTemplateApplied={Boolean(site.templateId)}
            onApplyTemplate={applyIndustryTemplate}
            isApplyingTemplate={savingKey === "template"}
            explanation={STEP_EXPLANATIONS.bot}
            status={statusForWizardStep(serverStatus, "bot")}
            statusLabel={wizardStepStatusLabel(serverStatus, "bot")}
          />
        );

      case "delivery":
        return (
          <LeadDeliveryStep
            value={deliveryForm}
            onChange={setDeliveryForm}
            explanation={STEP_EXPLANATIONS.delivery}
            status={statusForWizardStep(serverStatus, "delivery")}
            statusLabel={wizardStepStatusLabel(serverStatus, "delivery")}
          />
        );

      case "flow":
        return (
          <ConversationFlowStep
            siteSlug={siteSlug}
            explanation={STEP_EXPLANATIONS.flow}
            status={statusForWizardStep(serverStatus, "flow")}
            statusLabel={wizardStepStatusLabel(serverStatus, "flow")}
          />
        );
      case "knowledge":
        return (
          <KnowledgeStep
            siteSlug={siteSlug}
            sources={sources}
            readyActiveSources={readyActiveSources}
            knowledgeMode={goalForm.knowledgeMode}
            selectedMethod={knowledgeMethod}
            onMethodChange={setKnowledgeMethod}
            draft={knowledgeForm}
            onDraftChange={setKnowledgeForm}
            selectedFile={pdfFile}
            onFileChange={setPdfFile}
            savingKey={savingKey}
            onAddManual={addManualKnowledge}
            onAddUrl={addUrlKnowledge}
            onAddPdf={addPdfKnowledge}
            onToggleSource={toggleKnowledgeSource}
            onRefreshSource={resyncSource}
            onRemoveSource={removeSource}
            explanation={STEP_EXPLANATIONS.knowledge}
            status={statusForWizardStep(serverStatus, "knowledge")}
            statusLabel={wizardStepStatusLabel(serverStatus, "knowledge")}
          />
        );

      case "design":
        return (
          <DesignPrivacyStep
            value={designForm}
            onChange={setDesignForm}
            site={site}
            profileCompanyName={profileForm.companyName}
            onSave={saveDesign}
            isSaving={savingKey === "design"}
            explanation={STEP_EXPLANATIONS.design}
            status={statusForWizardStep(serverStatus, "design")}
            statusLabel={wizardStepStatusLabel(serverStatus, "design")}
          />
        );

      case "launch":
        return (
          <LaunchStep
            site={site}
            serverStatus={serverStatus}
            overallStatus={overallStatus}
            embedCode={embedCode}
            copiedEmbedCode={copied}
            testQuestion={testQuestion}
            testMessages={testMessages}
            savingKey={savingKey}
            canGoLive={canGoLive}
            isLive={liveDone}
            explanation={STEP_EXPLANATIONS.launch}
            status={statusForWizardStep(serverStatus, "launch")}
            statusLabel={wizardStepStatusLabel(serverStatus, "launch")}
            onChangeTestQuestion={setTestQuestion}
            onSendTestMessage={sendTestMessage}
            onCopyEmbedCode={copyEmbedCode}
            onGoLive={goLive}
            onJumpToStatusStep={jumpToStatusStep}
          />
        );
    }
  }

  if (loading) {
    return <LoadingState />;
  }

  if (!site) {
    return <ErrorState message={error || "Kundendaten konnten nicht geladen werden."} />;
  }

  return (
    <SetupWizardShell
      title="Setup-Assistent"
      description="Führe den Kunden in sieben klaren Schritten bis zu Test und Livegang."
      sidebar={
        <SetupWizardSidebar
          siteId={siteId}
          steps={WIZARD_STEPS}
          activeStepIndex={activeStepIndex}
          status={serverStatus}
          onStepChange={setActiveStepIndex}
        />
      }
      actions={
        <SetupWizardActions
          onBack={() => setActiveStepIndex((current) => Math.max(current - 1, 0))}
          onSave={saveCurrentStep}
          onSkip={activeStep.key !== "launch" ? () => setActiveStepIndex((current) => current + 1) : undefined}
          onPrimary={activeStep.key === "launch" ? goLive : nextStep}
          primaryLabel={activeStep.key === "launch" ? "Chatfenster live schalten" : "Speichern & weiter"}
          isSaving={Boolean(savingKey)}
          backDisabled={activeStepIndex === 0}
          primaryDisabled={activeStep.key === "launch" && (!canGoLive || liveDone)}
        />
      }
    >
      <section className="dashboard-card dashboard-card--compact dashboard-stack">
        <div className="dashboard-inline dashboard-inline--spaced dashboard-wrap">
          <div>
            <strong>
              Schritt {activeStepIndex + 1} von {WIZARD_STEPS.length}: {activeStep.label}
            </strong>
            <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
              {serverStatus?.progress ?? 0}% bereit
            </p>
          </div>
          <CustomerStatusBadge
            status={serverStatus ? mapStatusSeverityToTone(serverStatus.severity) : mapOverallStatusToTone(overallStatus)}
            label={serverStatus?.label || overallStatus}
          />
        </div>
        <progress className="dashboard-setup-progress__meter" value={serverStatus?.progress ?? 0} max={100} />
      </section>

      {message ? <p className="dashboard-status dashboard-status--success">{message}</p> : null}
      {error ? <ErrorState message={error} /> : null}

      {renderStep()}
    </SetupWizardShell>
  );
}
