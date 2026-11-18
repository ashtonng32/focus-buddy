"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { Light } from "@/components/screens";
import { Pill } from "@/components/pill";
import { DEFAULTS, useAppState, type Settings } from "@/lib/app-state";

const GROUPS: { title: string; fields: { key: keyof Settings; label: string }[] }[] = [
  {
    title: "Work timers",
    fields: [
      { key: "low", label: "Low" },
      { key: "steady", label: "Motivated" },
      { key: "flow", label: "Flow" },
    ],
  },
  {
    title: "Breaks and switches",
    fields: [
      { key: "keepGoing", label: "Keep going adds" },
      { key: "break", label: "Break" },
      { key: "switch", label: "Something else" },
    ],
  },
];

export function SettingsForm() {
  const app = useAppState();
  if (!app.ready) return <Light />;
  return <Form initial={app.settings} onSave={app.saveSettings} />;
}

function Form({ initial, onSave }: { initial: Settings; onSave: (s: Settings) => Promise<void> }) {
  const [values, setValues] = useState<Record<keyof Settings, string>>(
    () => Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, String(v)])) as Record<keyof Settings, string>,
  );
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function save() {
    const next = { ...DEFAULTS };
    for (const g of GROUPS)
      for (const { key } of g.fields) {
        const n = Number(values[key]);
        next[key] = Number.isFinite(n) && n > 0 ? n : DEFAULTS[key];
      }
    setSaving(true);
    try {
      await onSave(next);
      setError(false);
      setSaved(true);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Light>
      <div className="flex items-center gap-3">
        <Link
          href="/"
          aria-label="Back"
          className="flex size-11 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-[#e3dcf8]"
        >
          <ArrowLeft className="size-5 text-[#3d2a91]" />
        </Link>
        <h1 className="font-display text-[2.2rem] leading-none">Settings</h1>
      </div>
      <p className="text-[#6c6290]">How long each timer runs, in minutes.</p>

      {GROUPS.map((g) => (
        <section key={g.title} className="rounded-[1.75rem] bg-white p-5 shadow-[0_12px_30px_-22px_rgba(60,40,140,0.6)]">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#8a7fb5]">{g.title}</h2>
          {g.fields.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-4 border-t border-[#efeaff] py-3 first:border-t-0">
              <label htmlFor={key} className="text-lg">
                {label}
              </label>
              <div className="flex items-center gap-2">
                <input
                  id={key}
                  type="number"
                  inputMode="decimal"
                  min="0.5"
                  step="any"
                  className="h-12 w-24 rounded-full bg-[#f3efff] px-4 text-center text-lg font-semibold outline-none ring-[#8d74f5] focus:ring-2"
                  value={values[key]}
                  onChange={(e) => {
                    setSaved(false);
                    setValues({ ...values, [key]: e.target.value });
                  }}
                />
                <span className="w-8 text-sm text-[#8a7fb5]">min</span>
              </div>
            </div>
          ))}
        </section>
      ))}

      {error && <p className="text-center text-sm text-[#6c6290]">That didn&apos;t save. Try again?</p>}
      <Pill onClick={save} disabled={saving} variant={saved ? "success" : "solid"} className="mt-auto" aria-live="polite">
        {saved ? (
          <>
            <Check className="pop size-6" strokeWidth={3} /> Saved
          </>
        ) : (
          "Save"
        )}
      </Pill>
    </Light>
  );
}
