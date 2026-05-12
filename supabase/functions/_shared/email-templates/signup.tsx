/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="nl" dir="ltr">
    <Head />
    <Preview>Bevestig je e-mailadres voor {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar}>
          <Text style={brandText}>{siteName}</Text>
        </Section>
        <Heading style={h1}>Welkom bij {siteName}</Heading>
        <Text style={text}>
          Fijn dat je erbij bent. Bevestig hieronder dat{' '}
          <Link href={`mailto:${recipient}`} style={link}>{recipient}</Link>{' '}
          jouw e-mailadres is, dan kun je direct aan de slag.
        </Text>
        <Section style={buttonWrap}>
          <Button style={button} href={confirmationUrl}>
            Bevestig e-mailadres
          </Button>
        </Section>
        <Text style={textSmall}>
          Werkt de knop niet? Plak deze link in je browser:<br />
          <Link href={confirmationUrl} style={link}>{confirmationUrl}</Link>
        </Text>
        <Text style={footer}>
          Heb je geen account aangemaakt? Dan kun je deze e-mail negeren.
          <br />
          <Link href={siteUrl} style={footerLink}>{siteName}</Link>
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

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
  margin: '0 0 24px',
}
const textSmall = {
  fontSize: '12px',
  color: 'hsl(20, 8%, 42%)',
  lineHeight: '1.6',
  margin: '24px 0 0',
  wordBreak: 'break-all' as const,
}
const link = { color: 'hsl(8, 55%, 38%)', textDecoration: 'underline' }
const footerLink = { color: 'hsl(20, 8%, 42%)', textDecoration: 'underline' }
const buttonWrap = { margin: '8px 0 8px' }
const button = {
  backgroundColor: 'hsl(8, 55%, 38%)',
  color: 'hsl(38, 40%, 98%)',
  fontSize: '15px',
  fontWeight: '600' as const,
  borderRadius: '14px',
  padding: '14px 24px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = {
  fontSize: '12px',
  color: 'hsl(20, 8%, 42%)',
  margin: '36px 0 0',
  borderTop: '1px solid hsl(30, 15%, 88%)',
  paddingTop: '20px',
  lineHeight: '1.6',
}
