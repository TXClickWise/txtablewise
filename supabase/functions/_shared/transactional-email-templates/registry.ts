/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { LocaleCopy } from './i18n.ts'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
  templateKey?: string
  defaultCopy?: LocaleCopy
}

import { template as reservationConfirmation } from './reservation-confirmation.tsx'
import { template as reservationReminder } from './reservation-reminder.tsx'
import { template as reservationCancellation } from './reservation-cancellation.tsx'
import { template as reservationThankyou } from './reservation-thankyou.tsx'
import { template as reservationReconfirm } from './reservation-reconfirm.tsx'
import { template as reservationChangeReceived } from './reservation-change-received.tsx'
import { template as reservationChangeApproved } from './reservation-change-approved.tsx'
import { template as reservationChangeRejected } from './reservation-change-rejected.tsx'
import { template as largeGroupMessage } from './large-group-message.tsx'
import { template as largeGroupApproved } from './large-group-approved.tsx'
import { template as largeGroupRejected } from './large-group-rejected.tsx'
import { template as memberInvitation } from './member-invitation.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'reservation-confirmation': reservationConfirmation,
  'reservation-reminder': reservationReminder,
  'reservation-cancellation': reservationCancellation,
  'reservation-thankyou': reservationThankyou,
  'reservation-reconfirm': reservationReconfirm,
  'reservation-change-received': reservationChangeReceived,
  'reservation-change-approved': reservationChangeApproved,
  'reservation-change-rejected': reservationChangeRejected,
  'large-group-message': largeGroupMessage,
  'large-group-approved': largeGroupApproved,
  'large-group-rejected': largeGroupRejected,
  'member-invitation': memberInvitation,
}
