/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="nl" dir="ltr">
    <Head />
    <Preview>Je verificatiecode</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar}>
          <Text style={brandText}>TableWise</Text>
        </Section>
        <Heading style={h1}>Bevestig je identiteit</Heading>
        <Text style={text}>Gebruik onderstaande code om je identiteit te bevestigen:</Text>
        <Section style={codeWrap}>
          <Text style={codeStyle}>{token}</Text>
        </Section>
        <Text style={footer}>
          Deze code verloopt binnen enkele minuten.
          Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
}
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const brandBar = { borderBottom: '2px solid hsl(8, 55%, 38%)', paddingBottom: '14px', marginBottom: '28px' }
const brandText = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: '18px',
  fontWeight: '600' as const,
  color: 'hsl(8, 55%, 38%)',
  letterSpacing: '0.02em',
  margin: 0,
}
const h1 = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: '26px',
  fontWeight: '600' as const,
  color: 'hsl(20, 14%, 14%)',
  margin: '0 0 18px',
  lineHeight: '1.3',
}
const text = {
  fontSize: '15px',
  color: 'hsl(20, 14%, 22%)',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const codeWrap = {
  backgroundColor: 'hsl(32, 18%, 94%)',
  borderRadius: '14px',
  padding: '20px 24px',
  textAlign: 'center' as const,
  margin: '0 0 28px',
}
const codeStyle = {
  fontFamily: '"SF Mono", Menlo, Consolas, monospace',
  fontSize: '28px',
  fontWeight: '700' as const,
  color: 'hsl(8, 55%, 38%)',
  letterSpacing: '0.2em',
  margin: 0,
}
const footer = {
  fontSize: '12px',
  color: 'hsl(20, 8%, 42%)',
  margin: '36px 0 0',
  borderTop: '1px solid hsl(30, 15%, 88%)',
  paddingTop: '20px',
  lineHeight: '1.6',
}
