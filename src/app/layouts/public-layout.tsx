import { Outlet } from "react-router-dom";

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-blue-700 text-white">
        <div className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-14">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex rounded bg-yellow-400 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-900">12./13. September 2026</div>
            <h1 className="text-3xl font-semibold md:text-5xl">12. Oberlausitzer Dreieck</h1>
            <p className="text-sm text-blue-100 md:text-lg">
              Einfache und verständliche Online-Anmeldung für Fahrer und Teams. Schritt für Schritt, mobil optimiert und backend-ready.
            </p>
            <div className="flex flex-wrap gap-2 text-xs md:text-sm">
              <span className="rounded border border-blue-400 bg-blue-800/40 px-3 py-1">Mehrfachstarter</span>
              <span className="rounded border border-blue-400 bg-blue-800/40 px-3 py-1">Klare Validierung</span>
              <span className="rounded border border-blue-400 bg-blue-800/40 px-3 py-1">Direkt für Admin nutzbar</span>
            </div>
          </div>
        </div>
      </section>
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
        <Outlet />
      </main>
    </div>
  );
}
