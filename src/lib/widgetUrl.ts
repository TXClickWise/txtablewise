/**
 * Bepaal de basis-URL voor publieke widget-links.
 * Prioriteit:
 * 1. public_base_url uit restaurant settings (als ingesteld)
 * 2. VITE_PUBLIC_BASE_URL environment variable (als ingesteld)
 * 3. window.location.origin als fallback
 */
export function getWidgetBaseUrl(publicBaseUrl?: string | null): string {
  if (publicBaseUrl?.trim()) {
    return publicBaseUrl.trim().replace(/\/+$/, "");
  }
  const envUrl = import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined;
  if (envUrl?.trim()) {
    return envUrl.trim().replace(/\/+$/, "");
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
}

/** Genereer de volledige publieke widget-URL voor een restaurant. */
export function getWidgetUrl(slug: string, publicBaseUrl?: string | null): string {
  return `${getWidgetBaseUrl(publicBaseUrl)}/r/${slug}`;
}
