import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MailX, Check, AlertCircle } from "lucide-react";
import { LanguageSwitcher } from "@/components/widget/LanguageSwitcher";
import { detectGuestLocale, persistGuestLocale, type Locale } from "@/lib/i18n/detectLocale";
import { setI18nLocale } from "@/lib/i18n";

type Status = "loading" | "ready" | "already" | "invalid" | "success" | "error";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const { t } = useTranslation("common");

  const initialLocale = useMemo<Locale>(
    () => detectGuestLocale({ slug: `unsub-${token}`, urlLang: params.get("lang") }),
    [token, params],
  );
  const [locale, setLocale] = useState<Locale>(initialLocale);
  useEffect(() => { setI18nLocale(locale); }, [locale]);
  const handleLocaleChange = (next: Locale) => {
    setLocale(next);
    if (token) persistGuestLocale(`unsub-${token}`, next);
  };

  const [status, setStatus] = useState<Status>("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${FN_URL}?token=${encodeURIComponent(token)}`, {
          headers: { apikey: ANON },
        });
        const data = await res.json();
        if (!res.ok) {
          setStatus("invalid");
          return;
        }
        if (data.valid) setStatus("ready");
        else if (data.reason === "already_unsubscribed") setStatus("already");
        else setStatus("invalid");
      } catch {
        setStatus("error");
      }
    })();
  }, [token]);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) {
        setStatus("error");
        return;
      }
      if (data?.success) setStatus("success");
      else if (data?.reason === "already_unsubscribed") setStatus("already");
      else setStatus("error");
    } catch {
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Afmelden voor e-mails — TX TableWise</title>
        <meta name="description" content="Beheer je e-mailvoorkeuren of meld je af voor TX TableWise-mailings." />
        <meta name="robots" content="noindex" />
        <link rel="canonical" href="https://txtablewise.nl/unsubscribe" />
        <meta property="og:title" content="Afmelden voor e-mails — TX TableWise" />
        <meta property="og:description" content="Beheer je e-mailvoorkeuren of meld je af voor TX TableWise-mailings." />
        <meta property="og:url" content="https://txtablewise.nl/unsubscribe" />
      </Helmet>
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher value={locale} onChange={handleLocaleChange} />
      </div>
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            {status === "loading" && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
            {status === "ready" && <MailX className="h-6 w-6 text-muted-foreground" />}
            {(status === "success" || status === "already") && <Check className="h-6 w-6 text-primary" />}
            {(status === "invalid" || status === "error") && <AlertCircle className="h-6 w-6 text-destructive" />}
          </div>
          <CardTitle>
            {status === "loading" && t("unsubscribe.checking")}
            {status === "ready" && t("unsubscribe.confirmTitle")}
            {status === "success" && t("unsubscribe.success")}
            {status === "already" && t("unsubscribe.alreadyTitle")}
            {status === "invalid" && t("unsubscribe.invalidTitle")}
            {status === "error" && t("unsubscribe.errorTitle")}
          </CardTitle>
          <CardDescription>
            {status === "ready" && t("unsubscribe.confirmDescription")}
            {status === "success" && t("unsubscribe.successBody")}
            {status === "already" && t("unsubscribe.alreadyBody")}
            {status === "invalid" && t("unsubscribe.invalidBody")}
            {status === "error" && t("unsubscribe.errorBody")}
          </CardDescription>
        </CardHeader>
        {status === "ready" && (
          <CardContent>
            <Button onClick={handleConfirm} disabled={submitting} className="w-full" size="lg">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {submitting ? t("unsubscribe.submitting") : t("unsubscribe.confirm")}
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
    </>
  );
};

export default Unsubscribe;
