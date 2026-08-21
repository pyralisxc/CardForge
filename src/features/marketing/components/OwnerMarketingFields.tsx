import { Target } from "lucide-react";

export const ownerMarketingFieldClassName =
  "min-h-11 w-full border border-[var(--cf-border)] bg-[var(--cf-canvas)] px-3 py-2 text-sm text-[var(--cf-accent-text)] placeholder:text-[#6f5b3a]";

export function OwnerMarketingMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Target;
  label: string;
  value: number;
}) {
  return (
    <div className="border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--cf-text-subtle)]">
          {label}
        </span>
        <Icon className="h-4 w-4 text-[var(--cf-accent-strong)]" />
      </div>
      <strong className="mt-2 block font-serif text-2xl text-[var(--cf-text-strong)]">
        {value}
      </strong>
    </div>
  );
}

export function OwnerMarketingTextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="grid gap-1 text-xs text-[var(--cf-text-muted)]">
      {label}
      <input
        className={ownerMarketingFieldClassName}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function OwnerMarketingTextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs text-[var(--cf-text-muted)]">
      {label}
      <textarea
        className={`${ownerMarketingFieldClassName} min-h-24`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function OwnerMarketingSelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1 text-xs text-[var(--cf-text-muted)]">
      {label}
      <select
        className={ownerMarketingFieldClassName}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
