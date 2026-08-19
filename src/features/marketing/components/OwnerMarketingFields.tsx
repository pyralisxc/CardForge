import { Target } from "lucide-react";

export const ownerMarketingFieldClassName =
  "min-h-11 w-full border border-[#5f4526] bg-[#0c0b09] px-3 py-2 text-sm text-[#ffe7ad] placeholder:text-[#6f5b3a]";

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
    <div className="border border-[#4a3823] bg-[#100c08] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.14em] text-[#a98a55]">
          {label}
        </span>
        <Icon className="h-4 w-4 text-[#e2aa4a]" />
      </div>
      <strong className="mt-2 block font-serif text-2xl text-[#fff1c7]">
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
    <label className="grid gap-1 text-xs text-[#c7b288]">
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
    <label className="grid gap-1 text-xs text-[#c7b288]">
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
    <label className="grid gap-1 text-xs text-[#c7b288]">
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
