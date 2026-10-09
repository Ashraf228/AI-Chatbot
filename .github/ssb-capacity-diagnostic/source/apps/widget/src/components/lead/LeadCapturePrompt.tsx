type LeadCapturePromptProps = {
  onOpen: () => void | Promise<void>;
};

export function LeadCapturePrompt({ onOpen }: LeadCapturePromptProps) {
  return (
    <div className="ssb-lead-prompt">
      <div className="ssb-lead-prompt__text">
        Wenn Sie möchten, können Sie <button type="button" className="ssb-lead-prompt__link" onClick={() => void onOpen()}>hier Ihre Kontaktdaten hinterlassen</button> und wir melden uns bei Ihnen.
      </div>
    </div>
  );
}
