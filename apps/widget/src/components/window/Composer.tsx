import { useState } from "react";
import { Button } from "../shared/Button";
import { Input } from "../shared/Input";

type ComposerProps = {
  placeholder: string;
  disabled?: boolean;
  onSubmit: (value: string) => void | Promise<void>;
};

export function Composer({ placeholder, disabled, onSubmit }: ComposerProps) {
  const [value, setValue] = useState("");

  async function handleSubmit() {
    const nextValue = value.trim();

    if (!nextValue || disabled) {
      return;
    }

    setValue("");
    await onSubmit(nextValue);
  }

  return (
    <div className="ssb-composer">
      <Input
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            void handleSubmit();
          }
        }}
      />
      <Button type="button" disabled={disabled} onClick={() => void handleSubmit()}>
        Senden
      </Button>
    </div>
  );
}
