import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plug } from "lucide-react";
import type { ClickWisePreview } from "@/services/guests";

export function GuestClickWisePreview({ preview }: { preview: ClickWisePreview }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-display flex items-center gap-2">
          <Plug className="h-4 w-4" /> ClickWise CRM-sync
          <span className="ml-auto text-[11px] text-muted-foreground font-normal">
            ClickWise is nog niet gekoppeld. De CRM-sync wordt later geactiveerd.
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Tags</div>
          {preview.tags.length === 0 ? (
            <span className="text-xs text-muted-foreground">Geen tags afgeleid.</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {preview.tags.map((t) => (
                <span key={t} className="text-[11px] border rounded-md px-1.5 py-0.5 bg-muted">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-1">Custom fields</div>
          <ul className="text-xs grid grid-cols-2 gap-x-3 gap-y-1">
            {Object.entries(preview.customFields).map(([k, v]) => (
              <li key={k} className="flex items-center justify-between gap-2 border-b py-0.5">
                <span className="text-muted-foreground truncate">{k}</span>
                <span className="font-mono truncate">{v == null ? "—" : String(v)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-1">Workflows</div>
          <ul className="space-y-1">
            {preview.workflows.map((w) => (
              <li key={w.name} className="text-xs flex items-center justify-between">
                <span>{w.name}</span>
                <span className={w.status === "Voorbereid"
                  ? "text-success"
                  : "text-muted-foreground"}>
                  {w.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
