import { useState } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRestaurant } from "@/hooks/useRestaurant";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const WalkInDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => {
  const { current } = useRestaurant();
  const qc = useQueryClient();
  const [partySize, setPartySize] = useState(2);
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState(format(new Date(Date.now() + 15 * 60_000), "HH:mm"));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (channel: "walk_in" | "manager") => {
    if (!current) return;
    if (!firstName.trim()) { toast.error("Naam is verplicht"); return; }
    if (channel === "manager" && !email.trim()) { toast.error("E-mail vereist voor reservering"); return; }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("book_reservation", {
      body: {
        restaurant_id: current.restaurant_id,
        date, time, party_size: partySize,
        guest: {
          first_name: firstName.trim(),
          email: email.trim() || `walkin-${Date.now()}@tablewise.local`,
          phone: phone.trim() || undefined,
          language: "nl",
        },
        special_requests: notes || undefined,
        channel,
      },
    });
    setSubmitting(false);
    if (error || data?.error) { toast.error(data?.error || "Boeken mislukt"); return; }
    toast.success(channel === "walk_in" ? "Walk-in geplaatst" : "Reservering aangemaakt");
    qc.invalidateQueries();
    onOpenChange(false);
    setFirstName(""); setPhone(""); setEmail(""); setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Nieuwe boeking</DialogTitle>
          <DialogDescription>Walk-in of telefonische reservering toevoegen.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="walkin">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="walkin">Walk-in (nu)</TabsTrigger>
            <TabsTrigger value="manager">Reservering</TabsTrigger>
          </TabsList>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Voornaam *</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label>Aantal *</Label>
                <Input type="number" min={1} max={50} value={partySize} onChange={(e) => setPartySize(Number(e.target.value))} className="h-11" />
              </div>
            </div>

            <TabsContent value="walkin" className="space-y-4 mt-0">
              <div className="space-y-1.5">
                <Label>Telefoon (optioneel)</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11" />
              </div>
            </TabsContent>

            <TabsContent value="manager" className="space-y-4 mt-0">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Datum</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label>Tijd</Label>
                  <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-11" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>E-mail *</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label>Telefoon</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11" />
              </div>
            </TabsContent>

            <div className="space-y-1.5">
              <Label>Notitie</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Allergie, voorkeur tafel…" />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuleren</Button>
            <TabsContent value="walkin" className="m-0">
              <Button onClick={() => submit("walk_in")} disabled={submitting}>
                {submitting ? "Bezig…" : "Walk-in plaatsen"}
              </Button>
            </TabsContent>
            <TabsContent value="manager" className="m-0">
              <Button onClick={() => submit("manager")} disabled={submitting}>
                {submitting ? "Bezig…" : "Reservering aanmaken"}
              </Button>
            </TabsContent>
          </DialogFooter>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
