import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import type { CopyFields, LocaleCopy } from './i18n.ts'

interface Props {
  copy: CopyFields
  guestName?: string
  dateLabel?: string
  timeLabel?: string
  partySize?: number
  desiredDateLabel?: string
  desiredTimeLabel?: string
  desiredPartySize?: number
  message?: string
  locale?: string
}

const ReservationChangeReceived = ({
  copy, guestName, dateLabel, timeLabel, partySize,
  desiredDateLabel, desiredTimeLabel, desiredPartySize, message, locale = 'nl',
}: Props) => (
  <Html lang={locale} dir="ltr">
    <Head />
    <Preview>{copy.preview || copy.subject}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{copy.heading}</Heading>
        <Text style={text}>{copy.intro}</Text>
        <Section style={card}>
          <Text style={cardLabel}>{copy.labelCurrent}</Text>
          {dateLabel && <Text style={cardLine}><strong>{copy.labelDate}:</strong> {dateLabel}</Text>}
          {timeLabel && <Text style={cardLine}><strong>{copy.labelTime}:</strong> {timeLabel}</Text>}
          {partySize && <Text style={cardLine}><strong>{copy.labelParty}:</strong> {partySize}</Text>}
        </Section>
        <Section style={card}>
          <Text style={cardLabel}>{copy.labelRequested}</Text>
          {desiredDateLabel && <Text style={cardLine}><strong>{copy.labelDate}:</strong> {desiredDateLabel}</Text>}
          {desiredTimeLabel && <Text style={cardLine}><strong>{copy.labelTime}:</strong> {desiredTimeLabel}</Text>}
          {desiredPartySize && <Text style={cardLine}><strong>{copy.labelParty}:</strong> {desiredPartySize}</Text>}
          {message && <Text style={cardLine}><strong>{copy.labelMessage}:</strong> {message}</Text>}
        </Section>
        {copy.outro && <Text style={text}>{copy.outro}</Text>}
        {copy.signature && <Text style={footer}>{copy.signature}</Text>}
      </Container>
    </Body>
  </Html>
)

export const defaultCopy: LocaleCopy = {
  nl: {
    subject: 'Wijzigingsverzoek ontvangen — {{restaurantName}}',
    preview: 'We hebben je wijzigingsverzoek ontvangen',
    heading: 'Bedankt, {{guestName}}',
    intro: 'We hebben je wijzigingsverzoek voor je reservering bij {{restaurantName}} ontvangen. We bekijken het zo snel mogelijk en laten je weten of het past.',
    outro: 'Je hoeft niets te doen — je krijgt automatisch bericht zodra het verzoek is verwerkt.',
    signature: 'Tot snel, het team van {{restaurantName}}',
    labelDate: 'Datum', labelTime: 'Tijd', labelParty: 'Aantal gasten',
    labelCurrent: 'Huidige reservering', labelRequested: 'Gewenste wijziging', labelMessage: 'Bericht',
  },
  en: {
    subject: 'Change request received — {{restaurantName}}',
    preview: 'We received your change request',
    heading: 'Thanks, {{guestName}}',
    intro: 'We received your change request for your reservation at {{restaurantName}}. We will review it shortly and let you know if it works.',
    outro: 'No action needed — you will be notified automatically.',
    signature: 'See you soon, the team at {{restaurantName}}',
    labelDate: 'Date', labelTime: 'Time', labelParty: 'Guests',
    labelCurrent: 'Current reservation', labelRequested: 'Requested change', labelMessage: 'Message',
  },
  de: {
    subject: 'Änderungsanfrage erhalten — {{restaurantName}}',
    preview: 'Wir haben Ihre Änderungsanfrage erhalten',
    heading: 'Danke, {{guestName}}',
    intro: 'Wir haben Ihre Änderungsanfrage für Ihre Reservierung bei {{restaurantName}} erhalten. Wir prüfen sie und melden uns.',
    outro: 'Sie erhalten automatisch eine Benachrichtigung, sobald Ihre Anfrage bearbeitet ist.',
    signature: 'Bis bald, das Team von {{restaurantName}}',
    labelDate: 'Datum', labelTime: 'Uhrzeit', labelParty: 'Gäste',
    labelCurrent: 'Aktuelle Reservierung', labelRequested: 'Gewünschte Änderung', labelMessage: 'Nachricht',
  },
  fr: {
    subject: 'Demande de modification reçue — {{restaurantName}}',
    preview: 'Nous avons reçu votre demande',
    heading: 'Merci, {{guestName}}',
    intro: 'Nous avons reçu votre demande de modification pour votre réservation au {{restaurantName}}. Nous l’examinons rapidement.',
    outro: 'Aucune action requise — vous recevrez automatiquement une réponse.',
    signature: 'À très vite, l’équipe du {{restaurantName}}',
    labelDate: 'Date', labelTime: 'Heure', labelParty: 'Convives',
    labelCurrent: 'Réservation actuelle', labelRequested: 'Modification souhaitée', labelMessage: 'Message',
  },
}

export const template = {
  component: ReservationChangeReceived,
  subject: (d: Record<string, any>) => d.copy?.subject || defaultCopy.nl.subject,
  displayName: 'Wijzigingsverzoek ontvangen',
  templateKey: 'reservation-change-received',
  defaultCopy,
  previewData: {
    copy: defaultCopy.nl, guestName: 'Jane',
    dateLabel: 'vrijdag 16 mei', timeLabel: '19:30', partySize: 4,
    desiredDateLabel: 'zaterdag 17 mei', desiredTimeLabel: '20:00', desiredPartySize: 6,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#111827', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const card = { backgroundColor: '#f9fafb', borderRadius: '8px', padding: '14px 18px', margin: '0 0 16px' }
const cardLabel = { fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 6px' }
const cardLine = { fontSize: '14px', color: '#111827', margin: '4px 0' }
const footer = { fontSize: '13px', color: '#6b7280', margin: '28px 0 0' }
