import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

const DISMISS_KEY = "tw-pwa-install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Subtiele banner die de native install-prompt triggert.
 * Verschijnt alleen op tablet/mobiel als de app nog niet als PWA draait.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    // Al geïnstalleerd?
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, "1");
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, "1");
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-6 md:max-w-sm">
      <div className="rounded-xl border border-border bg-card shadow-lg p-3 flex items-center gap-3">
        <Download className="h-5 w-5 text-primary shrink-0" />
        <div className="flex-1 min-w-0 text-sm">
          <p className="font-medium leading-tight">Installeer TX TableWise</p>
          <p className="text-xs text-muted-foreground leading-tight">
            Sneller te openen op je tablet.
          </p>
        </div>
        <Button size="sm" onClick={handleInstall}>
          Installeren
        </Button>
        <Button size="icon" variant="ghost" onClick={handleDismiss} aria-label="Sluiten">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
