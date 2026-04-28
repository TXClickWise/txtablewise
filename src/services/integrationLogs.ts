import { supabase } from "@/integrations/supabase/client";

export type IntegrationLog = {
  id: string;
  restaurant_id: string;
  created_at: string;
  source: "dashboard" | "widget" | "voice_agent" | "clickwise" | "api" | "webhook" | "other";
  action: string;
  status: "success" | "warning" | "failed";
  http_status: number | null;
  latency_ms: number | null;
  error_code: string | null;
  error_message: string | null;
  possible_cause: string | null;
  request_payload: unknown;
  response_payload: unknown;
  guest_id: string | null;
  reservation_id: string | null;
  api_key_prefix: string | null;
  external_reference: string | null;
  retry_safe: boolean;
  metadata: Record<string, unknown>;
};

export type LogFilters = {
  from?: string;
  to?: string;
  status?: IntegrationLog["status"][];
  source?: IntegrationLog["source"][];
  errorCode?: string;
  search?: string; // matches reservation_id or guest_id text
};

export async function listIntegrationLogs(
  restaurantId: string,
  filters: LogFilters = {},
  limit = 100,
): Promise<IntegrationLog[]> {
  let q = (supabase as any).from("integration_logs")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (filters.from) q = q.gte("created_at", filters.from);
  if (filters.to) q = q.lte("created_at", filters.to);
  if (filters.status?.length) q = q.in("status", filters.status);
  if (filters.source?.length) q = q.in("source", filters.source);
  if (filters.errorCode) q = q.ilike("error_code", `%${filters.errorCode}%`);
  if (filters.search) {
    const s = filters.search.trim();
    if (/^[0-9a-f-]{8,}$/i.test(s)) {
      q = q.or(`reservation_id.eq.${s},guest_id.eq.${s}`);
    }
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as IntegrationLog[];
}

export async function retryIntegrationLog(logId: string) {
  const { data, error } = await supabase.functions.invoke("retry_log", { body: { logId } });
  if (error) throw error;
  return data as { ok: boolean; httpStatus?: number; error?: string };
}
