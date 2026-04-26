type LeadCapturePromptProps = {
  onOpen: () => void | Promise<void>;
};

export function LeadCapturePrompt({ onOpen }: LeadCapturePromptProps) {
  return (
    <div className="ssb-lead-prompt">
      <div className="ssb-lead-prompt__text">
        Wenn du magst, kannst du <button type="button" className="ssb-lead-prompt__link" onClick={() => void onOpen()}>hier deine Kontaktdaten hinterlassen</button> und wir melden uns direkt bei dir.
      </div>
    </div>
  );
}
