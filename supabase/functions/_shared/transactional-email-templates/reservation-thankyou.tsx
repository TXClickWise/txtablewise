import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import type { CopyFields, LocaleCopy } from './i18n.ts'

interface Props {
  copy: CopyFields
  guestName?: string
  reviewUrl?: string
  restaurantName?: string
  locale?: string
}

const ReservationThankyou = ({ copy, reviewUrl, locale = 'nl' }: Props) => (
  <Html lang={locale} dir="ltr">
    <Head />
    <Preview>{copy.preview || copy.subject}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{copy.heading}</Heading>
        <Text style={text}>{copy.intro}</Text>
        {reviewUrl && (
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button href={reviewUrl} style={btn}>
              {copy.cta || 'Vertel ons hoe het was'}
            </Button>
          </Section>
        )}
        {copy.outro && <Text style={text}>{copy.outro}</Text>}
        {copy.signature && <Text style={footer}>{copy.signature}</Text>}
      </Container>
    </Body>
  </Html>
)

export const defaultCopy: LocaleCopy = {
  nl: {
    subject: 'Bedankt voor je bezoek aan {{restaurantName}}',
    preview: 'We hopen dat je hebt genoten bij {{restaurantName}}',
    heading: 'Bedankt, {{guestName}}!',
    intro: 'Bedankt voor je bezoek aan {{restaurantName}}. We hopen dat je hebt genoten.',
    outro: 'We horen graag hoe je het vond — een korte review helpt ons enorm.',
    signature: 'Tot een volgende keer, het team van {{restaurantName}}',
    cta: 'Vertel ons hoe het was',
  },
  en: {
    subject: 'Thanks for visiting {{restaurantName}}',
    preview: 'We hope you enjoyed your visit to {{restaurantName}}',
    heading: 'Thank you, {{guestName}}!',
    intro: 'Thanks for visiting {{restaurantName}}. We hope you had a great time.',
    outro: 'We would love to hear how it was — a short review means a lot to us.',
    signature: 'See you next time, the team at {{restaurantName}}',
    cta: 'Share your experience',
  },
  de: {
    subject: 'Danke für Ihren Besuch bei {{restaurantName}}',
    preview: 'Wir hoffen, Ihr Besuch bei {{restaurantName}} hat Ihnen gefallen',
    heading: 'Vielen Dank, {{guestName}}!',
    intro: 'Vielen Dank für Ihren Besuch bei {{restaurantName}}. Wir hoffen, es hat Ihnen geschmeckt.',
    outro: 'Wir freuen uns über Ihr Feedback — eine kurze Bewertung hilft uns sehr.',
    signature: 'Bis zum nächsten Mal, das Team von {{restaurantName}}',
    cta: 'Bewertung abgeben',
  },
  fr: {
    subject: 'Merci pour votre visite au {{restaurantName}}',
    preview: 'Nous espérons que vous avez apprécié votre visite au {{restaurantName}}',
    heading: 'Merci, {{guestName}} !',
    intro: 'Merci pour votre visite au {{restaurantName}}. Nous espérons que vous avez passé un bon moment.',
    outro: 'Votre avis compte pour nous — un court commentaire nous aide beaucoup.',
    signature: 'À très vite, l’équipe du {{restaurantName}}',
    cta: 'Laisser un avis',
  },
}

export const template = {
  component: ReservationThankyou,
  subject: (d: Record<string, any>) => d.copy?.subject || defaultCopy.nl.subject,
  displayName: 'Bedankt na bezoek',
  templateKey: 'reservation-thankyou',
  defaultCopy,
  previewData: {
    copy: defaultCopy.nl,
    guestName: 'Jane',
    reviewUrl: 'https://example.com/review',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#111827', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const btn = { backgroundColor: '#111827', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', fontSize: '15px', fontWeight: 'bold', minHeight: '44px', display: 'inline-block' }
const footer = { fontSize: '13px', color: '#6b7280', margin: '28px 0 0' }
