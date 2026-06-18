import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { setI18nLocale } from "@/lib/i18n";

export type UiLocale = "nl" | "en";
const STORAGE_KEY = "tw_ui_locale";

function readCached(): UiLocale {
  if (typeof window === "undefined") return "nl";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "en" ? "en" : "nl";
  } catch {
    return "nl";
  }
}

function persistCached(locale: UiLocale) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch { /* noop */ }
}

/**
 * Operator-UI language. Reads `profiles.ui_locale` for the logged-in user,
 * falls back to localStorage cache, and applies the language to i18next.
 * Only NL / EN are exposed; widget/manage flows keep their own detection.
 */
export function useUiLocale() {
  const { user } = useAuth();
  const [locale, setLocaleState] = useState<UiLocale>(() => readCached());
  const [loading, setLoading] = useState(true);

  // Apply cached locale immediately
  useEffect(() => {
    void setI18nLocale(locale);
  }, [locale]);

  // Load from profile when user available
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("ui_locale")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const raw = (data as { ui_locale?: string } | null)?.ui_locale;
      const next: UiLocale = raw === "en" ? "en" : "nl";
      if (next !== locale) {
        setLocaleState(next);
        persistCached(next);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const setLocale = useCallback(
    async (next: UiLocale) => {
      setLocaleState(next);
      persistCached(next);
      await setI18nLocale(next);
      if (user) {
        await supabase
          .from("profiles")
          .update({ ui_locale: next } as never)
          .eq("user_id", user.id);
      }
    },
    [user],
  );

  return { locale, setLocale, loading };
}
