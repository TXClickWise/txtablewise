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
  locale?: string
}

const ReservationReminder = ({ copy, dateLabel, timeLabel, partySize, locale = 'nl' }: Props) => (
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
        {copy.outro && <Text style={text}>{copy.outro}</Text>}
        {copy.signature && <Text style={footer}>{copy.signature}</Text>}
      </Container>
    </Body>
  </Html>
)

export const defaultCopy: LocaleCopy = {
  nl: {
    subject: 'Tot morgen bij {{restaurantName}}',
    preview: 'Een herinnering aan je reservering bij {{restaurantName}}',
    heading: 'Tot morgen, {{guestName}}!',
    intro: 'Een vriendelijke herinnering aan je reservering bij {{restaurantName}}.',
    outro: 'Plannen veranderd? Beantwoord deze mail om contact op te nemen met {{restaurantName}}, dan zorgen we dat je tafel beschikbaar blijft voor andere gasten.',
    signature: 'Tot snel, het team van {{restaurantName}}',
    labelDate: 'Datum', labelTime: 'Tijd', labelParty: 'Aantal gasten',
  },
  en: {
    subject: 'See you tomorrow at {{restaurantName}}',
    preview: 'A reminder about your reservation at {{restaurantName}}',
    heading: 'See you tomorrow, {{guestName}}!',
    intro: 'A friendly reminder of your reservation at {{restaurantName}}.',
    outro: 'Plans changed? Reply to this email to let {{restaurantName}} know, and we will free up your table for other guests.',
    signature: 'See you soon, the team at {{restaurantName}}',
    labelDate: 'Date', labelTime: 'Time', labelParty: 'Guests',
  },
  de: {
    subject: 'Bis morgen bei {{restaurantName}}',
    preview: 'Eine Erinnerung an Ihre Reservierung bei {{restaurantName}}',
    heading: 'Bis morgen, {{guestName}}!',
    intro: 'Eine freundliche Erinnerung an Ihre Reservierung bei {{restaurantName}}.',
    outro: 'Pläne geändert? Antworten Sie auf diese E-Mail, damit {{restaurantName}} den Tisch für andere Gäste freigeben kann.',
    signature: 'Bis bald, das Team von {{restaurantName}}',
    labelDate: 'Datum', labelTime: 'Uhrzeit', labelParty: 'Gäste',
  },
  fr: {
    subject: 'À demain au {{restaurantName}}',
    preview: 'Un rappel concernant votre réservation au {{restaurantName}}',
    heading: 'À demain, {{guestName}} !',
    intro: 'Un rappel amical concernant votre réservation au {{restaurantName}}.',
    outro: 'Vos plans changent ? Répondez à cet e-mail pour prévenir {{restaurantName}}, nous libérerons votre table pour d’autres convives.',
    signature: 'À très vite, l’équipe du {{restaurantName}}',
    labelDate: 'Date', labelTime: 'Heure', labelParty: 'Convives',
  },
}

export const template = {
  component: ReservationReminder,
  subject: (d: Record<string, any>) => d.copy?.subject || defaultCopy.nl.subject,
  displayName: 'Reservering herinnering',
  templateKey: 'reservation-reminder',
  defaultCopy,
  previewData: {
    copy: defaultCopy.nl,
    guestName: 'Jane',
    dateLabel: 'morgen',
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
