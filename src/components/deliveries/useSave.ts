import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/delivery-actions";

// Runs a save and keeps its error beside the form that asked for it.
export function useSave() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function save(action: () => Promise<ActionResult>, onDone: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) onDone();
      else setError(result.error);
    });
  }
  return { pending, error, save, clear: () => setError(null) };
}
