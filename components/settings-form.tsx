"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULTS, getSettings, saveSettings, type Settings } from "@/lib/settings";

const FIELDS: { key: keyof Settings; label: string }[] = [
  { key: "low", label: "Low" },
  { key: "steady", label: "Steady" },
  { key: "flow", label: "Flow" },
  { key: "keepGoing", label: "Keep going" },
  { key: "break", label: "Break" },
  { key: "switch", label: "Switch" },
];

export function SettingsForm() {
  const [values, setValues] = useState<Record<keyof Settings, string>>(() => {
    const s = getSettings();
    return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, String(v)])) as Record<
      keyof Settings,
      string
    >;
  });
  const [saved, setSaved] = useState(false);

  function save() {
    const next = { ...DEFAULTS };
    for (const { key } of FIELDS) {
      const n = Number(values[key]);
      next[key] = Number.isFinite(n) && n > 0 ? n : DEFAULTS[key];
    }
    saveSettings(next);
    setSaved(true);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-6">
      <h1 className="text-3xl font-semibold">Settings</h1>
      <p className="text-muted-foreground">Minutes for each block. Use 1 while testing.</p>
      {FIELDS.map(({ key, label }) => (
        <div key={key} className="flex items-center justify-between gap-4">
          <Label htmlFor={key} className="text-lg">
            {label}
          </Label>
          <Input
            id={key}
            type="number"
            inputMode="decimal"
            min="0.5"
            step="any"
            className="h-12 w-28 text-lg"
            value={values[key]}
            onChange={(e) => {
              setSaved(false);
              setValues({ ...values, [key]: e.target.value });
            }}
          />
        </div>
      ))}
      <Button className="h-14 text-lg" onClick={save}>
        {saved ? "Saved" : "Save"}
      </Button>
      <Link href="/" className="text-center text-sm text-muted-foreground underline">
        Back
      </Link>
    </main>
  );
}
