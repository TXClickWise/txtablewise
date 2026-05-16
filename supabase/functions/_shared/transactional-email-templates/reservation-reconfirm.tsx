import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import type { CopyFields, LocaleCopy } from './i18n.ts'

interface Props {
  copy: CopyFields
  guestName?: string
  dateLabel?: string
  timeLabel?: string
  partySize?: number
  confirmUrl?: string
  cancelUrl?: string
  manageUrl?: string
  locale?: string
}

const ReservationReconfirm = ({
  copy, dateLabel, timeLabel, partySize, confirmUrl, cancelUrl, locale = 'nl',
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
        <Section style={{ textAlign: 'center', margin: '24px 0' }}>
          {confirmUrl && (
            <Button href={confirmUrl} style={btnPrimary}>
              {copy.ctaConfirm || 'Ja, ik kom'}
            </Button>
          )}
          {cancelUrl && (
            <>
              {' '}
              <Button href={cancelUrl} style={btnSecondary}>
                {copy.ctaCancel || 'Nee, ik kan niet'}
              </Button>
            </>
          )}
        </Section>
        {copy.outro && <Text style={text}>{copy.outro}</Text>}
        {copy.signature && <Text style={footer}>{copy.signature}</Text>}
      </Container>
    </Body>
  </Html>
)

export const defaultCopy: LocaleCopy = {
  nl: {
    subject: 'Bevestig je reservering bij {{restaurantName}}',
    preview: 'Kun je bevestigen dat je komt bij {{restaurantName}}?',
    heading: 'Hoi {{guestName}},',
    intro: 'Kun je bevestigen dat je {{dateLabel}} om {{timeLabel}} komt bij {{restaurantName}}?',
    outro: 'Door even te bevestigen help je ons de avond goed voor te bereiden.',
    signature: 'Bedankt, het team van {{restaurantName}}',
    labelDate: 'Datum', labelTime: 'Tijd', labelParty: 'Aantal gasten',
    ctaConfirm: 'Ja, ik kom', ctaCancel: 'Nee, ik kan niet',
  },
  en: {
    subject: 'Please confirm your reservation at {{restaurantName}}',
    preview: 'Can you confirm your reservation at {{restaurantName}}?',
    heading: 'Hi {{guestName}},',
    intro: 'Can you confirm that you are coming on {{dateLabel}} at {{timeLabel}} to {{restaurantName}}?',
    outro: 'A quick confirmation helps us prepare the evening.',
    signature: 'Thanks, the team at {{restaurantName}}',
    labelDate: 'Date', labelTime: 'Time', labelParty: 'Guests',
    ctaConfirm: 'Yes, I will be there', ctaCancel: 'No, I cannot make it',
  },
  de: {
    subject: 'Bitte bestätigen Sie Ihre Reservierung bei {{restaurantName}}',
    preview: 'Können Sie Ihre Reservierung bei {{restaurantName}} bestätigen?',
    heading: 'Hallo {{guestName}},',
    intro: 'Können Sie bestätigen, dass Sie am {{dateLabel}} um {{timeLabel}} bei {{restaurantName}} kommen?',
    outro: 'Eine kurze Bestätigung hilft uns, den Abend gut vorzubereiten.',
    signature: 'Vielen Dank, das Team von {{restaurantName}}',
    labelDate: 'Datum', labelTime: 'Uhrzeit', labelParty: 'Gäste',
    ctaConfirm: 'Ja, ich komme', ctaCancel: 'Nein, ich kann nicht',
  },
  fr: {
    subject: 'Veuillez confirmer votre réservation au {{restaurantName}}',
    preview: 'Pouvez-vous confirmer votre réservation au {{restaurantName}} ?',
    heading: 'Bonjour {{guestName}},',
    intro: 'Pouvez-vous confirmer que vous viendrez le {{dateLabel}} à {{timeLabel}} au {{restaurantName}} ?',
    outro: 'Une confirmation rapide nous aide à bien préparer la soirée.',
    signature: 'Merci, l’équipe du {{restaurantName}}',
    labelDate: 'Date', labelTime: 'Heure', labelParty: 'Convives',
    ctaConfirm: 'Oui, je viens', ctaCancel: 'Non, je ne peux pas',
  },
}

export const template = {
  component: ReservationReconfirm,
  subject: (d: Record<string, any>) => d.copy?.subject || defaultCopy.nl.subject,
  displayName: 'Herbevestiging gevraagd',
  templateKey: 'reservation-reconfirm',
  defaultCopy,
  previewData: {
    copy: defaultCopy.nl,
    guestName: 'Jane',
    dateLabel: 'vrijdag 16 mei',
    timeLabel: '19:30',
    partySize: 4,
    confirmUrl: 'https://example.com/confirm',
    cancelUrl: 'https://example.com/cancel',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#111827', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const card = { backgroundColor: '#f9fafb', borderRadius: '8px', padding: '14px 18px', margin: '0 0 20px' }
const cardLine = { fontSize: '14px', color: '#111827', margin: '4px 0' }
const btnPrimary = { backgroundColor: '#111827', color: '#ffffff', padding: '12px 22px', borderRadius: '8px', textDecoration: 'none', fontSize: '15px', fontWeight: 'bold', minHeight: '44px', display: 'inline-block', margin: '4px' }
const btnSecondary = { backgroundColor: '#ffffff', color: '#111827', padding: '12px 22px', borderRadius: '8px', textDecoration: 'none', fontSize: '15px', fontWeight: 'bold', minHeight: '44px', display: 'inline-block', border: '1px solid #d1d5db', margin: '4px' }
const footer = { fontSize: '13px', color: '#6b7280', margin: '28px 0 0' }
