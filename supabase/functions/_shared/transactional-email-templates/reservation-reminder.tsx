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
}

const ReservationReminder = ({
  restaurantName = 'het restaurant',
  guestName,
  dateLabel = '',
  timeLabel = '',
  partySize,
}: Props) => (
  <Html lang="nl" dir="ltr">
    <Head />
    <Preview>Tot morgen bij {restaurantName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Tot morgen{guestName ? `, ${guestName}` : ''}!</Heading>
        <Text style={text}>
          Een vriendelijke herinnering aan je reservering bij <strong>{restaurantName}</strong>.
        </Text>
        <Section style={card}>
          {dateLabel && <Text style={cardLine}><strong>Datum:</strong> {dateLabel}</Text>}
          {timeLabel && <Text style={cardLine}><strong>Tijd:</strong> {timeLabel}</Text>}
          {partySize && <Text style={cardLine}><strong>Aantal gasten:</strong> {partySize}</Text>}
        </Section>
        <Text style={text}>
          Plannen veranderd? Beantwoord deze mail om contact op te nemen met {restaurantName}, dan zorgen we ervoor dat je tafel beschikbaar blijft voor andere gasten.
        </Text>
        <Text style={footer}>Tot snel, het team van {restaurantName}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ReservationReminder,
  subject: (d: Record<string, any>) =>
    `Tot morgen${d.restaurantName ? ` bij ${d.restaurantName}` : ''}`,
  displayName: 'Reservering herinnering',
  previewData: {
    restaurantName: 'Restaurant De Kroon',
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
