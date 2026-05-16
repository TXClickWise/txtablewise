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
  manageUrl?: string
  cancelUrl?: string
  locale?: string
}

const ReservationChangeApproved = ({
  copy, guestName, dateLabel, timeLabel, partySize, manageUrl, cancelUrl, locale = 'nl',
}: Props) => (
  <Html lang={locale} dir="ltr">
    <Head />
    <Preview>{copy.preview || copy.subject}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{copy.heading}</Heading>
        <Text style={text}>{copy.intro}</Text>
        <Section style={card}>
          {dateLabel && <Text style={cardLine}><strong>{copy.labelDate}:</strong> {dateLabel}</Text>}
          {timeLabel && <Text style={cardLine}><strong>{copy.labelTime}:</strong> {timeLabel}</Text>}
          {partySize && <Text style={cardLine}><strong>{copy.labelParty}:</strong> {partySize}</Text>}
        </Section>

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
    subject: 'Wijziging bevestigd — {{restaurantName}}',
    preview: 'Je gewijzigde reservering is bevestigd',
    heading: 'Geregeld, {{guestName}}!',
    intro: 'Je wijziging bij {{restaurantName}} is doorgevoerd. Hierbij de bijgewerkte gegevens.',
    outro: 'Tot dan! Mocht er iets veranderen, beantwoord dan gerust deze mail.',
    signature: 'Tot snel, het team van {{restaurantName}}',
    labelDate: 'Datum', labelTime: 'Tijd', labelParty: 'Aantal gasten',
    ctaManage: 'Beheer je reservering',
    ctaCancel: 'Kan je niet komen? Laat het ons weten',
    manageHint: 'Pas eenvoudig zelf de datum, tijd of het aantal gasten aan.',
  },
  en: {
    subject: 'Change confirmed — {{restaurantName}}',
    preview: 'Your updated reservation is confirmed',
    heading: 'All set, {{guestName}}!',
    intro: 'Your change at {{restaurantName}} has been applied. Here are the updated details.',
    outro: 'Anything else? Just reply to this email.',
    signature: 'See you soon, the team at {{restaurantName}}',
    labelDate: 'Date', labelTime: 'Time', labelParty: 'Guests',
    ctaManage: 'Manage your reservation',
    ctaCancel: 'Can\u2019t make it? Let us know',
    manageHint: 'Easily update the date, time or number of guests yourself.',
  },
  de: {
    subject: 'Änderung bestätigt — {{restaurantName}}',
    preview: 'Ihre aktualisierte Reservierung ist bestätigt',
    heading: 'Alles klar, {{guestName}}!',
    intro: 'Ihre Änderung bei {{restaurantName}} wurde übernommen. Hier die aktualisierten Daten.',
    outro: 'Noch Fragen? Antworten Sie einfach auf diese E-Mail.',
    signature: 'Bis bald, das Team von {{restaurantName}}',
    labelDate: 'Datum', labelTime: 'Uhrzeit', labelParty: 'Gäste',
    ctaManage: 'Reservierung verwalten',
    ctaCancel: 'Klappt es doch nicht? Sagen Sie uns Bescheid',
    manageHint: 'Ändern Sie bequem selbst Datum, Uhrzeit oder Gästezahl.',
  },
  fr: {
    subject: 'Modification confirmée — {{restaurantName}}',
    preview: 'Votre réservation modifiée est confirmée',
    heading: 'C’est noté, {{guestName}} !',
    intro: 'Votre modification au {{restaurantName}} a été enregistrée. Voici les nouvelles informations.',
    outro: 'Une question ? Répondez simplement à cet e-mail.',
    signature: 'À très vite, l’équipe du {{restaurantName}}',
    labelDate: 'Date', labelTime: 'Heure', labelParty: 'Convives',
    ctaManage: 'Gérer ma réservation',
    ctaCancel: 'Un imprévu ? Prévenez-nous',
    manageHint: 'Modifiez vous-même facilement la date, l\u2019heure ou le nombre de convives.',
  },
}

export const template = {
  component: ReservationChangeApproved,
  subject: (d: Record<string, any>) => d.copy?.subject || defaultCopy.nl.subject,
  displayName: 'Wijziging bevestigd',
  templateKey: 'reservation-change-approved',
  defaultCopy,
  previewData: {
    copy: defaultCopy.nl, guestName: 'Jane',
    dateLabel: 'zaterdag 17 mei', timeLabel: '20:00', partySize: 6,
    manageUrl: 'https://example.com/r/manage/preview-token',
    cancelUrl: 'https://example.com/r/manage/preview-token?action=cancel',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#111827', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const card = { backgroundColor: '#f0fdf4', borderRadius: '8px', padding: '14px 18px', margin: '0 0 20px', borderLeft: '3px solid #16a34a' }
const cardLine = { fontSize: '14px', color: '#111827', margin: '4px 0' }
const hint = { fontSize: '13px', color: '#6b7280', textAlign: 'center' as const, margin: '4px 0' }
const linkMuted = { color: '#6b7280', textDecoration: 'underline' }
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
const btnPrimary = { backgroundColor: '#111827', color: '#ffffff', padding: '12px 22px', borderRadius: '8px', textDecoration: 'none', fontSize: '15px', fontWeight: 'bold', minHeight: '44px', display: 'inline-block' }
const footer = { fontSize: '13px', color: '#6b7280', margin: '28px 0 0' }
