import { useEffect, useRef, useState } from "react";
import { Button } from "../shared/Button";

type ComposerProps = {
  placeholder: string;
  disabled?: boolean;
  onSubmit: (value: string) => void | Promise<void>;
};

const MAX_MESSAGE_LENGTH = 800;

export function Composer({ placeholder, disabled, onSubmit }: ComposerProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const shouldRefocusRef = useRef(false);

  useEffect(() => {
    if (!disabled && shouldRefocusRef.current) {
      inputRef.current?.focus();
      shouldRefocusRef.current = false;
    }
  }, [disabled]);

  async function handleSubmit() {
    const nextValue = value.trim();

    if (!nextValue || disabled) {
      return;
    }

    shouldRefocusRef.current = true;
    setValue("");
    await onSubmit(nextValue);
  }

  return (
    <div className="ssb-composer">
      <textarea
        ref={inputRef}
        className="ssb-input ssb-composer__textarea"
        value={value}
        placeholder={placeholder || "Nachricht schreiben..."}
        disabled={disabled}
        maxLength={MAX_MESSAGE_LENGTH}
        rows={1}
        autoFocus
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void handleSubmit();
          }
        }}
      />
      <Button
        type="button"
        className="ssb-composer__send"
        disabled={disabled || !value.trim()}
        aria-label="Nachricht senden"
        onClick={() => void handleSubmit()}
      >
        <span>Senden</span>
      </Button>
      {value.length > MAX_MESSAGE_LENGTH * 0.85 ? (
        <div className="ssb-composer__limit" aria-live="polite">
          {value.length}/{MAX_MESSAGE_LENGTH}
        </div>
      ) : null}
    </div>
  );
}
