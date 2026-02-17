export function EmptyState({ message }: { message: string }) {
  return <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{message}</div>;
}
