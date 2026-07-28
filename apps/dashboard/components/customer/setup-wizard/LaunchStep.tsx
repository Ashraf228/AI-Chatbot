import { AssistantProfileDiagnosticsCard } from "./AssistantProfileDiagnosticsCard";
import { ConversationEngineCompareCard } from "./ConversationEngineCompareCard";
import { ConversationEnginePreviewCard } from "./ConversationEnginePreviewCard";
import { ConversationEngineResponsePreviewCard } from "./ConversationEngineResponsePreviewCard";
import { ConversationEngineTestCasesCard } from "./ConversationEngineTestCasesCard";
import { DemoWorkspaceAgentBuilderCard } from "./DemoWorkspaceAgentBuilderCard";
import type { DashboardSessionRole } from "../../../lib/auth";
import type { CustomerApiStatus, CustomerOverallStatus, CustomerStatusTone } from "../customer-status";
import { EmbedCodePanel } from "./EmbedCodePanel";
import { GoLivePanel } from "./GoLivePanel";
import { LaunchReadinessPanel } from "./LaunchReadinessPanel";
import { SetupAdvancedDetails } from "./SetupAdvancedDetails";
import { SetupStepHeader } from "./SetupStepHeader";
import { TestChatPanel } from "./TestChatPanel";
import type { SiteDetails, TestChatMessage } from "./setupWizardTypes";

type LaunchStepProps = {
  site: SiteDetails;
  serverStatus: CustomerApiStatus | null;
  overallStatus: CustomerOverallStatus | string;
  embedCode: string;
  copiedEmbedCode: boolean;
  testQuestion: string;
  testMessages: TestChatMessage[];
  savingKey: string | null;
  canGoLive: boolean;
  isLive: boolean;
  explanation?: string;
  status: CustomerStatusTone;
  statusLabel?: string;
  onChangeTestQuestion: (value: string) => void;
  onSendTestMessage: () => void;
  onCopyEmbedCode: () => void;
  onGoLive: () => void;
  onJumpToStatusStep: (stepKey?: string) => void;
  dashboardRole?: DashboardSessionRole | null;
};

export function LaunchStep({
  site,
  serverStatus,
  overallStatus,
  embedCode,
  copiedEmbedCode,
  testQuestion,
  testMessages,
  savingKey,
  canGoLive,
  isLive,
  explanation,
  status,
  statusLabel,
  onChangeTestQuestion,
  onSendTestMessage,
  onCopyEmbedCode,
  onGoLive,
  onJumpToStatusStep,
  dashboardRole,
}: LaunchStepProps) {
  const canUseAdminTestTools = dashboardRole === "admin" || dashboardRole === "operator";

  return (
    <section className="dashboard-card dashboard-stack launch-step" id="setup-step-live">
      <SetupStepHeader
        title="Review & Livegang"
        description="Prüfe Setup-Stand, internen Testpfad und Aktivierungsgrenzen. Dieser Schritt schaltet nichts live."
        explanation={explanation}
        status={status}
        statusLabel={statusLabel}
      />

      <LaunchReadinessPanel
        status={serverStatus}
        overallStatus={overallStatus}
        canGoLive={canGoLive}
        isLive={isLive}
        onJumpToStatusStep={onJumpToStatusStep}
      />

      <div className="setup-module-card dashboard-stack dashboard-stack--sm">
        <div>
          <h3 className="dashboard-card-title dashboard-card-title--sm">Interne Prüfung</h3>
          <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
            Hier prüfst du Testchat und Einbau-Code intern. Kein Public Widget, kein Deploy und keine Production-Aktivierung.
          </p>
        </div>
        <div className="launch-step__grid">
          <TestChatPanel
            messages={testMessages}
            input={testQuestion}
            lastTestedAt={site.lastTestedAt}
            isLoading={savingKey === "test-chat"}
            onChangeInput={onChangeTestQuestion}
            onSend={onSendTestMessage}
          />
          <EmbedCodePanel
            embedCode={embedCode}
            allowedDomains={site.allowedDomains}
            copied={copiedEmbedCode}
            onCopy={onCopyEmbedCode}
          />
        </div>
      </div>

      {canUseAdminTestTools ? (
        <SetupAdvancedDetails
          title="Advanced Diagnostics"
          description="Technische Diagnose bleibt verfügbar, ist aber nicht Teil des normalen Go-Live-Checks. Alle Bereiche sind intern, test-only und ohne Deploy-/Public-Widget-Freigabe."
        >
          <AssistantProfileDiagnosticsCard siteId={site.id} />
          <ConversationEngineTestCasesCard siteId={site.id} />
          <ConversationEnginePreviewCard siteId={site.id} />
          <ConversationEngineCompareCard siteId={site.id} />
          <ConversationEngineResponsePreviewCard siteId={site.id} />
          <DemoWorkspaceAgentBuilderCard siteId={site.id} />
        </SetupAdvancedDetails>
      ) : null}

      <GoLivePanel canGoLive={canGoLive} isLive={isLive} isLoading={savingKey === "live"} onGoLive={onGoLive} />
    </section>
  );
}
