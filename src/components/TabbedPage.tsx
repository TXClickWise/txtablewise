import { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type TabbedPageTab = {
  value: string;
  label: string;
  content: ReactNode;
};

interface TabbedPageProps {
  tabs: TabbedPageTab[];
  defaultTab?: string;
  paramName?: string;
}

/**
 * Generieke wrapper die meerdere bestaande pagina's bundelt onder één route met tabs.
 * Tab-state wordt in de URL gehouden via ?tab=... zodat directe links blijven werken.
 */
export function TabbedPage({ tabs, defaultTab, paramName = "tab" }: TabbedPageProps) {
  const [params, setParams] = useSearchParams();
  const initial = defaultTab ?? tabs[0]?.value;
  const current = params.get(paramName) ?? initial;
  const active = tabs.find((t) => t.value === current) ? current : initial;

  const onChange = (value: string) => {
    const next = new URLSearchParams(params);
    next.set(paramName, value);
    setParams(next, { replace: true });
  };

  return (
    <Tabs value={active} onValueChange={onChange} className="w-full">
      <div className="border-b bg-background sticky top-0 z-10">
        <TabsList className="h-auto bg-transparent p-0 mx-4">
          {tabs.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value} className="mt-0">
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
