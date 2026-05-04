import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AI_ACTION_CATALOG, AIActionContract } from "@/services/aiHost";
import { Copy } from "lucide-react";
import { toast } from "sonner";

function exampleValue(type: string, name: string) {
  switch (type) {
    case "date": return "2026-05-10";
    case "time": return "19:30";
    case "number": return name.includes("party") ? 4 : 1;
    case "boolean": return true;
    case "phone": return "+31612345678";
    case "email": return "gast@voorbeeld.nl";
    case "uuid": return "00000000-0000-0000-0000-000000000000";
    case "enum": return "voorbeeld";
    default: return name.includes("name") ? "Jan" : "voorbeeld";
  }
}

function buildExampleRequest(action: AIActionContract) {
  const body: Record<string, unknown> = { channel: "voice" };
  for (const f of action.inputs) {
    if (f.required) body[f.name] = exampleValue(f.type, f.name);
  }
  return body;
}

function buildExampleResponse(action: AIActionContract) {
  return {
    success: true,
    action: action.name,
    message_for_guest: action.successHint,
  };
}

function copyJson(obj: unknown) {
  navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
  toast.success("JSON gekopieerd");
}

function ActionDoc({ action }: { action: AIActionContract }) {
  const required = action.inputs.filter((i) => i.required);
  const optional = action.inputs.filter((i) => !i.required);
  const req = buildExampleRequest(action);
  const res = buildExampleResponse(action);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">
              <code>{action.name}</code>
            </CardTitle>
            <CardDescription>{action.purpose}</CardDescription>
          </div>
          <Badge variant={action.mode === "internal" ? "secondary" : "default"}>
            {action.mode === "internal" ? "Intern" : "Extern"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {required.length > 0 && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
              Verplichte velden
            </div>
            <ul className="space-y-1">
              {required.map((f) => (
                <li key={f.name} className="text-xs">
                  <code>{f.name}</code> <span className="text-muted-foreground">({f.type})</span>
                  {f.description && <span className="text-muted-foreground"> — {f.description}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {optional.length > 0 && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
              Optionele velden
            </div>
            <ul className="space-y-1">
              {optional.map((f) => (
                <li key={f.name} className="text-xs">
                  <code>{f.name}</code> <span className="text-muted-foreground">({f.type})</span>
                  {f.description && <span className="text-muted-foreground"> — {f.description}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Separator />

        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Voorbeeld request
            </div>
            <Button size="sm" variant="ghost" onClick={() => copyJson(req)}>
              <Copy className="h-3 w-3 mr-1" /> Kopieer
            </Button>
          </div>
          <pre className="text-xs overflow-auto rounded bg-muted/40 p-2">
            {JSON.stringify(req, null, 2)}
          </pre>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Voorbeeld response
            </div>
            <Button size="sm" variant="ghost" onClick={() => copyJson(res)}>
              <Copy className="h-3 w-3 mr-1" /> Kopieer
            </Button>
          </div>
          <pre className="text-xs overflow-auto rounded bg-muted/40 p-2">
            {JSON.stringify(res, null, 2)}
          </pre>
        </div>

        {action.guardrails.length > 0 && (
          <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 p-2 text-xs space-y-1">
            <div className="font-medium">Escalatiegedrag</div>
            {action.guardrails.map((g, i) => <div key={i}>• {g}</div>)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ClickWiseToolSetupPanel() {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          Configureer in ClickWise per Custom Action één van de hieronder gedocumenteerde tools.
          Endpoint: <code className="text-foreground">POST /functions/v1/agent_api/&lt;action_name&gt;</code>.
          Header: <code className="text-foreground">x-agent-api-key</code> met je restaurantsleutel.
        </CardContent>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {AI_ACTION_CATALOG.map((a) => <ActionDoc key={a.name} action={a} />)}
      </div>
    </div>
  );
}
