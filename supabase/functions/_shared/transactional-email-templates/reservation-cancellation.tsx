import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import type { CopyFields, LocaleCopy } from './i18n.ts'

interface Props {
  copy: CopyFields
  guestName?: string
  dateLabel?: string
  timeLabel?: string
  locale?: string
}

const ReservationCancellation = ({ copy, locale = 'nl' }: Props) => (
  <Html lang={locale} dir="ltr">
    <Head />
    <Preview>{copy.preview || copy.subject}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{copy.heading}</Heading>
        <Text style={text}>{copy.intro}</Text>
        {copy.outro && <Text style={text}>{copy.outro}</Text>}
        {copy.signature && <Text style={footer}>{copy.signature}</Text>}
      </Container>
    </Body>
  </Html>
)

export const defaultCopy: LocaleCopy = {
  nl: {
    subject: 'Reservering geannuleerd — {{restaurantName}}',
    preview: 'Je reservering bij {{restaurantName}} is geannuleerd',
    heading: 'Annulering bevestigd, {{guestName}}',
    intro: 'We hebben je reservering bij {{restaurantName}} op {{dateLabel}} om {{timeLabel}} geannuleerd. Bedankt dat je het hebt laten weten — zo kunnen we de tafel weer beschikbaar maken voor andere gasten.',
    outro: 'Een volgende keer ben je weer van harte welkom. Beantwoord deze mail om contact op te nemen met {{restaurantName}}.',
    signature: 'Tot snel, het team van {{restaurantName}}',
  },
  en: {
    subject: 'Reservation cancelled — {{restaurantName}}',
    preview: 'Your reservation at {{restaurantName}} has been cancelled',
    heading: 'Cancellation confirmed, {{guestName}}',
    intro: 'We have cancelled your reservation at {{restaurantName}} on {{dateLabel}} at {{timeLabel}}. Thanks for letting us know — we can now offer the table to other guests.',
    outro: 'You are warmly welcome again any time. Reply to this email to reach {{restaurantName}}.',
    signature: 'See you soon, the team at {{restaurantName}}',
  },
  de: {
    subject: 'Reservierung storniert — {{restaurantName}}',
    preview: 'Ihre Reservierung bei {{restaurantName}} wurde storniert',
    heading: 'Stornierung bestätigt, {{guestName}}',
    intro: 'Wir haben Ihre Reservierung bei {{restaurantName}} am {{dateLabel}} um {{timeLabel}} storniert. Vielen Dank für Ihre Nachricht — so können wir den Tisch wieder für andere Gäste freigeben.',
    outro: 'Ein nächstes Mal sind Sie herzlich willkommen. Antworten Sie auf diese E-Mail, um {{restaurantName}} zu erreichen.',
    signature: 'Bis bald, das Team von {{restaurantName}}',
  },
  fr: {
    subject: 'Réservation annulée — {{restaurantName}}',
    preview: 'Votre réservation au {{restaurantName}} a été annulée',
    heading: 'Annulation confirmée, {{guestName}}',
    intro: 'Nous avons annulé votre réservation au {{restaurantName}} le {{dateLabel}} à {{timeLabel}}. Merci de nous avoir prévenus — la table est de nouveau disponible pour d’autres convives.',
    outro: 'Nous vous accueillerons avec plaisir une prochaine fois. Répondez à cet e-mail pour joindre {{restaurantName}}.',
    signature: 'À très vite, l’équipe du {{restaurantName}}',
  },
}

export const template = {
  component: ReservationCancellation,
  subject: (d: Record<string, any>) => d.copy?.subject || defaultCopy.nl.subject,
  displayName: 'Reservering geannuleerd',
  templateKey: 'reservation-cancellation',
  defaultCopy,
  previewData: {
    copy: defaultCopy.nl,
    guestName: 'Jane',
    dateLabel: 'vrijdag 16 mei',
    timeLabel: '19:30',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#111827', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const footer = { fontSize: '13px', color: '#6b7280', margin: '28px 0 0' }
