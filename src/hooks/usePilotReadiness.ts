import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ReadinessItem = {
  key: string;
  label: string;
  ok: boolean;
  required: boolean;
  hint?: string;
  link?: string;
};

export type PilotReadiness = {
  items: ReadinessItem[];
  requiredOk: number;
  requiredTotal: number;
  allRequiredOk: boolean;
};

export function usePilotReadiness(restaurantId: string | undefined) {
  return useQuery({
    queryKey: ["pilot-readiness", restaurantId],
    enabled: !!restaurantId,
    refetchInterval: 30_000,
    queryFn: async (): Promise<PilotReadiness> => {
      const rid = restaurantId!;

      const [
        { data: r },
        { count: hoursCount },
        { count: shiftsCount },
        { count: zonesCount },
        { count: tablesCount },
        { count: ownerCount },
        { count: templatesCount },
        { count: testReservationCount },
      ] = await Promise.all([
        supabase.from("restaurants").select("*").eq("id", rid).maybeSingle(),
        supabase.from("opening_hours").select("id", { count: "exact", head: true }).eq("restaurant_id", rid).eq("is_closed", false),
        supabase.from("shifts").select("id", { count: "exact", head: true }).eq("restaurant_id", rid).eq("is_active", true),
        supabase.from("zones").select("id", { count: "exact", head: true }).eq("restaurant_id", rid),
        supabase.from("tables").select("id", { count: "exact", head: true }).eq("restaurant_id", rid).eq("is_active", true),
        supabase.from("restaurant_members").select("id", { count: "exact", head: true }).eq("restaurant_id", rid).eq("role", "owner"),
        supabase.from("restaurant_email_templates").select("id", { count: "exact", head: true }).eq("restaurant_id", rid),
        supabase.from("reservations").select("id", { count: "exact", head: true }).eq("restaurant_id", rid),
      ]);

      const restaurant: any = r ?? {};

      const items: ReadinessItem[] = [
        {
          key: "restaurant",
          label: "Restaurantgegevens",
          ok: !!(restaurant.name && restaurant.slug && restaurant.timezone && restaurant.address_line1),
          required: true,
          hint: "Vul naam, slug, tijdzone en adres in.",
          link: "/app/instellingen",
        },
        {
          key: "hours",
          label: "Openingstijden",
          ok: (hoursCount ?? 0) > 0,
          required: true,
          hint: "Configureer minimaal één geopende dag.",
          link: "/app/instellingen/openingstijden",
        },
        {
          key: "shifts",
          label: "Shifts",
          ok: (shiftsCount ?? 0) > 0,
          required: true,
          hint: "Maak minimaal één actieve shift aan.",
          link: "/app/instellingen/shifts",
        },
        {
          key: "zones",
          label: "Zones",
          ok: (zonesCount ?? 0) > 0,
          required: true,
          hint: "Maak minimaal één zone aan.",
          link: "/app/instellingen/zones",
        },
        {
          key: "tables",
          label: "Tafels",
          ok: (tablesCount ?? 0) > 0,
          required: true,
          hint: "Maak minimaal één actieve tafel aan.",
          link: "/app/instellingen/zones",
        },
        {
          key: "rules",
          label: "Reserveringsinstellingen",
          ok: !!(restaurant.slot_duration_minutes && restaurant.default_reservation_minutes && restaurant.max_party_size_online),
          required: true,
          hint: "Stel slotduur, standaardduur en max. groepsgrootte in.",
          link: "/app/instellingen/reserveringen",
        },
        {
          key: "pacing",
          label: "Pacing (capaciteit)",
          ok: (restaurant.max_covers_per_slot ?? 0) > 0 && (restaurant.max_new_reservations_per_15min ?? 0) > 0,
          required: false,
          hint: "Beperk aantal couverts en nieuwe boekingen per slot.",
          link: "/app/instellingen/reserveringen",
        },
        {
          key: "widget",
          label: "Booking widget",
          ok: !!restaurant.slug,
          required: true,
          hint: "Slug nodig om widget bereikbaar te maken.",
          link: "/app/instellingen/widget",
        },
        {
          key: "owner",
          label: "Eigenaar",
          ok: (ownerCount ?? 0) > 0,
          required: true,
          hint: "Minimaal één owner-account.",
          link: "/app/instellingen/gebruikers",
        },
        {
          key: "clickwise",
          label: "ClickWise (optioneel)",
          ok: !!restaurant.metadata?.clickwise_connected,
          required: false,
          hint: "Optionele communicatie-integratie.",
          link: "/app/koppelingen?tab=clickwise",
        },
        {
          key: "email_templates",
          label: "E-mailtemplates aangepast",
          ok: (templatesCount ?? 0) > 0,
          required: false,
          hint: "Pas minimaal één gast-email aan met je eigen toon.",
          link: "/app/instellingen/berichten",
        },
        {
          key: "test_reservation",
          label: "Test-reservering uitgevoerd",
          ok: (testReservationCount ?? 0) > 0,
          required: false,
          hint: "Maak één test-reservering om de volledige flow te valideren.",
          link: "/app/onboarding",
        },
        {
          key: "reminder_scheduler",
          label: "Reminder scheduler (handmatige setup)",
          ok: false,
          required: false,
          hint: "Cron job voor automatische 24u/2u herinneringen. Zie docs/CRON_SETUP.md.",
        },
      ];

      const required = items.filter((i) => i.required);
      const requiredOk = required.filter((i) => i.ok).length;

      return {
        items,
        requiredOk,
        requiredTotal: required.length,
        allRequiredOk: requiredOk === required.length,
      };
    },
  });
}
