// MCP-gateway met statische sleutel (voor clients zoals ClickWise die alleen
// URL + headers ondersteunen, dus geen OAuth-browserflow).
//
// Deze function bevat GEEN reserveringslogica. Elke tool-call wordt doorgezet
// naar de bestaande agent_api-function met dezelfde X-Agent-Api-Key header,
// zodat authenticatie, scopes, tenant-binding, grote groepen, pacing,
// tafelcombinaties en events exact hetzelfde blijven als vandaag.
//
// Protocol: MCP Streamable HTTP (JSON-RPC 2.0) — initialize, tools/list, tools/call.

import { corsHeaders as baseCors } from "../_shared/cors.ts";

const corsHeaders = {
  ...baseCors,
  "Access-Control-Allow-Headers":
    (baseCors as Record<string, string>)["Access-Control-Allow-Headers"] +
    ", x-agent-api-key, X-Agent-Api-Key, mcp-session-id, mcp-protocol-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

type JsonSchema = Record<string, unknown>;

interface ToolDef {
  name: string;
  title: string;
  description: string;
  action: string; // agent_api action
  readOnly: boolean;
  destructive?: boolean;
  inputSchema: JsonSchema;
}

const str = (description: string) => ({ type: "string", description });
const num = (description: string) => ({ type: "number", description });

const TOOLS: ToolDef[] = [
  {
    name: "check_availability",
    title: "Check availability",
    description:
      "Check of er plek is op een datum voor een gezelschap, inclusief alternatieve tijden. Gebruik dit voordat je reserveert.",
    action: "check_availability",
    readOnly: true,
    inputSchema: {
      type: "object",
      properties: {
        date: str("Datum in YYYY-MM-DD"),
        party_size: num("Aantal personen"),
        preferred_time: str("Voorkeurstijd in HH:mm"),
      },
      required: ["date", "party_size"],
      additionalProperties: false,
    },
  },
  {
    name: "get_opening_hours",
    title: "Opening hours",
    description: "Openingstijden en sluitingen voor een datum.",
    action: "get_opening_hours",
    readOnly: true,
    inputSchema: {
      type: "object",
      properties: { date: str("Datum in YYYY-MM-DD, standaard vandaag") },
      additionalProperties: false,
    },
  },
  {
    name: "find_reservation",
    title: "Find reservation",
    description:
      "Zoek een bestaande reservering op bevestigingscode, telefoonnummer, achternaam, of voornaam + datum.",
    action: "find_reservation",
    readOnly: true,
    inputSchema: {
      type: "object",
      properties: {
        confirmation_code: str("Bevestigingscode"),
        phone: str("Telefoonnummer van de gast"),
        first_name: str("Voornaam"),
        last_name: str("Achternaam"),
        date: str("Datum in YYYY-MM-DD"),
        time: str("Tijd in HH:mm"),
      },
      additionalProperties: false,
    },
  },
  {
    name: "create_reservation",
    title: "Create reservation",
    description:
      "Maak een reservering. Vraag altijd expliciet naar de voornaam; vul nooit zelf een placeholder in. Lees het veld message_for_guest letterlijk voor en volg next_action.",
    action: "reservation_request",
    readOnly: false,
    inputSchema: {
      type: "object",
      properties: {
        date: str("Datum in YYYY-MM-DD"),
        time: str("Tijd in HH:mm"),
        party_size: num("Aantal personen"),
        first_name: str("Voornaam van de gast"),
        last_name: str("Achternaam van de gast"),
        phone: str("Telefoonnummer van de gast"),
        email: str("E-mailadres van de gast"),
        notes: str("Bijzonderheden, allergieën of wensen"),
        language: str("Taal van het gesprek: nl, de of en"),
      },
      required: ["date", "time", "party_size", "first_name", "phone"],
      additionalProperties: false,
    },
  },
  {
    name: "update_reservation",
    title: "Update reservation",
    description:
      "Wijzig datum, tijd, aantal personen of opmerkingen van een bestaande reservering. Zet confirmed_by_guest op true pas nadat de gast de wijziging bevestigd heeft.",
    action: "update_reservation",
    readOnly: false,
    inputSchema: {
      type: "object",
      properties: {
        reservation_id: str("Id van de reservering (uit find_reservation)"),
        confirmed_by_guest: { type: "boolean", description: "Gast heeft de wijziging bevestigd" },
        new_date: str("Nieuwe datum in YYYY-MM-DD"),
        new_time: str("Nieuwe tijd in HH:mm"),
        new_party_size: num("Nieuw aantal personen"),
        notes: str("Nieuwe opmerkingen"),
      },
      required: ["reservation_id"],
      additionalProperties: false,
    },
  },
  {
    name: "cancel_reservation",
    title: "Cancel reservation",
    description: "Annuleer een bestaande reservering. Bevestig eerst met de gast.",
    action: "cancel_reservation",
    readOnly: false,
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        reservation_id: str("Id van de reservering (uit find_reservation)"),
        reason: str("Reden van annulering"),
      },
      required: ["reservation_id"],
      additionalProperties: false,
    },
  },
  {
    name: "add_waitlist_entry",
    title: "Add to waitlist",
    description: "Zet de gast op de wachtlijst wanneer er geen plek is.",
    action: "create_waitlist_entry",
    readOnly: false,
    inputSchema: {
      type: "object",
      properties: {
        first_name: str("Voornaam van de gast"),
        last_name: str("Achternaam van de gast"),
        phone: str("Telefoonnummer van de gast"),
        email: str("E-mailadres van de gast"),
        desired_date: str("Gewenste datum in YYYY-MM-DD"),
        party_size: num("Aantal personen"),
        desired_time_from: str("Vroegste tijd in HH:mm"),
        desired_time_to: str("Laatste tijd in HH:mm"),
        notes: str("Bijzonderheden"),
      },
      required: ["first_name", "phone", "desired_date", "party_size"],
      additionalProperties: false,
    },
  },
];

