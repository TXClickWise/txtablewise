import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MailX, Check, AlertCircle } from "lucide-react";

type Status = "loading" | "ready" | "already" | "invalid" | "success" | "error";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            {status === "loading" && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
            {status === "ready" && <MailX className="h-6 w-6 text-muted-foreground" />}
            {(status === "success" || status === "already") && <Check className="h-6 w-6 text-primary" />}
            {(status === "invalid" || status === "error") && <AlertCircle className="h-6 w-6 text-destructive" />}
          </div>
          <CardTitle>
            {status === "loading" && "Even controleren..."}
            {status === "ready" && "Uitschrijven bevestigen"}
            {status === "success" && "Je bent uitgeschreven"}
            {status === "already" && "Al uitgeschreven"}
            {status === "invalid" && "Ongeldige link"}
            {status === "error" && "Er ging iets mis"}
          </CardTitle>
          <CardDescription>
            {status === "ready" && "Bevestig hieronder dat je geen mails meer wil ontvangen. Je kan altijd opnieuw reserveren — dan ontvang je weer de bevestiging van die reservering."}
            {status === "success" && "We sturen je geen mails meer. Bedankt dat je het hebt laten weten."}
            {status === "already" && "Dit mailadres staat al op de uitschrijflijst."}
            {status === "invalid" && "Deze link is niet meer geldig. Mogelijk is hij al gebruikt of verlopen."}
            {status === "error" && "Probeer het later nog eens, of neem contact op met het restaurant."}
          </CardDescription>
        </CardHeader>
        {status === "ready" && (
          <CardContent>
            <Button onClick={handleConfirm} disabled={submitting} className="w-full" size="lg">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Bevestig uitschrijven
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default Unsubscribe;
