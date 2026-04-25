
# Plan — Verzenddomein corrigeren vóór Stap 3

## Waarom

Het e-maildomein voor deze app staat nu op `notify.emails.txeventshare.nl`. Dat is een subdomein van een ander project (txeventshare.nl) en hoort niet bij TableWise. Status is bovendien **failed** — dus dit is het juiste moment om schoon te resetten, vóór we templates en reminders bouwen.

## Aanpak in 3 fasen

### Fase 1 — Loskoppelen van txeventshare (ik doe dit)

1. Lovable Emails uitzetten voor dit TableWise-project, zodat de koppeling met `notify.emails.txeventshare.nl` wordt verbroken.
2. Je krijgt van mij de exacte NS-records die je bij de registrar van **txeventshare.nl** mag verwijderen, zodat dat domein helemaal schoon is en geen relatie meer heeft met TableWise.

Resultaat: TableWise heeft tijdelijk geen custom verzenddomein. Auth-mails vallen terug op Lovable's default templates. Transactionele mails (die we nog niet bouwen) zijn uit. Geen impact op de werking van de app zelf.

### Fase 2 — TableWise eigen verzenddomein opzetten (jouw keuze nodig)

Hiervoor moet jij eerst kiezen welk domein TableWise gaat gebruiken. Opties:

- **A. Je huidige Lovable-subdomein** (`txtablewise.lovable.app`) — werkt niet als verzenddomein, dus dit is alleen ok als je nu nog géén custom afzender wilt. Dan slaan we Fase 2 over en draaien we tijdelijk op default afzender.
- **B. Een eigen domein dat je al bezit** — bijv. `tablewise.nl`, `tablewise.app`, of iets anders specifiek voor dit product. Ik zet dan `notify.emails.<jouwdomein>` op als verzendsubdomein.
- **C. Een nieuw domein registreren** — kan rechtstreeks vanuit Lovable (Project Settings → Domains → Buy new domain). Daarna gebruiken we dat als basis.

Zodra je een keuze hebt:
1. Ik open de e-mailsetup voor het gekozen domein.
2. Jij voegt de NS-records toe bij je registrar (of bij Lovable als je het daar hebt gekocht — dan doe ik het).
3. Lovable verifieert DNS automatisch (kan tot 72 uur duren, meestal sneller).
4. Zodra status `active` is, kunnen we Stap 3 starten.

### Fase 3 — Stap 3 hervatten (nadat Fase 2 klaar is)

Pas wanneer het juiste verzenddomein actief is, ga ik door met wat eerder gepland was:
1. E-mailinfrastructuur opzetten (queue, suppression, unsubscribe).
2. Vier Nederlandse hospitality-templates: bevestiging, reminder 24u, reminder 2u, annulering.
3. Bevestigingsmail koppelen aan `book_reservation` met idempotency.
4. Reminder-dispatcher edge function + cron-job (elke 5 min).
5. Guest magic link in e-mails opnemen.

Alle templates krijgen TableWise-branding en Nederlandse hospitality-microcopy — geen verwijzing naar txeventshare.

## Wat ik nu nodig heb van jou

Na goedkeuring van dit plan voer ik **Fase 1** direct uit. Voor **Fase 2** heb ik je antwoord nodig op:

> **Welk domein gaat TableWise gebruiken voor verzending?**
> (A) tijdelijk geen custom domein, (B) een domein dat je al hebt — welke?, of (C) nieuw domein registreren

Die vraag stel ik je via een keuzedialoog zodra Fase 1 klaar is.

## Wat ik niet doe

- Geen wijzigingen aan de app-functionaliteit, database, of bestaande edge functions.
- Geen nieuwe e-mailtemplates voordat het juiste domein staat.
- Geen aanpassingen aan andere projecten van jou (txeventshare blijft ongemoeid; ik geef alleen instructies welke NS-records jij daar mag opruimen).
