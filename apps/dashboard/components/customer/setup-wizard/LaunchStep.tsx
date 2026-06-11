import type { CustomerApiStatus, CustomerOverallStatus, CustomerStatusTone } from "../customer-status";
import { EmbedCodePanel } from "./EmbedCodePanel";
import { GoLivePanel } from "./GoLivePanel";
import { LaunchReadinessPanel } from "./LaunchReadinessPanel";
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
}: LaunchStepProps) {
  return (
    <section className="dashboard-card dashboard-stack launch-step" id="setup-step-live">
      <SetupStepHeader
        title="Test & Livegang"
        description="Teste das Gespräch, kopiere den Einbau-Code und schalte das Chatfenster live."
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

      <GoLivePanel canGoLive={canGoLive} isLive={isLive} isLoading={savingKey === "live"} onGoLive={onGoLive} />
    </section>
  );
}
