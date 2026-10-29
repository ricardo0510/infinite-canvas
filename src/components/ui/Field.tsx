import type { ReactNode } from "react";

type FieldProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

export function Field({ label, children, className }: FieldProps) {
  return (
    <label className={className ? `ai-field ${className}` : "ai-field"}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export type SelectOption = string | { value: string; label: string };

type SelectFieldProps = {
  label: string;
  value: string;
  options: readonly SelectOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
};

export function SelectField({ label, value, options, disabled, onChange }: SelectFieldProps) {
  return (
    <Field label={label}>
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => {
          const optionValue = typeof option === "string" ? option : option.value;
          const optionLabel = typeof option === "string" ? option : option.label;
          return (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          );
        })}
      </select>
    </Field>
  );
}
