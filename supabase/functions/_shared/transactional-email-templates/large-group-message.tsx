import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import type { CopyFields, LocaleCopy } from './i18n.ts'

interface Props {
  copy: CopyFields
  guestName?: string
  messageBody?: string
  staffName?: string
  restaurantName?: string
  locale?: string
}

const LargeGroupMessage = ({ copy, messageBody = '', staffName, restaurantName, locale = 'nl' }: Props) => (
  <Html lang={locale} dir="ltr">
    <Head />
    <Preview>{copy.preview || copy.subject}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{copy.heading}</Heading>
        <Text style={text}>{copy.intro}</Text>
        <Section style={card}>
          {messageBody.split('\n').map((line, i) => (
            <Text key={i} style={cardLine}>{line || '\u00A0'}</Text>
          ))}
        </Section>
        {copy.outro && <Text style={text}>{copy.outro}</Text>}
        {(copy.signature || staffName) && (
          <Text style={footer}>
            {copy.signature}
            {staffName ? <><br />{staffName}{restaurantName ? ` — ${restaurantName}` : ''}</> : null}
          </Text>
        )}
      </Container>
    </Body>
  </Html>
)

export const defaultCopy: LocaleCopy = {
  nl: {
    subject: 'Bericht van {{restaurantName}}',
    preview: 'Bericht van {{restaurantName}}',
    heading: 'Hallo {{guestName}},',
    intro: 'We hebben een bericht voor je over je groepsaanvraag bij {{restaurantName}}:',
    outro: 'Beantwoord deze mail om direct contact op te nemen met {{restaurantName}}. Je antwoord komt bij ons binnen en wordt persoonlijk opgevolgd.',
    signature: 'Met vriendelijke groet,',
  },
  en: {
    subject: 'Message from {{restaurantName}}',
    preview: 'Message from {{restaurantName}}',
    heading: 'Hi {{guestName}},',
    intro: 'We have a message for you about your group request at {{restaurantName}}:',
    outro: 'Reply to this email to get in touch with {{restaurantName}} directly — your reply reaches us and is personally handled by a team member.',
    signature: 'Kind regards,',
  },
  de: {
    subject: 'Nachricht von {{restaurantName}}',
    preview: 'Nachricht von {{restaurantName}}',
    heading: 'Hallo {{guestName}},',
    intro: 'Wir haben eine Nachricht zu Ihrer Gruppenanfrage bei {{restaurantName}}:',
    outro: 'Antworten Sie auf diese E-Mail, um direkt mit {{restaurantName}} in Kontakt zu treten. Ihre Antwort wird persönlich von uns bearbeitet.',
    signature: 'Herzliche Grüße,',
  },
  fr: {
    subject: 'Message du {{restaurantName}}',
    preview: 'Message du {{restaurantName}}',
    heading: 'Bonjour {{guestName}},',
    intro: 'Nous avons un message concernant votre demande de groupe au {{restaurantName}} :',
    outro: 'Répondez à cet e-mail pour joindre directement {{restaurantName}} — votre message nous parvient et est traité personnellement par un membre de l’équipe.',
    signature: 'Cordialement,',
  },
}

export const template = {
  component: LargeGroupMessage,
  subject: (d: Record<string, any>) => d.copy?.subject || defaultCopy.nl.subject,
  displayName: 'Groep — custom bericht',
  templateKey: 'large-group-message',
  defaultCopy,
  previewData: {
    copy: defaultCopy.nl,
    guestName: 'Jane',
    messageBody: 'Bedankt voor je aanvraag voor 12 personen. Kunnen jullie aangeven of er allergieën zijn?',
    staffName: 'Sofie',
    restaurantName: 'Restaurant De Kroon',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#111827', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const card = { backgroundColor: '#f9fafb', borderRadius: '8px', padding: '14px 18px', margin: '0 0 20px', borderLeft: '3px solid #111827' }
const cardLine = { fontSize: '15px', color: '#111827', margin: '4px 0', lineHeight: '1.6' }
const footer = { fontSize: '13px', color: '#6b7280', margin: '28px 0 0' }
