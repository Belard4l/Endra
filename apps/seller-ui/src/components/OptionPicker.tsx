"use client";
import { rwf } from "@/lib/format";
import type { OptionGroup } from "@/lib/types";

const OptionPicker = ({
  groups,
  value,
  onChange,
}: {
  groups: OptionGroup[];
  value: Record<string, string[]>;
  onChange: (v: Record<string, string[]>) => void;
}) => (
  <div className="space-y-4">
    {groups.map((g) => (
      <div key={g.id}>
        <p className="label">
          {g.name} {g.required && <span className="text-brand-700">*</span>}
          <span className="ml-1 font-normal text-stone-400">({g.type === "single" ? "choose one" : "choose any"})</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {g.choices.map((c) => {
            const selected = (value[g.id] || []).includes(c.id);
            return (
              <button
                type="button"
                key={c.id}
                onClick={() => {
                  const cur = value[g.id] || [];
                  const next = g.type === "single" ? (selected && !g.required ? [] : [c.id]) : selected ? cur.filter((x) => x !== c.id) : [...cur, c.id];
                  onChange({ ...value, [g.id]: next });
                }}
                className={`rounded-lg border px-3 py-2 text-sm transition ${selected ? "border-brand-600 bg-brand-50 text-brand-800" : "border-stone-300 bg-white hover:border-stone-400"}`}
              >
                {c.label}
                {c.priceDelta !== 0 && <span className="ml-1 text-stone-500">{c.priceDelta > 0 ? "+" : "−"}{rwf(Math.abs(c.priceDelta))}</span>}
              </button>
            );
          })}
        </div>
      </div>
    ))}
  </div>
);

export default OptionPicker;
