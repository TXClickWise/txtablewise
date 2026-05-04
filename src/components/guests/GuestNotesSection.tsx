// Notitiesectie voor gastprofiel — type-aware met hospitality-vriendelijke labels.
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  createGuestNote, listGuestNotes, NOTE_TYPE_LABEL,
  type GuestNote, type GuestNoteType,
} from "@/services/guests";

type Props = { restaurantId: string; guestId: string; readOnly?: boolean };

export function GuestNotesSection({ restaurantId, guestId, readOnly = false }: Props) {
  const [notes, setNotes] = useState<GuestNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [type, setType] = useState<GuestNoteType>("general");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try { setNotes(await listGuestNotes(guestId)); } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [guestId]);

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await createGuestNote(restaurantId, guestId, { note: text, note_type: type });
      setText(""); setType("general"); setAdding(false);
      await refresh();
      toast.success("Notitie toegevoegd.");
    } catch { toast.error("Notitie kon niet worden opgeslagen."); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm uppercase tracking-wide text-muted-foreground">Notities</h3>
        {!adding && !readOnly && (
          <Button size="sm" variant="outline" className="h-8" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Notitie toevoegen
          </Button>
        )}
      </div>

      {adding && !readOnly && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as GuestNoteType)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(NOTE_TYPE_LABEL) as GuestNoteType[]).map((k) => (
                    <SelectItem key={k} value={k}>{NOTE_TYPE_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Bv. voorkeur voor rustige tafel, vierde verjaardag." />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setText(""); }}>Annuleren</Button>
            <Button size="sm" onClick={submit} disabled={busy || !text.trim()}>
              {busy ? "Opslaan…" : "Opslaan"}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Laden…</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Er zijn nog geen hospitality-notities.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-md border bg-card p-2.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium">{NOTE_TYPE_LABEL[(n.note_type ?? "general") as GuestNoteType] ?? "Algemeen"}</span>
                <span>{format(new Date(n.created_at), "d MMM yyyy HH:mm", { locale: nl })}</span>
              </div>
              <p className="text-sm mt-1 whitespace-pre-wrap">{n.note}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
