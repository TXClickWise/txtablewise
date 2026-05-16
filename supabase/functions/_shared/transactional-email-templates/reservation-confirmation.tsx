import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text,
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
  manageUrl?: string
  cancelUrl?: string
  locale?: string
}

const ReservationConfirmation = ({
  copy, guestName, dateLabel, timeLabel, partySize, notesToGuest,
  manageUrl, cancelUrl, locale = 'nl',
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

        {manageUrl && (
          <>
            <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
              <Button href={manageUrl} style={btnPrimary}>
                {copy.ctaManage || 'Beheer je reservering'}
              </Button>
            </Section>
            {copy.manageHint && (
              <Text style={hint}>{copy.manageHint}</Text>
            )}
            {cancelUrl && (
              <Text style={hint}>
                <Link href={cancelUrl} style={linkMuted}>
                  {copy.ctaCancel || 'Kan je niet komen? Laat het ons weten'}
                </Link>
              </Text>
            )}
            <Hr style={hr} />
          </>
        )}

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
    outro: 'Heb je een vraag? Beantwoord deze mail, dan helpt {{restaurantName}} je verder.',
    signature: 'Tot snel, het team van {{restaurantName}}',
    labelDate: 'Datum', labelTime: 'Tijd', labelParty: 'Aantal gasten',
    ctaManage: 'Beheer je reservering',
    ctaCancel: 'Kan je niet komen? Laat het ons weten',
    manageHint: 'Pas eenvoudig zelf de datum, tijd of het aantal gasten aan.',
  },
  en: {
    subject: 'Reservation confirmed — {{restaurantName}}',
    preview: 'Your reservation at {{restaurantName}} is confirmed',
    heading: 'Thank you, {{guestName}}!',
    intro: 'Your reservation at {{restaurantName}} is confirmed. We look forward to welcoming you.',
    outro: 'Any questions? Reply to this email and {{restaurantName}} will help you out.',
    signature: 'See you soon, the team at {{restaurantName}}',
    labelDate: 'Date', labelTime: 'Time', labelParty: 'Guests',
    ctaManage: 'Manage your reservation',
    ctaCancel: 'Can\u2019t make it? Let us know',
    manageHint: 'Easily update the date, time or number of guests yourself.',
  },
  de: {
    subject: 'Reservierung bestätigt — {{restaurantName}}',
    preview: 'Ihre Reservierung bei {{restaurantName}} ist bestätigt',
    heading: 'Vielen Dank, {{guestName}}!',
    intro: 'Ihre Reservierung bei {{restaurantName}} ist bestätigt. Wir freuen uns auf Ihren Besuch.',
    outro: 'Fragen? Antworten Sie einfach auf diese E-Mail, dann hilft {{restaurantName}} gerne weiter.',
    signature: 'Bis bald, das Team von {{restaurantName}}',
    labelDate: 'Datum', labelTime: 'Uhrzeit', labelParty: 'Gäste',
    ctaManage: 'Reservierung verwalten',
    ctaCancel: 'Klappt es doch nicht? Sagen Sie uns Bescheid',
    manageHint: 'Ändern Sie bequem selbst Datum, Uhrzeit oder Gästezahl.',
  },
  fr: {
    subject: 'Réservation confirmée — {{restaurantName}}',
    preview: 'Votre réservation au {{restaurantName}} est confirmée',
    heading: 'Merci, {{guestName}} !',
    intro: 'Votre réservation au {{restaurantName}} est confirmée. Nous avons hâte de vous accueillir.',
    outro: 'Une question ? Répondez à cet e-mail et {{restaurantName}} vous aidera.',
    signature: 'À très vite, l\u2019équipe du {{restaurantName}}',
    labelDate: 'Date', labelTime: 'Heure', labelParty: 'Convives',
    ctaManage: 'Gérer ma réservation',
    ctaCancel: 'Un imprévu ? Prévenez-nous',
    manageHint: 'Modifiez vous-même facilement la date, l\u2019heure ou le nombre de convives.',
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
    manageUrl: 'https://example.com/r/manage/preview-token',
    cancelUrl: 'https://example.com/r/manage/preview-token?action=cancel',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#111827', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const card = { backgroundColor: '#f9fafb', borderRadius: '8px', padding: '14px 18px', margin: '0 0 20px' }
const cardLine = { fontSize: '14px', color: '#111827', margin: '4px 0' }
const hint = { fontSize: '13px', color: '#6b7280', textAlign: 'center' as const, margin: '4px 0' }
const linkMuted = { color: '#6b7280', textDecoration: 'underline' }
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
const btnPrimary = { backgroundColor: '#111827', color: '#ffffff', padding: '12px 22px', borderRadius: '8px', textDecoration: 'none', fontSize: '15px', fontWeight: 'bold', minHeight: '44px', display: 'inline-block' }
const footer = { fontSize: '13px', color: '#6b7280', margin: '28px 0 0' }
