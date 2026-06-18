import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useUiLocale } from "@/hooks/useUiLocale";
import { useTranslation } from "react-i18next";

export function UiLocaleSwitcher() {
  const { locale, setLocale } = useUiLocale();
  const { t } = useTranslation("app");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2" aria-label={t("languageSwitcher.label")}>
          <Languages className="h-4 w-4" />
          <span className="text-xs font-medium uppercase">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => void setLocale("nl")} className={locale === "nl" ? "font-semibold" : ""}>
          🇳🇱 {t("languageSwitcher.nl")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void setLocale("en")} className={locale === "en" ? "font-semibold" : ""}>
          🇬🇧 {t("languageSwitcher.en")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
