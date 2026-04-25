import { useState } from "react";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Search, Star, Ban, Mail, Phone } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";

const GuestsPage = () => {
  const { current } = useRestaurant();
  const rid = current?.restaurant_id;
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: guests = [] } = useQuery({
    queryKey: ["guests", rid, search],
    enabled: !!rid,
    queryFn: async () => {
      let q = supabase.from("guests").select("*").eq("restaurant_id", rid!).order("updated_at", { ascending: false }).limit(200);
      if (search) {
        q = q.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
      }
      const { data } = await q;
      return data ?? [];
    },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl">Gasten</h1>
          <p className="text-muted-foreground">{guests.length} profielen</p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Zoek gast…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle className="font-display text-lg">Recent</CardTitle></CardHeader>
        <CardContent>
          {guests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Geen gasten gevonden.</div>
          ) : (
            <div className="divide-y divide-border">
              {(guests as any[]).map((x) => (
                <button
                  key={x.id}
                  onClick={() => setSelectedId(x.id)}
                  className="py-3 flex items-center gap-3 w-full text-left hover:bg-muted/40 -mx-3 px-3 rounded-md transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center font-display text-sm shrink-0">
                    {(x.first_name?.[0] ?? "G").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{x.first_name} {x.last_name ?? ""}</span>
                      {x.is_vip && <span className="text-xs bg-accent/30 text-accent-foreground px-1.5 py-0.5 rounded inline-flex items-center gap-1"><Star className="h-3 w-3" />VIP</span>}
                      {x.is_blacklisted && <span className="text-xs bg-destructive/20 text-destructive px-1.5 py-0.5 rounded inline-flex items-center gap-1"><Ban className="h-3 w-3" />Geblokkeerd</span>}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">{x.email} {x.phone && `· ${x.phone}`}</div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0">
                    <div>{x.total_visits} bezoeken</div>
                    {x.no_show_count > 0 && <div className="text-status-noshow">{x.no_show_count} no-show</div>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <GuestDetailSheet guestId={selectedId} restaurantId={rid} onClose={() => { setSelectedId(null); qc.invalidateQueries({ queryKey: ["guests"] }); }} />
    </div>
  );
};

function GuestDetailSheet({
  guestId, restaurantId, onClose,
}: { guestId: string | null; restaurantId?: string; onClose: () => void }) {
  const { data: guest } = useQuery({
    queryKey: ["guest", guestId],
    enabled: !!guestId,
    queryFn: async () => {
      const { data } = await supabase.from("guests").select("*").eq("id", guestId!).maybeSingle();
      return data;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["guest-history", guestId],
    enabled: !!guestId,
    queryFn: async () => {
      const { data } = await supabase.from("reservations")
        .select("id, reservation_date, start_time, party_size, status, channel")
        .eq("guest_id", guestId!).order("start_time", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // sync form when guest loads
  if (guest && (!form || form.id !== guest.id)) {
    setForm({
      id: guest.id,
      first_name: guest.first_name ?? "",
      last_name: guest.last_name ?? "",
      email: guest.email ?? "",
      phone: guest.phone ?? "",
      allergies: guest.allergies ?? "",
      notes: guest.notes ?? "",
      tags: (guest.tags ?? []).join(", "),
      is_vip: guest.is_vip,
      is_blacklisted: guest.is_blacklisted,
      marketing_consent: guest.marketing_consent,
    });
  }

  const save = async () => {
    if (!form) return;
    setSaving(true);
    const { error } = await supabase.from("guests").update({
      first_name: form.first_name || null,
      last_name: form.last_name || null,
      email: form.email || null,
      phone: form.phone || null,
      allergies: form.allergies || null,
      notes: form.notes || null,
      tags: form.tags ? form.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
      is_vip: form.is_vip,
      is_blacklisted: form.is_blacklisted,
      marketing_consent: form.marketing_consent,
    }).eq("id", form.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Gast bijgewerkt");
    onClose();
  };

  return (
    <Sheet open={!!guestId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">{guest?.first_name} {guest?.last_name}</SheetTitle>
        </SheetHeader>
        {!form ? (
          <p className="text-muted-foreground text-sm py-8 text-center">Laden…</p>
        ) : (
          <div className="space-y-6 mt-6">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Voornaam</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
              <div><Label className="text-xs">Achternaam</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
              <div className="col-span-2"><Label className="text-xs">E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="col-span-2"><Label className="text-xs">Telefoon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>

            <div className="space-y-2">
              <div><Label className="text-xs">Allergieën</Label><Input value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} /></div>
              <div><Label className="text-xs">Tags (komma-gescheiden)</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="vip, wijnliefhebber" /></div>
              <div><Label className="text-xs">Interne notities</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between"><span className="text-sm flex items-center gap-2"><Star className="h-4 w-4" />VIP</span><Switch checked={form.is_vip} onCheckedChange={(v) => setForm({ ...form, is_vip: v })} /></div>
              <div className="flex items-center justify-between"><span className="text-sm flex items-center gap-2"><Ban className="h-4 w-4" />Geblokkeerd</span><Switch checked={form.is_blacklisted} onCheckedChange={(v) => setForm({ ...form, is_blacklisted: v })} /></div>
              <div className="flex items-center justify-between"><span className="text-sm flex items-center gap-2"><Mail className="h-4 w-4" />Marketing toegestaan</span><Switch checked={form.marketing_consent} onCheckedChange={(v) => setForm({ ...form, marketing_consent: v })} /></div>
            </div>

            <div className="flex justify-end gap-2">
              {guest?.email && <Button variant="outline" asChild><a href={`mailto:${guest.email}`}><Mail className="h-4 w-4 mr-2" />Mail</a></Button>}
              {guest?.phone && <Button variant="outline" asChild><a href={`tel:${guest.phone}`}><Phone className="h-4 w-4 mr-2" />Bel</a></Button>}
              <Button onClick={save} disabled={saving}>{saving ? "Opslaan…" : "Opslaan"}</Button>
            </div>

            <div>
              <h3 className="font-display text-sm uppercase tracking-wide text-muted-foreground mb-2">Geschiedenis ({history.length})</h3>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nog geen reserveringen.</p>
              ) : (
                <div className="divide-y divide-border">
                  {(history as any[]).map((h) => (
                    <div key={h.id} className="py-2 flex items-center gap-3 text-sm">
                      <div className="min-w-[110px]">
                        <div className="font-medium">{format(new Date(h.reservation_date), "d MMM yyyy", { locale: nl })}</div>
                        <div className="text-xs text-muted-foreground">{format(new Date(h.start_time), "HH:mm")} · {h.party_size}p</div>
                      </div>
                      <StatusBadge status={h.status as any} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default GuestsPage;
