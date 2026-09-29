import { useCallback, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Ersetzt `window.confirm()` (kein natives Aussehen, keine Formatierung, auf Dauer wirkt es wie
 * "letztes Jahrhundert") 1:1 durch ein echtes Dialog: `if (!window.confirm(msg)) return` wird zu
 * `if (!(await confirm(msg))) return` - der aufrufende Code bleibt sonst unverändert. `{node}` muss
 * einmal irgendwo im JSX der Komponente gerendert werden, die `confirm` nutzt.
 */
export function useConfirm() {
  const [state, setState] = useState<{ title: string; description: string; confirmLabel: string; resolve: (value: boolean) => void } | null>(null);

  const confirm = useCallback(
    (description: string, options?: { title?: string; confirmLabel?: string }) =>
      new Promise<boolean>((resolve) => {
        setState({
          title: options?.title ?? "Bist du sicher?",
          description,
          confirmLabel: options?.confirmLabel ?? "Bestätigen",
          resolve,
        });
      }),
    [],
  );

  const settle = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  const node = (
    <AlertDialog open={state !== null} onOpenChange={(open) => { if (!open) settle(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state?.title}</AlertDialogTitle>
          <AlertDialogDescription>{state?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={() => settle(true)}>{state?.confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, node };
}
