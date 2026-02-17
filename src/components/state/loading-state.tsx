export function LoadingState({ label = "Lade Daten..." }: { label?: string }) {
  return <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">{label}</div>;
}
