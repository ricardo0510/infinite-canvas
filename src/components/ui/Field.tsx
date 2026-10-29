import type { ReactNode } from "react";
import { Select } from "./Control";

type FieldProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

export function Field({ label, children, className }: FieldProps) {
  return (
    <label className={className ? `field ${className}` : "field"}>
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
    <div className="field">
      <span>{label}</span>
      <Select
        value={value}
        options={options.map((option) =>
          typeof option === "string" ? { value: option, label: option } : option,
        )}
        disabled={disabled}
        onChange={onChange}
        ariaLabel={label}
      />
    </div>
  );
}
