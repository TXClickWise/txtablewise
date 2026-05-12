import { useEffect, useRef } from "react";
import { toast } from "sonner";

const VERSION_URL = "/version.json";
const POLL_INTERVAL_MS = 60_000;

async function fetchVersion(): Promise<string | null> {
  try {
    const res = await fetch(`${VERSION_URL}?_=${Date.now()}`, {
      cache: "no-store",
      headers: { "cache-control": "no-cache" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return data?.version ?? null;
  } catch {
    return null;
  }
}

/**
 * Polls /version.json and shows a persistent toast when a new build is detected.
 * The toast lets the user reload the app on demand.
 */
export function useNewBuildNotifier() {
  const initialRef = useRef<string | null>(null);
  const notifiedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const check = async () => {
      const v = await fetchVersion();
      if (cancelled || !v) return;
      if (initialRef.current === null) {
        initialRef.current = v;
        return;
      }
      if (v !== initialRef.current && !notifiedRef.current) {
        notifiedRef.current = true;
        toast("Nieuwe versie beschikbaar", {
          description: "Herlaad de app om de laatste verbeteringen te gebruiken.",
          duration: Infinity,
          action: {
            label: "Herlaad",
            onClick: () => window.location.reload(),
          },
        });
      }
    };

    void check();
    timer = setInterval(check, POLL_INTERVAL_MS);

    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
}
