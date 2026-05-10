import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import type { CopyFields, LocaleCopy } from './i18n.ts'

interface Props {
  copy: CopyFields
  guestName?: string
  decisionNote?: string
  locale?: string
}

const LargeGroupRejected = ({ copy, decisionNote, locale = 'nl' }: Props) => (
  <Html lang={locale} dir="ltr">
    <Head />
    <Preview>{copy.preview || copy.subject}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{copy.heading}</Heading>
        <Text style={text}>{copy.intro}</Text>
        {decisionNote && <Text style={text}>{decisionNote}</Text>}
        {copy.outro && <Text style={text}>{copy.outro}</Text>}
        {copy.signature && <Text style={footer}>{copy.signature}</Text>}
      </Container>
    </Body>
  </Html>
)

export const defaultCopy: LocaleCopy = {
  nl: {
    subject: 'Update over je groepsaanvraag — {{restaurantName}}',
    preview: 'Update over je groepsaanvraag bij {{restaurantName}}',
    heading: 'Update over je aanvraag, {{guestName}}',
    intro: 'Helaas kunnen we je groepsaanvraag bij {{restaurantName}} deze keer niet honoreren.',
    outro: 'Vragen of opmerkingen? Beantwoord deze mail om contact op te nemen met {{restaurantName}}.',
    signature: 'Hartelijke groet, het team van {{restaurantName}}',
  },
  en: {
    subject: 'Update about your group request — {{restaurantName}}',
    preview: 'Update about your group request at {{restaurantName}}',
    heading: 'Update about your request, {{guestName}}',
    intro: 'Unfortunately, we are not able to accommodate your group request at {{restaurantName}} this time.',
    outro: 'Questions or remarks? Reply to this email to reach {{restaurantName}}.',
    signature: 'Warm regards, the team at {{restaurantName}}',
  },
  de: {
    subject: 'Update zu Ihrer Gruppenanfrage — {{restaurantName}}',
    preview: 'Update zu Ihrer Gruppenanfrage bei {{restaurantName}}',
    heading: 'Update zu Ihrer Anfrage, {{guestName}}',
    intro: 'Leider können wir Ihrer Gruppenanfrage bei {{restaurantName}} dieses Mal nicht entsprechen.',
    outro: 'Fragen oder Anmerkungen? Antworten Sie auf diese E-Mail, um {{restaurantName}} zu erreichen.',
    signature: 'Herzliche Grüße, das Team von {{restaurantName}}',
  },
  fr: {
    subject: 'Mise à jour de votre demande de groupe — {{restaurantName}}',
    preview: 'Mise à jour de votre demande de groupe au {{restaurantName}}',
    heading: 'Mise à jour de votre demande, {{guestName}}',
    intro: 'Malheureusement, nous ne pouvons pas honorer votre demande de groupe au {{restaurantName}} cette fois-ci.',
    outro: 'Des questions ou remarques ? Répondez à cet e-mail pour joindre {{restaurantName}}.',
    signature: 'Cordialement, l’équipe du {{restaurantName}}',
  },
}

export const template = {
  component: LargeGroupRejected,
  subject: (d: Record<string, any>) => d.copy?.subject || defaultCopy.nl.subject,
  displayName: 'Groep — afgewezen',
  templateKey: 'large-group-rejected',
  defaultCopy,
  previewData: {
    copy: defaultCopy.nl,
    guestName: 'Jane',
    decisionNote: 'Op die avond is onze keuken al volledig geboekt.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#111827', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const footer = { fontSize: '13px', color: '#6b7280', margin: '28px 0 0' }
