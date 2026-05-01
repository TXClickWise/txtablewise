// Number input that allows the field to be temporarily empty while editing
// (so backspace works as users expect). Commits to parent only when a valid
// number is parsed; on blur, snaps to fallback if left empty/invalid.
import { forwardRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number | null | undefined;
  onChange: (value: number) => void;
  /** Value used when the user blurs an empty/invalid input. Defaults to min ?? 0. */
  fallback?: number;
  min?: number;
  max?: number;
  step?: number;
  allowDecimal?: boolean;
};

export const NumberInput = forwardRef<HTMLInputElement, Props>(function NumberInput(
  { value, onChange, fallback, min, max, step, allowDecimal = false, onBlur, ...rest },
  ref,
) {
  const [text, setText] = useState<string>(value == null || Number.isNaN(value) ? "" : String(value));

  // Sync from parent when the parent value changes externally and differs from current text
  useEffect(() => {
    const parsed = text === "" ? null : Number(text);
    if (parsed !== value) {
      setText(value == null || Number.isNaN(value) ? "" : String(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Input
      ref={ref}
      type="number"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      min={min}
      max={max}
      step={step ?? (allowDecimal ? "any" : 1)}
      value={text}
      onChange={(e) => {
        const v = e.target.value;
        setText(v);
        if (v === "") return; // allow empty during editing
        const n = allowDecimal ? parseFloat(v) : parseInt(v, 10);
        if (Number.isFinite(n)) onChange(n);
      }}
      onBlur={(e) => {
        if (text === "" || !Number.isFinite(Number(text))) {
          const fb = fallback ?? min ?? 0;
          setText(String(fb));
          onChange(fb);
        }
        onBlur?.(e);
      }}
      {...rest}
    />
  );
});
