import { Outlet } from "react-router-dom";

export function PublicLayout() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">MSC Event</div>
        <h1 className="text-3xl font-bold">Öffentliche Anmeldung</h1>
      </header>
      <Outlet />
    </div>
  );
}
