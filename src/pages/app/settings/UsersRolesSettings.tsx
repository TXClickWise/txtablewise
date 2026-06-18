import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Users, Mail, MoreVertical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  listMembers, listPendingInvitations, inviteMember, revokeInvitation,
  resendInvitation, updateMemberRole, removeMember,
  type AppRole,
} from "@/services/teamMembers";

const ROLE_LABEL: Record<AppRole, string> = {
  owner: "Eigenaar",
  manager: "Manager",
  host: "Host",
  staff: "Medewerker",
};

const ASSIGNABLE_ROLES: Exclude<AppRole, "owner">[] = ["manager", "host", "staff"];

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("nl-NL", {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch { return d; }
}

export default function UsersRolesSettings() {
  const { current } = useRestaurant();
  const { user } = useAuth();
  const restaurantId = current?.restaurant_id;
  const myRole = current?.role as AppRole | undefined;
  const canManage = myRole === "owner" || myRole === "manager";
  const qc = useQueryClient();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Exclude<AppRole, "owner">>("staff");

  const membersQ = useQuery({
    queryKey: ["team-members", restaurantId],
    enabled: !!restaurantId,
    queryFn: () => listMembers(restaurantId!),
  });

  const invitesQ = useQuery({
    queryKey: ["team-invitations", restaurantId],
    enabled: !!restaurantId && canManage,
    queryFn: () => listPendingInvitations(restaurantId!),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["team-members", restaurantId] });
    qc.invalidateQueries({ queryKey: ["team-invitations", restaurantId] });
  };

  const inviteMut = useMutation({
    mutationFn: async () => inviteMember(restaurantId!, inviteEmail.trim(), inviteRole),
    onSuccess: () => {
      toast.success(`Uitnodiging verstuurd naar ${inviteEmail.trim()}`);
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("staff");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Uitnodigen mislukt"),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revokeInvitation(id),
    onSuccess: () => { toast.success("Uitnodiging ingetrokken"); invalidate(); },
    onError: (e: any) => toast.error(e?.message || "Mislukt"),
  });

  const resendMut = useMutation({
    mutationFn: (id: string) => resendInvitation(id),
    onSuccess: () => toast.success("Uitnodiging opnieuw verstuurd"),
    onError: (e: any) => toast.error(e?.message || "Mislukt"),
  });

  const roleMut = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Exclude<AppRole, "owner"> }) =>
      updateMemberRole(id, role),
    onSuccess: () => { toast.success("Rol gewijzigd"); invalidate(); },
    onError: (e: any) => toast.error(e?.message || "Mislukt"),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => removeMember(id),
    onSuccess: () => { toast.success("Lid verwijderd"); invalidate(); },
    onError: (e: any) => toast.error(e?.message || "Mislukt"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl mb-1">Gebruikers &amp; rollen</h1>
        <p className="text-sm text-muted-foreground">
          Beheer wie toegang heeft tot dit restaurant en nodig nieuwe teamleden uit.
        </p>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="font-medium">Teamleden</h2>
          </div>
          {canManage && (
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <Mail className="h-4 w-4 mr-2" /> Uitnodigen
            </Button>
          )}
        </div>

        {membersQ.isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Laden…
          </div>
        ) : membersQ.data && membersQ.data.length > 0 ? (
          <div className="rounded-lg border border-border divide-y divide-border">
            {membersQ.data.map((m) => {
              const isMe = m.user_id === user?.id;
              const isOwner = m.role === "owner";
              const showMenu = canManage && !isMe && !isOwner;
              return (
                <div key={m.member_id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {m.display_name || m.email || "Onbekend"}
                      {isMe && (
                        <span className="ml-2 text-xs text-muted-foreground font-normal">(jij)</span>
                      )}
                    </div>
                    {m.email && (
                      <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={isOwner ? "default" : "secondary"}>{ROLE_LABEL[m.role]}</Badge>
                    {showMenu && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Rol wijzigen</DropdownMenuLabel>
                          {ASSIGNABLE_ROLES.filter((r) => r !== m.role).map((r) => (
                            <DropdownMenuItem
                              key={r}
                              onClick={() => roleMut.mutate({ id: m.member_id, role: r })}
                            >
                              Maak {ROLE_LABEL[r].toLowerCase()}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              if (confirm(`${m.display_name || m.email} verwijderen uit dit restaurant?`)) {
                                removeMut.mutate(m.member_id);
                              }
                            }}
                          >
                            Verwijderen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">Nog geen leden.</p>
        )}
      </Card>

      {canManage && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Mail className="h-5 w-5 text-primary" />
            <h2 className="font-medium">Openstaande uitnodigingen</h2>
          </div>
          {invitesQ.data && invitesQ.data.length > 0 ? (
            <div className="rounded-lg border border-border divide-y divide-border">
              {invitesQ.data.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{inv.email}</div>
                    <div className="text-xs text-muted-foreground">
                      Verloopt op {formatDate(inv.expires_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline">{ROLE_LABEL[inv.role]}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => resendMut.mutate(inv.id)}>
                      Opnieuw versturen
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => revokeMut.mutate(inv.id)}
                    >
                      Intrekken
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Geen openstaande uitnodigingen.</p>
          )}
        </Card>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Teamlid uitnodigen</DialogTitle>
            <DialogDescription>
              We sturen een e-mail met een persoonlijke link waarmee ze hun account kunnen maken.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">E-mailadres</Label>
              <Input
                id="invite-email" type="email" autoComplete="email"
                placeholder="naam@voorbeeld.nl"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Manager beheert ook teamleden en instellingen. Host beheert reserveringen en gasten.
                Medewerker werkt vooral op de vloer.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>Annuleren</Button>
            <Button
              onClick={() => inviteMut.mutate()}
              disabled={inviteMut.isPending || !inviteEmail.trim()}
            >
              {inviteMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Uitnodiging sturen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
