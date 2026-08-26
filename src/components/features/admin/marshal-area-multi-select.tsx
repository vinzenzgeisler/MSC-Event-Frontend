import { useMemo } from "react";
import type { MarshalHelperArea } from "@/types/admin-marshals";

const normalizeKey = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("de");

export function getMarshalAreaOptions(areas: MarshalHelperArea[]) {
  const configured = [...areas].sort((a, b) => a.sortOrder - b.sortOrder).reduce<Array<{ value: string; aliases: string[] }>>((result, area) => {
    const existing = result.find((option) => normalizeKey(option.value) === normalizeKey(area.name));
    if (existing) existing.aliases.push(area.code);
    else result.push({ value: area.name.trim(), aliases: [area.name, area.code] });
    return result;
  }, []);
  const hasTrack = configured.some((option) => option.aliases.some((alias) => ["strecke", "streckenposten"].includes(normalizeKey(alias))));
  return hasTrack ? configured : [{ value: "Strecke", aliases: ["Strecke", "Streckenposten", "track", "marshal"] }, ...configured];
}

export function canonicalizeMarshalAreas(values: string[], areas: MarshalHelperArea[]) {
  const options = getMarshalAreaOptions(areas);
  const aliases = new Map(options.flatMap((option) => option.aliases.map((alias) => [normalizeKey(alias), option.value] as const)));
  const unique = new Map<string, string>();
  for (const raw of values) {
    const trimmed = raw.trim().replace(/\s+/g, " ");
    if (!trimmed) continue;
    const canonical = aliases.get(normalizeKey(trimmed)) ?? trimmed;
    unique.set(normalizeKey(canonical), canonical);
  }
  return [...unique.values()];
}

export function MarshalAreaMultiSelect({ areas, value, disabled, onChange }: { areas: MarshalHelperArea[]; value: string[]; disabled?: boolean; onChange: (value: string[]) => void }) {
  const canonical = useMemo(() => canonicalizeMarshalAreas(value, areas), [areas, value]);
  const configured = getMarshalAreaOptions(areas).map((option) => option.value);
  const legacy = canonical.filter((item) => !configured.includes(item));
  const options = [...configured, ...legacy];
  return <fieldset className="grid gap-2 sm:grid-cols-2" disabled={disabled}>
    <legend className="mb-1 text-xs font-medium text-slate-600">Bereiche</legend>
    {options.map((option) => {
      const checked = canonical.includes(option);
      return <label key={option} className="flex min-h-10 items-center gap-2 rounded-md border bg-white px-3 text-sm">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked ? canonicalizeMarshalAreas([...canonical, option], areas) : canonical.filter((item) => item !== option))} />
        <span className="min-w-0 break-words">{option}{legacy.includes(option) && <span className="ml-1 text-xs text-amber-700">(bisher)</span>}</span>
      </label>;
    })}
  </fieldset>;
}
