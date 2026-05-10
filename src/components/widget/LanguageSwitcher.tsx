import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SUPPORTED_LOCALES, LOCALE_FLAGS, LOCALE_LABELS, type Locale } from "@/lib/i18n/detectLocale";

interface Props {
  value: Locale;
  onChange: (locale: Locale) => void;
  className?: string;
}

export function LanguageSwitcher({ value, onChange, className }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={className}
          aria-label={LOCALE_LABELS[value]}
        >
          <Globe className="h-4 w-4 mr-1.5" />
          <span className="text-sm">{LOCALE_FLAGS[value]} {value.toUpperCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        {SUPPORTED_LOCALES.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => onChange(loc)}
            className={value === loc ? "font-medium" : ""}
          >
            <span className="mr-2">{LOCALE_FLAGS[loc]}</span>
            {LOCALE_LABELS[loc]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
