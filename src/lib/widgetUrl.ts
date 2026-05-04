/**
 * Bepaal de widget-URL voor een restaurant.
 * Prioriteit:
 * 1. custom_widget_domain (white-label, Pro-plan) → https://reserveer.mijnrestaurant.nl
 * 2. public_base_url (platform-breed, system admin) → https://txtablewise.nl/r/{slug}
 * 3. fallback → https://txtablewise.nl/r/{slug}
 */
const PRODUCTION_BASE = "https://txtablewise.nl";

function sanitizeBase(url: string): string {
  let v = url.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  return v;
}

function isUnsafe(url: string): boolean {
  return /lovable\.app|id-preview--/i.test(url);
}

export interface WidgetUrlOptions {
  customWidgetDomain?: string | null;
  publicBaseUrl?: string | null;
}

export function getWidgetUrl(slug: string, opts?: WidgetUrlOptions): string {
  // Niveau 1: white-label (heel domein = widget van dit restaurant)
  if (opts?.customWidgetDomain?.trim()) {
    const domain = sanitizeBase(opts.customWidgetDomain);
    if (!isUnsafe(domain)) return domain;
  }
  // Niveau 2: platform basis-URL (system admin)
  if (opts?.publicBaseUrl?.trim()) {
    const base = sanitizeBase(opts.publicBaseUrl);
    if (!isUnsafe(base)) return `${base}/r/${slug}`;
  }
  // Niveau 3: hardcoded productie-fallback
  return `${PRODUCTION_BASE}/r/${slug}`;
}

export function getWidgetBaseUrl(opts?: WidgetUrlOptions): string {
  if (opts?.customWidgetDomain?.trim()) {
    const domain = sanitizeBase(opts.customWidgetDomain);
    if (!isUnsafe(domain)) return domain;
  }
  if (opts?.publicBaseUrl?.trim()) {
    const base = sanitizeBase(opts.publicBaseUrl);
    if (!isUnsafe(base)) return base;
  }
  return PRODUCTION_BASE;
}

export function getEmbedSnippet(slug: string, opts?: WidgetUrlOptions): string {
  const url = getWidgetUrl(slug, opts);
  return `<iframe src="${url}" width="100%" height="700" frameborder="0"></iframe>`;
}