// Streamable HTTP was introduced in MCP 2025-03-26. Advertising the older
// 2024-11-05 version makes strict clients expect the legacy HTTP+SSE transport.
const PROTOCOL_VERSION = "2025-03-26";

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}
function rpcError(id: unknown, code: number, message: string, data?: unknown) {
  return { jsonrpc: "2.0", id, error: { code, message, ...(data ? { data } : {}) } };
}
function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callAgentApi(action: string, args: Record<string, unknown>, apiKey: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/agent_api/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Agent-Api-Key": apiKey,
    },
    body: JSON.stringify(args ?? {}),
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }
  return { status: res.status, body: parsed as Record<string, unknown> };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Health/discovery voor clients die eerst een GET doen.
  if (req.method === "GET") {
    return respond({
      name: "tx-tablewise",
      protocol: "mcp-streamable-http",
      protocolVersion: PROTOCOL_VERSION,
      auth: "static header X-Agent-Api-Key",
      tools: TOOLS.map((t) => t.name),
    });
  }

  if (req.method !== "POST") {
    return respond(rpcError(null, -32600, "Method not allowed"), 405);
  }

  const apiKey =
    req.headers.get("x-agent-api-key") ||
    req.headers.get("X-Agent-Api-Key") ||
    "";

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return respond(rpcError(null, -32700, "Parse error"), 400);
  }

  const messages = Array.isArray(payload) ? payload : [payload];
  const responses: unknown[] = [];

  for (const msg of messages) {
    const id = msg?.id ?? null;
    const method: string = msg?.method ?? "";

    // Notificaties (geen id) krijgen geen response.
    const isNotification = msg?.id === undefined || msg?.id === null;

    if (method === "initialize") {
      responses.push(
        rpcResult(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "tx-tablewise", version: "1.0.0" },
          instructions:
            "Reserveringstools voor TX TableWise. Controleer beschikbaarheid, maak, wijzig of annuleer reserveringen en zet gasten op de wachtlijst. Lees message_for_guest letterlijk voor als dat veld aanwezig is.",
        }),
      );
      continue;
    }

    if (method === "ping") {
      responses.push(rpcResult(id, {}));
      continue;
    }

    if (method.startsWith("notifications/") || isNotification) {
      continue;
    }

    if (method === "tools/list") {
      responses.push(
        rpcResult(id, {
          tools: TOOLS.map((t) => ({
            name: t.name,
            title: t.title,
            description: t.description,
            inputSchema: t.inputSchema,
            annotations: {
              title: t.title,
              readOnlyHint: t.readOnly,
              destructiveHint: t.destructive === true,
              openWorldHint: false,
            },
          })),
        }),
      );
      continue;
    }

    if (method === "resources/list") {
      responses.push(rpcResult(id, { resources: [] }));
      continue;
    }
    if (method === "prompts/list") {
      responses.push(rpcResult(id, { prompts: [] }));
      continue;
    }

    if (method === "tools/call") {
      if (!apiKey) {
        responses.push(
          rpcError(id, -32001, "Missing X-Agent-Api-Key header", { error_code: "auth_missing" }),
        );
        continue;
      }
      const toolName: string = msg?.params?.name ?? "";
      const tool = TOOLS.find((t) => t.name === toolName);
      if (!tool) {
        responses.push(rpcError(id, -32602, `Unknown tool: ${toolName}`));
        continue;
      }
      const args = (msg?.params?.arguments ?? {}) as Record<string, unknown>;
      try {
        const { status, body } = await callAgentApi(tool.action, args, apiKey);
        const isError = status >= 400 || (body as any)?.success === false;
        responses.push(
          rpcResult(id, {
            content: [{ type: "text", text: JSON.stringify(body) }],
            structuredContent: body,
            isError,
          }),
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        responses.push(
          rpcResult(id, {
            content: [{ type: "text", text: JSON.stringify({ error: message, error_code: "internal" }) }],
            isError: true,
          }),
        );
      }
      continue;
    }

    responses.push(rpcError(id, -32601, `Method not found: ${method}`));
  }

  if (responses.length === 0) return new Response(null, { status: 202, headers: corsHeaders });
  return respond(Array.isArray(payload) ? responses : responses[0]);
});
