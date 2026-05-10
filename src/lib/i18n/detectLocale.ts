// Detect the guest's preferred locale.
// Strategy: localStorage override > URL ?lang= > navigator.language > restaurant default > 'nl'.
export const SUPPORTED_LOCALES = ["nl", "en", "de", "fr"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  nl: "Nederlands",
  en: "English",
  de: "Deutsch",
  fr: "Français",
};

export const LOCALE_FLAGS: Record<Locale, string> = {
  nl: "🇳🇱",
  en: "🇬🇧",
  de: "🇩🇪",
  fr: "🇫🇷",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function normalizeLocale(raw: string | null | undefined, fallback: Locale = "nl"): Locale {
  if (!raw) return fallback;
  const lower = raw.toLowerCase().split(/[-_]/)[0];
  return isLocale(lower) ? lower : fallback;
}

export function detectGuestLocale(opts: {
  slug?: string;
  urlLang?: string | null;
  restaurantDefault?: string | null;
} = {}): Locale {
  // 1. localStorage override per slug
  if (opts.slug && typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(`tw_locale_${opts.slug}`);
      if (stored && isLocale(stored)) return stored;
    } catch { /* ignore */ }
  }
  // 2. URL parameter
  if (opts.urlLang) {
    const fromUrl = normalizeLocale(opts.urlLang, opts.restaurantDefault as Locale ?? "nl");
    if (isLocale(opts.urlLang.toLowerCase().split(/[-_]/)[0])) return fromUrl;
  }
  // 3. navigator
  if (typeof navigator !== "undefined" && navigator.language) {
    const nav = normalizeLocale(navigator.language, "nl");
    if (isLocale(nav)) return nav;
  }
  // 4. restaurant default
  if (opts.restaurantDefault && isLocale(opts.restaurantDefault)) return opts.restaurantDefault;
  return "nl";
}

export function persistGuestLocale(slug: string, locale: Locale): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`tw_locale_${slug}`, locale);
  } catch { /* ignore */ }
}
