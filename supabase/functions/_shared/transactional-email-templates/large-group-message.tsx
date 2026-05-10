import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  restaurantName?: string
  guestName?: string
  messageBody?: string
  staffName?: string
}

// Custom bericht vanuit het grote-groep-scherm. Reply-To = inbox restaurant,
// dus de gast kan direct antwoorden naar het restaurant.
const LargeGroupMessage = ({
  restaurantName = 'het restaurant',
  guestName,
  messageBody = '',
  staffName,
}: Props) => (
  <Html lang="nl" dir="ltr">
    <Head />
    <Preview>Bericht van {restaurantName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Hallo{guestName ? ` ${guestName}` : ''},</Heading>
        <Text style={text}>
          We hebben een bericht voor je over je groepsaanvraag bij <strong>{restaurantName}</strong>:
        </Text>
        <Section style={card}>
          {messageBody.split('\n').map((line, i) => (
            <Text key={i} style={cardLine}>{line || '\u00A0'}</Text>
          ))}
        </Section>
        <Text style={text}>
          <strong>Beantwoord deze mail</strong> om direct contact op te nemen met {restaurantName}. Je antwoord komt bij ons binnen en wordt persoonlijk opgevolgd door een medewerker.
        </Text>
        <Text style={footer}>
          Met vriendelijke groet,<br />
          {staffName ? `${staffName} — ` : ''}{restaurantName}
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: LargeGroupMessage,
  subject: (d: Record<string, any>) =>
    d.subjectLine || `Bericht van ${d.restaurantName || 'het restaurant'}`,
  displayName: 'Groep — custom bericht',
  previewData: {
    restaurantName: 'Restaurant De Kroon',
    guestName: 'Jane',
    messageBody: 'Bedankt voor je aanvraag voor een groep van 12 personen. Kunnen jullie aangeven of er allergieën zijn en of een aanbetaling van €10 p.p. akkoord is?',
    staffName: 'Sofie',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#111827', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const card = { backgroundColor: '#f9fafb', borderRadius: '8px', padding: '14px 18px', margin: '0 0 20px', borderLeft: '3px solid #111827' }
const cardLine = { fontSize: '15px', color: '#111827', margin: '4px 0', lineHeight: '1.6' }
const footer = { fontSize: '13px', color: '#6b7280', margin: '28px 0 0' }
