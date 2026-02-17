export function ErrorState({ title = "Fehler", message }: { title?: string; message: string }) {
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
      <div className="font-semibold">{title}</div>
      <div>{message}</div>
    </div>
  );
}
