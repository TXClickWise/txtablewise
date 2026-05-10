/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as reservationConfirmation } from './reservation-confirmation.tsx'
import { template as reservationReminder } from './reservation-reminder.tsx'
import { template as reservationCancellation } from './reservation-cancellation.tsx'
import { template as largeGroupMessage } from './large-group-message.tsx'
import { template as largeGroupDecision } from './large-group-decision.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'reservation-confirmation': reservationConfirmation,
  'reservation-reminder': reservationReminder,
  'reservation-cancellation': reservationCancellation,
  'large-group-message': largeGroupMessage,
  'large-group-decision': largeGroupDecision,
}
