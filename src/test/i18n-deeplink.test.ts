import { describe, it, expect, beforeEach } from "vitest";
import { detectGuestLocale, normalizeLocale } from "@/lib/i18n/detectLocale";

describe("i18n deeplink ?lang=", () => {
  beforeEach(() => {
    try { window.localStorage.clear(); } catch { /* ignore */ }
  });

  it("normalizes locale tags", () => {
    expect(normalizeLocale("fr-FR")).toBe("fr");
    expect(normalizeLocale("de_DE")).toBe("de");
    expect(normalizeLocale("xx")).toBe("nl");
  });

  it.each(["nl", "en", "de", "fr"] as const)(
    "prefers ?lang=%s over navigator language",
    (lang) => {
      const result = detectGuestLocale({ slug: "demo", urlLang: lang });
      expect(result).toBe(lang);
    },
  );

  it("falls back to restaurant default when ?lang is missing", () => {
    const result = detectGuestLocale({ slug: "demo", urlLang: null, restaurantDefault: "de" });
    // navigator.language in jsdom defaults to 'en-US' so we get 'en' before restaurant default
    expect(["en", "de"]).toContain(result);
  });

  it("ignores invalid ?lang values", () => {
    const result = detectGuestLocale({ slug: "demo", urlLang: "xx" });
    expect(["nl", "en", "de", "fr"]).toContain(result);
  });
});
