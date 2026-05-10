import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  restaurantName?: string
  guestName?: string
  dateLabel?: string
  timeLabel?: string
  partySize?: number
  notesToGuest?: string
}

const ReservationConfirmation = ({
  restaurantName = 'het restaurant',
  guestName,
  dateLabel = '',
  timeLabel = '',
  partySize,
  notesToGuest,
}: Props) => (
  <Html lang="nl" dir="ltr">
    <Head />
    <Preview>Je reservering bij {restaurantName} is bevestigd</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Bedankt{guestName ? `, ${guestName}` : ''}!</Heading>
        <Text style={text}>
          Je reservering bij <strong>{restaurantName}</strong> is bevestigd. We kijken ernaar uit je te ontvangen.
        </Text>
        <Section style={card}>
          {dateLabel && <Text style={cardLine}><strong>Datum:</strong> {dateLabel}</Text>}
          {timeLabel && <Text style={cardLine}><strong>Tijd:</strong> {timeLabel}</Text>}
          {partySize && <Text style={cardLine}><strong>Aantal gasten:</strong> {partySize}</Text>}
        </Section>
        {notesToGuest && <Text style={text}>{notesToGuest}</Text>}
        <Text style={text}>
          Lukt het onverhoopt toch niet? Laat het ons gerust weten — beantwoord deze mail om contact op te nemen met {restaurantName}.
        </Text>
        <Text style={footer}>Tot snel, het team van {restaurantName}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ReservationConfirmation,
  subject: (d: Record<string, any>) =>
    `Reservering bevestigd${d.restaurantName ? ` — ${d.restaurantName}` : ''}`,
  displayName: 'Reservering bevestigd',
  previewData: {
    restaurantName: 'Restaurant De Kroon',
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
