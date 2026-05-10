import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  restaurantName?: string
  guestName?: string
  dateLabel?: string
  timeLabel?: string
}

const ReservationCancellation = ({
  restaurantName = 'het restaurant',
  guestName,
  dateLabel = '',
  timeLabel = '',
}: Props) => (
  <Html lang="nl" dir="ltr">
    <Head />
    <Preview>Je reservering bij {restaurantName} is geannuleerd</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Annulering bevestigd{guestName ? `, ${guestName}` : ''}</Heading>
        <Text style={text}>
          We hebben je reservering bij <strong>{restaurantName}</strong>
          {dateLabel ? ` op ${dateLabel}` : ''}
          {timeLabel ? ` om ${timeLabel}` : ''} geannuleerd. Bedankt dat je het hebt laten weten — zo kunnen we de tafel weer beschikbaar maken voor andere gasten.
        </Text>
        <Text style={text}>
          Een volgende keer ben je weer van harte welkom. Beantwoord deze mail om contact op te nemen met {restaurantName}.
        </Text>
        <Text style={footer}>Tot snel, het team van {restaurantName}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ReservationCancellation,
  subject: (d: Record<string, any>) =>
    `Reservering geannuleerd${d.restaurantName ? ` — ${d.restaurantName}` : ''}`,
  displayName: 'Reservering geannuleerd',
  previewData: {
    restaurantName: 'Restaurant De Kroon',
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
