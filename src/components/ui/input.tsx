import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Smart numeric mode:
 * When `type="number"`, we keep an internal text buffer so users can clear the
 * field with Backspace even when the parent state defaults to a number (e.g. `1`).
 * The parent's `onChange` is still called, but only with synthetic events whose
 * `target.value` is the raw string the user typed. This mirrors native behavior
 * and preserves backwards compatibility with `parseInt(e.target.value) || N`
 * patterns (empty string yields NaN → `|| N` → fallback) while still allowing
 * the input itself to display an empty field during editing.
 */
const NumericInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ value, defaultValue, onChange, onBlur, ...props }, ref) => {
    const stringify = (v: unknown) =>
      v === undefined || v === null || (typeof v === "number" && Number.isNaN(v))
        ? ""
        : String(v);

    const [text, setText] = React.useState<string>(() =>
      value !== undefined ? stringify(value) : stringify(defaultValue),
    );

    // Sync from parent when its committed value differs from our buffer's number.
    React.useEffect(() => {
      if (value === undefined) return;
      const incoming = stringify(value);
      const currentNum = text === "" ? null : Number(text);
      const incomingNum = incoming === "" ? null : Number(incoming);
      if (currentNum !== incomingNum) setText(incoming);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    return (
      <input
        ref={ref}
        type="number"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange?.(e);
        }}
        onBlur={(e) => {
          // If the field was left empty/invalid, force a re-sync from parent on next render.
          if (text === "" && value !== undefined && value !== null && value !== "") {
            setText(stringify(value));
          }
          onBlur?.(e);
        }}
        {...props}
      />
    );
  },
);
NumericInput.displayName = "NumericInput";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    const classes = cn(
      "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
      className,
    );
    if (type === "number") {
      return <NumericInput ref={ref} className={classes} {...props} />;
    }
    return <input type={type} className={classes} ref={ref} {...props} />;
  },
);
Input.displayName = "Input";

export { Input };
