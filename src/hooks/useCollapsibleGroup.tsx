import { useCallback, useEffect, useState } from "react";

/**
 * Onthoudt open/dicht-state van een sidebar-groep in localStorage.
 * Standaard open.
 */
export function useCollapsibleGroup(key: string, defaultOpen = true) {
  const storageKey = `lov.collapse.${key}`;
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return defaultOpen;
    const v = window.localStorage.getItem(storageKey);
    if (v === null) return defaultOpen;
    return v === "1";
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [open, storageKey]);
  const toggle = useCallback(() => setOpen((o) => !o), []);
  return { open, setOpen, toggle };
}
