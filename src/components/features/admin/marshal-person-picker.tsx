import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { MarshalPerson } from "@/types/admin-marshals";

export function MarshalPersonPicker({ people, value, onChange, disabled = false, placeholder = "Person suchen…", "aria-label": ariaLabel }: {
  people: MarshalPerson[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  "aria-label"?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const selected = people.find((person) => person.id === value) ?? null;
  const selectedLabel = selected ? formatPerson(selected) : "";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(selectedLabel);
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchTerm = query === selectedLabel ? "" : normalize(query);
  const results = people.filter((person) => {
    if (!searchTerm) return true;
    return normalize(`${person.lastName} ${person.firstName} ${person.helperNumber}`).includes(searchTerm);
  }).slice(0, 50);

  useEffect(() => {
    if (!open) setQuery(selectedLabel);
  }, [open, selectedLabel]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex((index) => index >= results.length ? -1 : index);
  }, [open, query, results.length]);

  useEffect(() => {
    function handleOutsidePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", handleOutsidePointerDown);
  }, []);

  if (disabled) {
    return <span className="flex min-h-10 items-center break-words rounded-md border bg-slate-50 px-2 text-sm font-normal text-slate-700">{selectedLabel || placeholder}</span>;
  }

  function select(person: MarshalPerson) {
    onChange(person.id);
    setQuery(formatPerson(person));
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      if (!open) return;
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (results.length === 0) return;
      setActiveIndex((index) => {
        if (event.key === "ArrowDown") return index < results.length - 1 ? index + 1 : 0;
        return index > 0 ? index - 1 : results.length - 1;
      });
      return;
    }

    if (event.key === "Enter" && open && activeIndex >= 0 && results[activeIndex]) {
      event.preventDefault();
      select(results[activeIndex]);
    }
  }

  const activeOptionId = activeIndex >= 0 && results[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined;

  return (
    <div ref={rootRef} className="relative min-w-0 text-sm font-normal text-slate-950">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        autoComplete="off"
        className="h-10 w-full min-w-0 rounded-md border bg-white px-2 pr-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onKeyDown={handleKeyDown}
      />
      {selected && (
        <button
          type="button"
          aria-label="Personenauswahl leeren"
          className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded text-lg leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onChange(null);
            setQuery("");
            setOpen(true);
            setActiveIndex(-1);
            inputRef.current?.focus();
          }}
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
      {open && (
        <div id={listboxId} role="listbox" className="absolute left-0 top-11 z-20 max-h-64 w-full min-w-64 overflow-y-auto rounded-md border bg-white py-1 shadow-lg">
          {results.map((person, index) => (
            <div
              id={`${listboxId}-option-${index}`}
              key={person.id}
              role="option"
              aria-selected={person.id === value}
              className={`cursor-pointer truncate px-3 py-2 ${index === activeIndex ? "bg-blue-50 text-blue-900" : "hover:bg-slate-50"}`}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => select(person)}
            >
              {formatPerson(person)}
            </div>
          ))}
          {results.length === 0 && <div className="px-3 py-2 text-slate-500">Keine Person gefunden</div>}
        </div>
      )}
    </div>
  );
}

function formatPerson(person: MarshalPerson) {
  return `${person.lastName}, ${person.firstName} · Nr. ${person.helperNumber}`;
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("de");
}
