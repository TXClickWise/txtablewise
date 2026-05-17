// Voice Agent Flow service — runs a complete simulated voice-reservation flow:
// gather → normalize → check availability → book → confirm.
// Uses public_api so the same TW_-error codes surface as in production.

import { supabase } from "@/integrations/supabase/client";

export type VoiceFlowInput = {
  spokenDate: string;
  spokenTime: string;
  spokenParty: string;
  firstName: string;
  lastName?: string;
  phone: string;
  notes?: string;
};

export type VoiceFlowStep =
  | "gather"
  | "normalize"
  | "availability"
  | "book"
  | "confirm"
  | "fallback";

export type VoiceFlowStepResult = {
  step: VoiceFlowStep;
  ok: boolean;
  message: string;
  data?: unknown;
  errorCode?: string;
  field?: string | null;
  suggestedFix?: string | null;
};

export type VoiceFlowResult = {
  success: boolean;
  reservationId?: string;
  reservationCode?: string;
  steps: VoiceFlowStepResult[];
  finishedAt: string;
};

const PUBLIC_API_BASE = `https://${
  (import.meta as { env?: Record<string, string> }).env?.VITE_SUPABASE_PROJECT_ID
}.supabase.co/functions/v1/public_api`;

// ---- Normalisatie ------------------------------------------------------------

const DUTCH_NUMBERS: Record<string, number> = {
  een: 1, één: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7,
  acht: 8, negen: 9, tien: 10, elf: 11, twaalf: 12,
};

export function normalizePartySize(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.toLowerCase().trim().replace(/\s*personen?\s*/g, "").replace(/[^a-z0-9]/g, "");
  if (/^\d+$/.test(cleaned)) {
    const n = parseInt(cleaned, 10);
    return n > 0 && n < 100 ? n : null;
  }
  if (DUTCH_NUMBERS[cleaned] !== undefined) return DUTCH_NUMBERS[cleaned];
  return null;
}

