import type { ReactNode } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Settings2 } from "lucide-react";

/**
 * Verbergt geavanceerde instellingen achter een dichtgeklapte accordion.
 * Anders dan <AdvancedOnly> blijft de inhoud bereikbaar voor iedereen,
 * maar staat ze niet in de weg voor de "stille meerderheid" die de
 * aanbevolen defaults gebruikt.
 *
 * Gebruik op settings-pagina's voor toggles die normaal aan blijven staan
 * (bv. reminders, herbevestiging, deposit-policy).
 */
export function AdvancedSection({
  title = "Geavanceerde instellingen",
  description,
  children,
  defaultOpen = false,
  value = "advanced",
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  value?: string;
}) {
  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultOpen ? value : undefined}
      className="border rounded-lg bg-card"
    >
      <AccordionItem value={value} className="border-0">
        <AccordionTrigger className="px-4 py-3 hover:no-underline">
          <div className="flex items-center gap-2 text-left">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">{title}</div>
              {description && (
                <div className="text-xs text-muted-foreground font-normal mt-0.5">
                  {description}
                </div>
              )}
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4 pt-0 space-y-4">
          {children}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
