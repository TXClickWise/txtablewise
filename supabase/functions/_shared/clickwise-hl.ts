// Shared helpers voor ClickWise/HighLevel sub-account provisioning.

export function buildCustomValues(args: {
  restaurantId: string;
  webhookSecret: string | null;
  apiKey: string | null;
  tablewiseBaseUrl: string;
  restaurantName?: string | null;
  timezone?: string | null;
}): Record<string, string> {
  const cv: Record<string, string> = {
    tablewise_base_url: args.tablewiseBaseUrl,
    tablewise_restaurant_id: args.restaurantId,
  };
  if (args.webhookSecret) cv.tablewise_webhook_secret = args.webhookSecret;
  if (args.apiKey) cv.tablewise_api_key = args.apiKey;
  // Restaurantnaam en tijdzone moeten via custom_values omdat {{location.*}}
  // niet rendert in Voice AI prompts en Custom Action bodies.
  if (args.restaurantName) cv.tablewise_restaurant_name = args.restaurantName;
  if (args.timezone) cv.tablewise_timezone = args.timezone;
  return cv;
}

type Json = Record<string, unknown>;
type FetchResult = { ok: boolean; status: number; body: Json };

export function makeHlFetch(apiKey: string, baseUrl: string) {
  const base = baseUrl.replace(/\/$/, "");
  return async (path: string, method: string, body?: Json): Promise<FetchResult> => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Version: "2021-07-28",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let parsed: Json = {};
    try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { raw: text.slice(0, 500) }; }
    return { ok: res.ok, status: res.status, body: parsed };
  };
}

export async function upsertCustomValues(
  hl: (p: string, m: string, b?: Json) => Promise<FetchResult>,
  locationId: string,
  values: Record<string, string>,
) {
  const list = await hl(`/locations/${locationId}/customValues`, "GET");
  if (!list.ok) return { ok: false as const, error: "list_failed", status: list.status, body: list.body };
  const existing: Array<{ id: string; name?: string; fieldKey?: string; key?: string }> =
    (list.body as any)?.customValues ?? [];
  const byKey = new Map<string, { id: string }>();
  for (const cv of existing) {
    const k = cv.fieldKey ?? cv.key ?? cv.name;
    if (k) byKey.set(k.replace(/^custom_values\./, ""), { id: cv.id });
  }
  const results: Array<{ key: string; action: string; status: number }> = [];
  for (const [key, value] of Object.entries(values)) {
    const found = byKey.get(key);
    const r = found
      ? await hl(`/locations/${locationId}/customValues/${found.id}`, "PUT", { name: key, value })
      : await hl(`/locations/${locationId}/customValues`, "POST", { name: key, value });
    results.push({ key, action: found ? "update" : "create", status: r.status });
    if (!r.ok) return { ok: false as const, error: "upsert_failed", key, status: r.status, body: r.body, results };
  }
  return { ok: true as const, results };
}