export function normalizeDate(raw: string): string | null {
  if (!raw) return null;
  const t = raw.toLowerCase().trim();
  const today = new Date();
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };
  if (t === "vandaag") return fmt(today);
  if (t === "morgen") { const d = new Date(today); d.setDate(d.getDate() + 1); return fmt(d); }
  if (t === "overmorgen") { const d = new Date(today); d.setDate(d.getDate() + 2); return fmt(d); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?$/);
  if (m) {
    const dd = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const yy = m[3] ? parseInt(m[3], 10) : today.getFullYear();
    const y = yy < 100 ? 2000 + yy : yy;
    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) {
      return `${y}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
  }
  return null;
}

export function normalizeTime(raw: string): string | null {
  if (!raw) return null;
  const t = raw.toLowerCase().trim();
  const m1 = t.match(/^(\d{1,2})[:.h]?(\d{2})?$/);
  if (m1) {
    const h = parseInt(m1[1], 10);
    const m = m1[2] ? parseInt(m1[2], 10) : 0;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }
  const halfMatch = t.match(/^half\s+(een|twee|drie|vier|vijf|zes|zeven|acht|negen|tien|elf|twaalf|\d{1,2})/);
  if (halfMatch) {
    const w = halfMatch[1];
    const h = DUTCH_NUMBERS[w] ?? parseInt(w, 10);
    if (!isNaN(h)) {
      // "half acht" = 7:30. Avond-context: 6..11 → +12.
      const base = (h - 1 + 24) % 24;
      const adjusted = base >= 6 && base <= 11 ? base + 12 : base;
      return `${String(adjusted).padStart(2, "0")}:30`;
    }
  }
  return null;
}

export function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[\s\-().]/g, "");
  if (/^\+\d{7,15}$/.test(cleaned)) return cleaned;
  if (/^00\d{7,15}$/.test(cleaned)) return "+" + cleaned.slice(2);
  if (/^0\d{8,9}$/.test(cleaned)) return "+31" + cleaned.slice(1);
  return null;
}

// ---- Flow runner -------------------------------------------------------------

async function createTempApiKey(restaurantId: string): Promise<string | null> {
  const tempKey = `tw_test_${crypto.randomUUID().replace(/-/g, "")}`;
  const enc = new TextEncoder().encode(tempKey);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const hash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const { error } = await supabase.from("agent_api_keys").insert({
    restaurant_id: restaurantId,
    label: `Voice flow test ${new Date().toISOString()}`,
    key_hash: hash,
    key_prefix: tempKey.slice(0, 12),
    scopes: ["availability", "book", "cancel"],
    provider: "voice-flow-test",
  });
  if (error) {
    console.error("Temp key creation failed", error);
    return null;
  }
  return tempKey;
}

async function revokeTestKey(prefix: string) {
  await supabase
    .from("agent_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("key_prefix", prefix);
}

async function callPublicApi(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  apiKey: string,
  body?: unknown,
) {
  const res = await fetch(`${PUBLIC_API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-TableWise-Api-Key": apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

export async function runVoiceFlow(
  restaurantId: string,
  input: VoiceFlowInput,
): Promise<VoiceFlowResult> {
  const steps: VoiceFlowStepResult[] = [];
  const finish = (success: boolean, extra?: Partial<VoiceFlowResult>): VoiceFlowResult => ({
    success,
    steps,
    finishedAt: new Date().toISOString(),
    ...extra,
  });

  // Step 1 — gather
  const missing: string[] = [];
  if (!input.spokenDate) missing.push("datum");
  if (!input.spokenTime) missing.push("tijd");
  if (!input.spokenParty) missing.push("aantal personen");
  if (!input.firstName) missing.push("voornaam");
  if (!input.phone) missing.push("telefoonnummer");
  if (missing.length) {
    steps.push({ step: "gather", ok: false, message: `Ontbrekend: ${missing.join(", ")}` });
    steps.push({ step: "fallback", ok: false, message: `Vraag opnieuw, één veld tegelijk: ${missing.join(", ")}` });
    return finish(false);
  }
  steps.push({ step: "gather", ok: true, message: "Alle verplichte velden ontvangen.", data: input });

  // Step 2 — normalize
  const localDate = normalizeDate(input.spokenDate);
  const localTime = normalizeTime(input.spokenTime);
  const partySize = normalizePartySize(input.spokenParty);
  const phone = normalizePhone(input.phone);

  const norm = { localDate, localTime, partySize, phone };
  if (!localDate || !localTime || !partySize || !phone) {
    const bad: string[] = [];
    if (!localDate) bad.push("datum");
    if (!localTime) bad.push("tijd");
    if (!partySize) bad.push("aantal personen");
    if (!phone) bad.push("telefoonnummer");
    steps.push({ step: "normalize", ok: false, message: `Niet te normaliseren: ${bad.join(", ")}`, data: norm });
    steps.push({ step: "fallback", ok: false, message: `Vraag opnieuw en bevestig hardop: ${bad.join(", ")}` });
    return finish(false);
  }
  steps.push({ step: "normalize", ok: true, message: "Genormaliseerd naar API-formaat.", data: norm });

  // Tijdelijke API-key (in-app test bypass — wordt ingetrokken in finally)
  const apiKey = await createTempApiKey(restaurantId);
  if (!apiKey) {
    steps.push({ step: "fallback", ok: false, message: "Tijdelijke test-sleutel kon niet worden aangemaakt." });
    return finish(false);
  }
  const keyPrefix = apiKey.slice(0, 12);

  try {
    // Step 3 — availability
    const avail = await callPublicApi("/availability", "POST", apiKey, { localDate, localTime, partySize });
    if (avail.status >= 400) {
      const e = (avail.data as any)?.error ?? {};
      steps.push({
        step: "availability",
        ok: false,
        message: e.message || "Beschikbaarheid faalde",
        errorCode: e.code,
        field: e.field ?? null,
        suggestedFix: e.suggestedFix ?? null,
        data: avail.data,
      });
      steps.push({ step: "fallback", ok: false, message: e.suggestedFix || "Vraag een ander tijdstip of bied wachtlijst aan." });
      return finish(false);
    }
    const isAvailable = (avail.data as any)?.isAvailable;
    if (!isAvailable) {
      const alts = (avail.data as any)?.suggestedAlternatives ?? [];
      steps.push({
        step: "availability",
        ok: false,
        message: alts.length
          ? `Niet beschikbaar. Alternatieven: ${alts.slice(0, 3).map((a: any) => a.localTime).join(", ")}`
          : "Niet beschikbaar en geen alternatieven gevonden.",
        errorCode: "TW_409_TIMESLOT_UNAVAILABLE",
        data: avail.data,
      });
      steps.push({
        step: "fallback",
        ok: false,
        message: alts.length ? "Stel alternatief tijdstip voor aan beller." : "Bied wachtlijst aan.",
      });
      return finish(false);
    }
    steps.push({ step: "availability", ok: true, message: "Tijdslot beschikbaar.", data: avail.data });

    // Step 4 — book
    const book = await callPublicApi("/reservations", "POST", apiKey, {
      localDate,
      localTime,
      partySize,
      contact: {
        firstName: input.firstName,
        lastName: input.lastName,
        phone,
      },
      notes: input.notes,
      source: "voice_agent",
      externalReference: `flow-test-${Date.now()}`,
    });
    if (book.status >= 400) {
      const e = (book.data as any)?.error ?? {};
      steps.push({
        step: "book",
        ok: false,
        message: e.message || "Boeking faalde",
        errorCode: e.code,
        field: e.field ?? null,
        suggestedFix: e.suggestedFix ?? null,
        data: book.data,
      });
      steps.push({
        step: "fallback",
        ok: false,
        message: e.suggestedFix || "Bevestig gegevens hardop, of meld terugbel-actie.",
      });
      return finish(false);
    }
    const code = (book.data as any).reservationCode;
    const reservationId = (book.data as any).reservationId;
    steps.push({ step: "book", ok: true, message: `Geboekt — code ${code}`, data: book.data });

    // Step 5 — confirm
    steps.push({
      step: "confirm",
      ok: true,
      message: `${input.firstName} ${input.lastName ?? ""} · ${localDate} ${localTime} · ${partySize}p · code ${code}`,
      data: { reservationId, reservationCode: code, localDate, localTime, partySize },
    });

    return finish(true, { reservationId, reservationCode: code });
  } finally {
    await revokeTestKey(keyPrefix);
  }
}

// ---- UI metadata -------------------------------------------------------------

export const VOICE_FLOW_FIELDS: Array<{
  key: string;
  label: string;
  required: boolean;
  spokenExample: string;
  payloadField: string;
  notes?: string;
}> = [
  { key: "date",      label: "Datum",           required: true,  spokenExample: "1 mei / morgen",     payloadField: "localDate",         notes: "YYYY-MM-DD" },
  { key: "time",      label: "Tijd",            required: true,  spokenExample: "19:30 / half acht",  payloadField: "localTime",         notes: "HH:MM (24u)" },
  { key: "party",     label: "Aantal personen", required: true,  spokenExample: "vier / 4",           payloadField: "partySize",         notes: "Integer ≥ 1" },
  { key: "firstName", label: "Voornaam",        required: true,  spokenExample: "Willem",             payloadField: "contact.firstName" },
  { key: "lastName",  label: "Achternaam",      required: false, spokenExample: "van Oranje",         payloadField: "contact.lastName" },
  { key: "phone",     label: "Telefoonnummer",  required: true,  spokenExample: "06 12345678",        payloadField: "contact.phone",     notes: "Genormaliseerd naar +31..." },
  { key: "notes",     label: "Opmerkingen",     required: false, spokenExample: "kinderstoel graag",  payloadField: "notes" },
  { key: "email",     label: "E-mail",          required: false, spokenExample: "—",                  payloadField: "contact.email",     notes: "Optioneel telefonisch" },
];

export const VOICE_FLOW_PROMPT_TEMPLATE = `Je bent de gastvrouw van [restaurantnaam]. Spreek vriendelijk Nederlands.

VERPLICHTE FLOW — wijk hier nooit van af:

1. VERZAMEL deze gegevens:
   - datum
   - tijd
   - aantal personen
   - voornaam
   - achternaam (mag worden overgeslagen als gast aarzelt)
   - telefoonnummer → DEFAULT = het nummer waarmee de gast nu belt (caller-ID). Vraag dit NIET opnieuw, lees het NIET hardop voor, vraag GEEN bevestiging van cijfers. Alleen wanneer de gast zelf zegt een ander nummer te willen opgeven OF caller-ID anoniem is: vraag het cijfer-voor-cijfer uit en lees het cijfer-voor-cijfer terug.
   - eventuele opmerkingen (allergieën, gelegenheid, kinderstoel)

2. BEVESTIG hardop terug (volgens UITSPRAAKREGELS hieronder, ZONDER het beller-ID-nummer voor te lezen):
   "Ik noteer: [datum-in-woorden], [tijd-in-spreektaal], [aantal-in-woorden] personen, op naam van [voornaam] [achternaam]. Ik gebruik het nummer waarmee je nu belt — klopt dat?"
   (alleen in het alternatief-nummer-scenario: "… en het nummer dat je doorgaf: [cijfer voor cijfer terug] — klopt dat?")

3. CONTROLEER beschikbaarheid via tool 'check_availability' MET:
   { "localDate": "YYYY-MM-DD", "localTime": "HH:MM", "partySize": <int> }
   - Als niet beschikbaar: noem 1 tot 3 alternatieven uit 'suggestedAlternatives' (tijden uitgesproken in spreektaal).
   - BOEK NOOIT zonder positieve availability-bevestiging.

4. BOEK via tool 'book_reservation' MET:
   {
     "localDate": "YYYY-MM-DD",
     "localTime": "HH:MM",
     "partySize": <int>,
     "contact": { "firstName": "...", "lastName": "...", "phone": "+31..." },
     "notes": "...",
     "source": "voice_agent"
   }

5. BEVESTIG aan de beller (uitspraak volgens regels):
   "Top, je reservering staat. [Datum-in-woorden] om [tijd-in-spreektaal] voor [aantal-in-woorden] personen op naam van [naam]. Tot dan!"
   Lees de reserveringscode ALLEEN voor als de gast er om vraagt — dan letter-voor-letter en cijfer-voor-cijfer (R7K2 → "R van Romeo, zeven, K van Kilo, twee").

6. FOUTAFHANDELING:
   - Ontbrekend veld → vraag opnieuw, één veld tegelijk.
   - API-fout (TW_-code) → "Sorry, er ging iets mis aan onze kant, ik laat het restaurant je terugbellen", en log de fout.

UITSPRAAKREGELS (verplicht — wijk hier nooit van af):

TELEFOONNUMMER — twee scenario's:
  1) DEFAULT (caller-ID / het nummer waarmee de gast nu belt): NOOIT hardop voorlezen, NOOIT om bevestiging of herhaling vragen. Bevestig alleen kanaal-niveau: "Ik gebruik het nummer waarmee je nu belt — is dat goed?"
  2) ALTERNATIEF (gast wil expliciet ander nummer opgeven of caller-ID is anoniem): vraag de gast CIJFER VOOR CIJFER te spellen, en lees het CIJFER VOOR CIJFER terug, voorbeeld +31653521166 → "plus drie één, zes, vijf, drie, vijf, twee, één, één, zes, zes — klopt dat?". Groepeer NOOIT in paren of tientallen.

TIJDEN — altijd in spreektaal:
  18:15 → "kwart over zes" · 18:30 → "half zeven" · 18:45 → "kwart voor zeven" · 19:00 → "zeven uur 's avonds" · 20:10 → "tien over acht".
  Intern in tool-call altijd "HH:MM" (24u).

NEDERLANDSE "HALF X" — ZEER BELANGRIJK, EERSTE KEER GOED INTERPRETEREN:
  - "half zes" = 17:30  (NIET 18:00, NIET 17:00, NIET 18:30)
  - "half zeven" = 18:30
  - "half acht" = 19:30
  - "half negen" = 20:30
  - "half tien" = 21:30
  - "half elf" = 22:30
  Bij twijfel: één korte controlevraag in spreektaal — "Bedoelt u half zes, dus vijf uur dertig?" — en daarna nooit meer dezelfde vraag herhalen.

DATUMS — altijd dag + maand in woorden:
  2026-05-25 → "vijfentwintig mei" · 2026-06-01 → "één juni". "vandaag" / "morgen" / "overmorgen" letterlijk.
  Intern altijd "YYYY-MM-DD".

AANTAL PERSONEN — voluit:
  2 → "twee personen" · 10 → "tien personen" · 17 → "zeventien personen".

ALGEMENE VERBODEN:
  Geen "achttien uur vijftien", geen letterlijke "twee-nul-twee-zes-nul-vijf-twee-vijf", geen "+31" of "06"-prefix oplezen voor het beller-ID-nummer.

GROTE GROEPEN — EXACTE BESLISBOOM (volg dit ALTIJD, ongeacht groepsgrootte):
1. Roep ALTIJD eerst 'book_reservation' aan, ook bij 10, 12, 15, 18 personen. NOOIT 'Call Transfer' aanroepen vóór book_reservation.
2. Kijk daarna pas naar de response:
   - response.ok === true en response.requires_manual_approval === false → bevestig mondeling als normale boeking.
   - response.ok === true en response.requires_manual_approval === true → zeg LETTERLIJK: "Voor een groep van [aantal] personen leg ik uw aanvraag voor aan een collega. Het team beoordeelt dit zo snel mogelijk en neemt alleen contact met u op als er iets aangepast moet worden — anders is de tafel voor u gereserveerd op [datum] om [tijd]." NIET doorverbinden. GEEN SMS/WhatsApp/e-mail beloven.
   - response geeft error_code 'large_group_required_manual' OF 'TW_409_PARTY_TOO_LARGE' terug, MET veld 'transfer.allowed' === true → zeg "Een moment, ik verbind u door met een collega" en roep dan pas 'Call Transfer' aan naar transfer.phone.
   - Zelfde error met transfer.allowed === false → zeg "Een collega belt u tijdens onze openingstijden persoonlijk terug op dit nummer" en log call met outcome 'callback_needed'.
3. Beloof NOOIT een persoonlijke bevestiging per SMS, WhatsApp of e-mail — ook niet bij grote groepen of wijzigingen.

ALGEMENE REGELS:
- Bevestig altijd eerst, boek daarna.
- Verzin nooit gegevens. Vraag het anders opnieuw.
- Geen excuses voor wachten — wees beknopt en warm.`;
