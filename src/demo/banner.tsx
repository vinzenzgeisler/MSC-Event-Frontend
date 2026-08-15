import { isDemoMode } from "@/demo/config";

export function DemoModeBanner() {
  if (!isDemoMode) return null;

  return (
    <div className="sticky top-0 z-[100] border-b border-amber-400 bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-950 shadow-sm">
      Demo-Modus · ausschließlich lokale Beispieldaten · Änderungen werden nicht dauerhaft gespeichert und beim Neuladen zurückgesetzt
    </div>
  );
}
