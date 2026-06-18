/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  restaurantName?: string
  role?: string
  inviterName?: string
  inviteUrl?: string
  expiresAtLabel?: string
}

const ROLE_LABEL: Record<string, string> = {
  manager: 'Manager',
  host: 'Host',
  staff: 'Medewerker',
}

const MemberInvitation = ({
  restaurantName = 'het restaurant',
  role = 'staff',
  inviterName,
  inviteUrl = '#',
  expiresAtLabel,
}: Props) => {
  const roleLabel = ROLE_LABEL[role] || role
  return (
    <Html lang="nl" dir="ltr">
      <Head />
      <Preview>Je bent uitgenodigd voor {restaurantName} op TableWise</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Uitnodiging voor {restaurantName}</Heading>
          <Text style={text}>
            {inviterName ? `${inviterName} heeft` : 'Je bent'} uitgenodigd om mee te werken in
            {' '}{restaurantName} op TableWise als <strong>{roleLabel}</strong>.
          </Text>
          <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
            <Button href={inviteUrl} style={btnPrimary}>Uitnodiging accepteren</Button>
          </Section>
          {expiresAtLabel && (
            <Text style={hint}>Deze uitnodiging verloopt op {expiresAtLabel}.</Text>
          )}
          <Hr style={hr} />
          <Text style={footer}>
            Heb je deze mail onverwacht ontvangen? Dan kan je hem negeren — er gebeurt niets.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: MemberInvitation,
  subject: (d: Record<string, any>) =>
    `Uitnodiging voor ${d.restaurantName || 'TableWise'}`,
  displayName: 'Teamlid uitnodiging',
  previewData: {
    restaurantName: 'Bistro Demo',
    role: 'host',
    inviterName: 'Anna',
    inviteUrl: 'https://example.com/invite?token=preview',
    expiresAtLabel: '1 juli 2026',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#111827', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const hint = { fontSize: '13px', color: '#6b7280', textAlign: 'center' as const, margin: '8px 0' }
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
const btnPrimary = { backgroundColor: '#111827', color: '#ffffff', padding: '12px 22px', borderRadius: '8px', textDecoration: 'none', fontSize: '15px', fontWeight: 'bold', minHeight: '44px', display: 'inline-block' }
const footer = { fontSize: '13px', color: '#6b7280', margin: '12px 0 0' }
