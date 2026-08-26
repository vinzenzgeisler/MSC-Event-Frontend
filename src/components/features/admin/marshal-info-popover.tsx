import { useEffect, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";

export function MarshalInfoPopover({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent | MouseEvent) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof MouseEvent && rootRef.current?.contains(event.target as Node)) return;
      setOpen(false); buttonRef.current?.focus();
    };
    document.addEventListener("keydown", close); document.addEventListener("mousedown", close);
    return () => { document.removeEventListener("keydown", close); document.removeEventListener("mousedown", close); };
  }, [open]);
  return <span ref={rootRef} className="relative inline-flex"><button ref={buttonRef} type="button" aria-label={label} aria-expanded={open} className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => setOpen((value) => !value)}><Info className="h-4 w-4" /></button>{open && <span role="dialog" className="absolute left-0 top-11 z-20 w-64 max-w-[calc(100vw-2rem)] rounded-lg border bg-white p-3 text-sm font-normal text-slate-700 shadow-lg">{children}</span>}</span>;
}
