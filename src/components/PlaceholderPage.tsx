import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Construction } from "lucide-react";

type Section = {
  title: string;
  description?: string;
  badge?: string;
  items?: { label: string; meta?: string; badge?: string }[];
  children?: ReactNode;
};

type Props = {
  title: string;
  intro: string;
  badge?: string;
  comingSoon?: string;
  sections?: Section[];
  actions?: ReactNode;
  children?: ReactNode;
};

export function PlaceholderPage({ title, intro, badge, comingSoon, sections = [], actions, children }: Props) {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl">{title}</h1>
            {badge && (
              <Badge variant="secondary" className="text-xs">
                <Sparkles className="mr-1 h-3 w-3" /> {badge}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground max-w-2xl">{intro}</p>
        </div>
        {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
      </div>

      {comingSoon && (
        <Card className="border-dashed bg-muted/30">
          <CardContent className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
            <Construction className="h-4 w-4 shrink-0" />
            <span>{comingSoon}</span>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((s) => (
          <Card key={s.title}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg">{s.title}</CardTitle>
                {s.badge && <Badge variant="outline" className="text-xs">{s.badge}</Badge>}
              </div>
              {s.description && <CardDescription>{s.description}</CardDescription>}
            </CardHeader>
            {(s.items?.length || s.children) && (
              <CardContent className="space-y-2">
                {s.items?.map((it, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{it.label}</div>
                      {it.meta && <div className="text-xs text-muted-foreground truncate">{it.meta}</div>}
                    </div>
                    {it.badge && <Badge variant="secondary" className="text-xs shrink-0">{it.badge}</Badge>}
                  </div>
                ))}
                {s.children}
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {children}
    </div>
  );
}
