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
  reasonLabel?: string
  locale?: string
}

const ReservationChangeRejected = ({
  copy, guestName, dateLabel, timeLabel, partySize, reasonLabel, locale = 'nl',
}: Props) => (
  <Html lang={locale} dir="ltr">
    <Head />
    <Preview>{copy.preview || copy.subject}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{copy.heading}</Heading>
        <Text style={text}>{copy.intro}</Text>
        {reasonLabel && (
          <Section style={card}>
            <Text style={cardLine}><strong>{copy.labelReason}:</strong> {reasonLabel}</Text>
          </Section>
        )}
        <Section style={card2}>
          <Text style={cardLabel}>{copy.labelOriginal}</Text>
          {dateLabel && <Text style={cardLine}><strong>{copy.labelDate}:</strong> {dateLabel}</Text>}
          {timeLabel && <Text style={cardLine}><strong>{copy.labelTime}:</strong> {timeLabel}</Text>}
          {partySize && <Text style={cardLine}><strong>{copy.labelParty}:</strong> {partySize}</Text>}
        </Section>
        {copy.outro && <Text style={text}>{copy.outro}</Text>}
        {copy.signature && <Text style={footer}>{copy.signature}</Text>}
      </Container>
    </Body>
  </Html>
)

export const defaultCopy: LocaleCopy = {
  nl: {
    subject: 'Wijziging niet mogelijk — {{restaurantName}}',
    preview: 'Helaas konden we je wijziging niet doorvoeren',
    heading: 'Sorry, {{guestName}}',
    intro: 'Helaas kunnen we je gewenste wijziging op dit moment niet honoreren. Je oorspronkelijke reservering bij {{restaurantName}} blijft gewoon staan.',
    outro: 'Wil je iets anders proberen? Beantwoord deze mail of neem direct contact op met {{restaurantName}}.',
    signature: 'Met vriendelijke groet, het team van {{restaurantName}}',
    labelDate: 'Datum', labelTime: 'Tijd', labelParty: 'Aantal gasten',
    labelReason: 'Reden', labelOriginal: 'Je reservering blijft staan',
  },
  en: {
    subject: 'Change not possible — {{restaurantName}}',
    preview: 'We could not apply your change',
    heading: 'Sorry, {{guestName}}',
    intro: 'Unfortunately we cannot apply your requested change. Your original reservation at {{restaurantName}} remains in place.',
    outro: 'Want to try something else? Reply to this email or contact {{restaurantName}} directly.',
    signature: 'Kind regards, the team at {{restaurantName}}',
    labelDate: 'Date', labelTime: 'Time', labelParty: 'Guests',
    labelReason: 'Reason', labelOriginal: 'Your reservation stands',
  },
  de: {
    subject: 'Änderung nicht möglich — {{restaurantName}}',
    preview: 'Wir konnten Ihre Änderung nicht übernehmen',
    heading: 'Entschuldigung, {{guestName}}',
    intro: 'Leider können wir Ihre gewünschte Änderung nicht übernehmen. Ihre ursprüngliche Reservierung bei {{restaurantName}} bleibt bestehen.',
    outro: 'Möchten Sie etwas anderes versuchen? Antworten Sie auf diese E-Mail oder kontaktieren Sie {{restaurantName}} direkt.',
    signature: 'Freundliche Grüße, das Team von {{restaurantName}}',
    labelDate: 'Datum', labelTime: 'Uhrzeit', labelParty: 'Gäste',
    labelReason: 'Grund', labelOriginal: 'Ihre Reservierung bleibt bestehen',
  },
  fr: {
    subject: 'Modification impossible — {{restaurantName}}',
    preview: 'Nous n’avons pas pu appliquer votre modification',
    heading: 'Désolé, {{guestName}}',
    intro: 'Nous ne pouvons pas appliquer la modification demandée. Votre réservation initiale au {{restaurantName}} reste en place.',
    outro: 'Vous souhaitez essayer autre chose ? Répondez à cet e-mail ou contactez {{restaurantName}} directement.',
    signature: 'Cordialement, l’équipe du {{restaurantName}}',
    labelDate: 'Date', labelTime: 'Heure', labelParty: 'Convives',
    labelReason: 'Raison', labelOriginal: 'Votre réservation est maintenue',
  },
}

export const template = {
  component: ReservationChangeRejected,
  subject: (d: Record<string, any>) => d.copy?.subject || defaultCopy.nl.subject,
  displayName: 'Wijziging niet mogelijk',
  templateKey: 'reservation-change-rejected',
  defaultCopy,
  previewData: {
    copy: defaultCopy.nl, guestName: 'Jane',
    dateLabel: 'vrijdag 16 mei', timeLabel: '19:30', partySize: 4,
    reasonLabel: 'Geen plek beschikbaar voor het gewenste tijdstip',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#111827', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const card = { backgroundColor: '#fef2f2', borderRadius: '8px', padding: '14px 18px', margin: '0 0 16px', borderLeft: '3px solid #dc2626' }
const card2 = { backgroundColor: '#f9fafb', borderRadius: '8px', padding: '14px 18px', margin: '0 0 20px' }
const cardLabel = { fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 6px' }
const cardLine = { fontSize: '14px', color: '#111827', margin: '4px 0' }
const footer = { fontSize: '13px', color: '#6b7280', margin: '28px 0 0' }
