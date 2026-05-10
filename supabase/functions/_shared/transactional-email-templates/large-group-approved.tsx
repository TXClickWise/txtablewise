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
  decisionNote?: string
  locale?: string
}

// Note: this template is rendered when a large-group request is APPROVED.
// The rejected variant uses `large-group-rejected`.
const LargeGroupApproved = ({ copy, dateLabel, timeLabel, partySize, decisionNote, locale = 'nl' }: Props) => (
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
        {decisionNote && <Text style={text}>{decisionNote}</Text>}
        {copy.outro && <Text style={text}>{copy.outro}</Text>}
        {copy.signature && <Text style={footer}>{copy.signature}</Text>}
      </Container>
    </Body>
  </Html>
)

export const defaultCopy: LocaleCopy = {
  nl: {
    subject: 'Groepsaanvraag bevestigd — {{restaurantName}}',
    preview: 'Goed nieuws — je groepsaanvraag bij {{restaurantName}} is bevestigd',
    heading: 'Goed nieuws, {{guestName}}!',
    intro: 'Je groepsaanvraag bij {{restaurantName}} is bevestigd. We kijken ernaar uit jullie te ontvangen.',
    outro: 'Vragen of opmerkingen? Beantwoord deze mail om contact op te nemen met {{restaurantName}}.',
    signature: 'Hartelijke groet, het team van {{restaurantName}}',
    labelDate: 'Datum', labelTime: 'Tijd', labelParty: 'Aantal gasten',
  },
  en: {
    subject: 'Group request confirmed — {{restaurantName}}',
    preview: 'Great news — your group request at {{restaurantName}} is confirmed',
    heading: 'Great news, {{guestName}}!',
    intro: 'Your group request at {{restaurantName}} is confirmed. We look forward to welcoming you.',
    outro: 'Questions or remarks? Reply to this email to reach {{restaurantName}}.',
    signature: 'Warm regards, the team at {{restaurantName}}',
    labelDate: 'Date', labelTime: 'Time', labelParty: 'Guests',
  },
  de: {
    subject: 'Gruppenanfrage bestätigt — {{restaurantName}}',
    preview: 'Gute Nachricht — Ihre Gruppenanfrage bei {{restaurantName}} ist bestätigt',
    heading: 'Gute Nachricht, {{guestName}}!',
    intro: 'Ihre Gruppenanfrage bei {{restaurantName}} ist bestätigt. Wir freuen uns auf Sie.',
    outro: 'Fragen oder Anmerkungen? Antworten Sie auf diese E-Mail, um {{restaurantName}} zu erreichen.',
    signature: 'Herzliche Grüße, das Team von {{restaurantName}}',
    labelDate: 'Datum', labelTime: 'Uhrzeit', labelParty: 'Gäste',
  },
  fr: {
    subject: 'Demande de groupe confirmée — {{restaurantName}}',
    preview: 'Bonne nouvelle — votre demande de groupe au {{restaurantName}} est confirmée',
    heading: 'Bonne nouvelle, {{guestName}} !',
    intro: 'Votre demande de groupe au {{restaurantName}} est confirmée. Nous avons hâte de vous accueillir.',
    outro: 'Des questions ou remarques ? Répondez à cet e-mail pour joindre {{restaurantName}}.',
    signature: 'Cordialement, l’équipe du {{restaurantName}}',
    labelDate: 'Date', labelTime: 'Heure', labelParty: 'Convives',
  },
}

export const template = {
  component: LargeGroupApproved,
  subject: (d: Record<string, any>) => d.copy?.subject || defaultCopy.nl.subject,
  displayName: 'Groep — bevestigd',
  templateKey: 'large-group-approved',
  defaultCopy,
  previewData: {
    copy: defaultCopy.nl,
    guestName: 'Jane',
    dateLabel: 'zaterdag 17 mei',
    timeLabel: '19:00',
    partySize: 12,
    decisionNote: 'We hebben de grote tafel achterin voor jullie gereserveerd.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#111827', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const card = { backgroundColor: '#f9fafb', borderRadius: '8px', padding: '14px 18px', margin: '0 0 20px' }
const cardLine = { fontSize: '14px', color: '#111827', margin: '4px 0' }
const footer = { fontSize: '13px', color: '#6b7280', margin: '28px 0 0' }
