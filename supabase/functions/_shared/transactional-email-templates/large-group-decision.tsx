import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  restaurantName?: string
  guestName?: string
  approved?: boolean
  dateLabel?: string
  timeLabel?: string
  partySize?: number
  decisionNote?: string
}

const LargeGroupDecision = ({
  restaurantName = 'het restaurant',
  guestName,
  approved = true,
  dateLabel = '',
  timeLabel = '',
  partySize,
  decisionNote,
}: Props) => (
  <Html lang="nl" dir="ltr">
    <Head />
    <Preview>
      {approved
        ? `Goed nieuws — je groepsaanvraag bij ${restaurantName} is bevestigd`
        : `Update over je groepsaanvraag bij ${restaurantName}`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {approved ? 'Goed nieuws' : 'Update over je aanvraag'}{guestName ? `, ${guestName}` : ''}!
        </Heading>
        <Text style={text}>
          {approved ? (
            <>Je groepsaanvraag bij <strong>{restaurantName}</strong> is bevestigd.</>
          ) : (
            <>Helaas kunnen we je groepsaanvraag bij <strong>{restaurantName}</strong> deze keer niet honoreren.</>
          )}
        </Text>
        {(dateLabel || timeLabel || partySize) && (
          <Section style={card}>
            {dateLabel && <Text style={cardLine}><strong>Datum:</strong> {dateLabel}</Text>}
            {timeLabel && <Text style={cardLine}><strong>Tijd:</strong> {timeLabel}</Text>}
            {partySize && <Text style={cardLine}><strong>Aantal gasten:</strong> {partySize}</Text>}
          </Section>
        )}
        {decisionNote && <Text style={text}>{decisionNote}</Text>}
        <Text style={text}>
          Vragen of opmerkingen? Beantwoord deze mail om contact op te nemen met {restaurantName}.
        </Text>
        <Text style={footer}>Hartelijke groet, het team van {restaurantName}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: LargeGroupDecision,
  subject: (d: Record<string, any>) =>
    d.approved
      ? `Groepsaanvraag bevestigd${d.restaurantName ? ` — ${d.restaurantName}` : ''}`
      : `Update over je groepsaanvraag${d.restaurantName ? ` — ${d.restaurantName}` : ''}`,
  displayName: 'Groep — beslissing',
  previewData: {
    restaurantName: 'Restaurant De Kroon',
    guestName: 'Jane',
    approved: true,
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
