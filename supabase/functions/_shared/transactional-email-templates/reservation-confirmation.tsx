import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import type { CopyFields, LocaleCopy } from './i18n.ts'

interface Props {
  copy: CopyFields
  guestName?: string
  dateLabel?: string
  timeLabel?: string
  partySize?: number
  notesToGuest?: string
  locale?: string
}

const ReservationConfirmation = ({
  copy, guestName, dateLabel, timeLabel, partySize, notesToGuest, locale = 'nl',
}: Props) => (
  <Html lang={locale} dir="ltr">
    <Head />
    <Preview>{copy.preview || copy.subject}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{copy.heading}</Heading>
        <Text style={text}>{copy.intro}</Text>
        {(dateLabel || timeLabel || partySize) && (
          <Section style={card}>
            {dateLabel && <Text style={cardLine}><strong>{copy.labelDate}:</strong> {dateLabel}</Text>}
            {timeLabel && <Text style={cardLine}><strong>{copy.labelTime}:</strong> {timeLabel}</Text>}
            {partySize && <Text style={cardLine}><strong>{copy.labelParty}:</strong> {partySize}</Text>}
          </Section>
        )}
        {notesToGuest && <Text style={text}>{notesToGuest}</Text>}
        {copy.outro && <Text style={text}>{copy.outro}</Text>}
        {copy.signature && <Text style={footer}>{copy.signature}</Text>}
      </Container>
    </Body>
  </Html>
)

export const defaultCopy: LocaleCopy = {
  nl: {
    subject: 'Reservering bevestigd — {{restaurantName}}',
    preview: 'Je reservering bij {{restaurantName}} is bevestigd',
    heading: 'Bedankt, {{guestName}}!',
    intro: 'Je reservering bij {{restaurantName}} is bevestigd. We kijken ernaar uit je te ontvangen.',
    outro: 'Lukt het onverhoopt toch niet? Laat het ons gerust weten — beantwoord deze mail om contact op te nemen met {{restaurantName}}.',
    signature: 'Tot snel, het team van {{restaurantName}}',
    labelDate: 'Datum', labelTime: 'Tijd', labelParty: 'Aantal gasten',
  },
  en: {
    subject: 'Reservation confirmed — {{restaurantName}}',
    preview: 'Your reservation at {{restaurantName}} is confirmed',
    heading: 'Thank you, {{guestName}}!',
    intro: 'Your reservation at {{restaurantName}} is confirmed. We look forward to welcoming you.',
    outro: 'Plans changed? Just reply to this email and we will take care of it together with {{restaurantName}}.',
    signature: 'See you soon, the team at {{restaurantName}}',
    labelDate: 'Date', labelTime: 'Time', labelParty: 'Guests',
  },
  de: {
    subject: 'Reservierung bestätigt — {{restaurantName}}',
    preview: 'Ihre Reservierung bei {{restaurantName}} ist bestätigt',
    heading: 'Vielen Dank, {{guestName}}!',
    intro: 'Ihre Reservierung bei {{restaurantName}} ist bestätigt. Wir freuen uns auf Ihren Besuch.',
    outro: 'Klappt es doch nicht? Antworten Sie einfach auf diese E-Mail, dann kümmern wir uns gemeinsam mit {{restaurantName}} darum.',
    signature: 'Bis bald, das Team von {{restaurantName}}',
    labelDate: 'Datum', labelTime: 'Uhrzeit', labelParty: 'Gäste',
  },
  fr: {
    subject: 'Réservation confirmée — {{restaurantName}}',
    preview: 'Votre réservation au {{restaurantName}} est confirmée',
    heading: 'Merci, {{guestName}} !',
    intro: 'Votre réservation au {{restaurantName}} est confirmée. Nous avons hâte de vous accueillir.',
    outro: 'Un imprévu ? Répondez simplement à cet e-mail, nous nous en occupons avec {{restaurantName}}.',
    signature: 'À très vite, l’équipe du {{restaurantName}}',
    labelDate: 'Date', labelTime: 'Heure', labelParty: 'Convives',
  },
}

export const template = {
  component: ReservationConfirmation,
  subject: (d: Record<string, any>) => d.copy?.subject || defaultCopy.nl.subject,
  displayName: 'Reservering bevestigd',
  templateKey: 'reservation-confirmation',
  defaultCopy,
  previewData: {
    copy: defaultCopy.nl,
    guestName: 'Jane',
    dateLabel: 'vrijdag 16 mei',
    timeLabel: '19:30',
    partySize: 4,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#111827', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const card = { backgroundColor: '#f9fafb', borderRadius: '8px', padding: '14px 18px', margin: '0 0 20px' }
const cardLine = { fontSize: '14px', color: '#111827', margin: '4px 0' }
const footer = { fontSize: '13px', color: '#6b7280', margin: '28px 0 0' }
