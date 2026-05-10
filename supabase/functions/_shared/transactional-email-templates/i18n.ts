// Shared types & helpers for multi-language transactional email templates.
// NL is the master; EN/DE/FR are AI-translatable per restaurant.

export const LOCALES = ['nl', 'en', 'de', 'fr'] as const
export type Locale = (typeof LOCALES)[number]

// Editable copy fields per locale. Stored in DB as restaurant_email_templates.
// `extra` keys are non-DB labels (e.g. "Datum") that ship as defaults and are
// translatable in code only — they fall back to defaultCopy[locale].extras.
export interface CopyFields {
  subject: string
  preview?: string
  heading: string
  intro: string
  outro: string
  signature: string
  // Optional labels for date/time/party — translated per locale, not editable in DB.
  labelDate?: string
  labelTime?: string
  labelParty?: string
}

export type LocaleCopy = Record<Locale, CopyFields>

// Replace {{key}} placeholders in a string with values from `vars`.
// Unknown keys are left blank.
export function interpolate(str: string, vars: Record<string, any>): string {
  if (!str) return ''
  return str.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const v = vars[key]
    return v == null ? '' : String(v)
  })
}

// Resolve which locale to use for sending.
export function resolveLocale(
  requested: string | null | undefined,
  fallback: string | null | undefined,
): Locale {
  const candidates = [requested, fallback, 'nl']
  for (const c of candidates) {
    if (c && (LOCALES as readonly string[]).includes(c)) return c as Locale
  }
  return 'nl'
}

// Merge defaultCopy[locale] with an optional DB row.
// DB row fields that are empty strings fall back to default.
export function mergeCopy(
  defaultCopy: LocaleCopy,
  locale: Locale,
  dbRow: Partial<CopyFields> | null | undefined,
): CopyFields {
  const base: CopyFields = { ...defaultCopy[locale] || defaultCopy.nl }
  if (!dbRow) return base
  const out = { ...base }
  for (const k of ['subject', 'heading', 'intro', 'outro', 'signature'] as const) {
    const v = (dbRow as any)[k]
    if (typeof v === 'string' && v.trim().length > 0) {
      ;(out as any)[k] = v
    }
  }
  return out
}

// Apply {{var}} interpolation across all string fields.
export function interpolateCopy(
  copy: CopyFields,
  vars: Record<string, any>,
): CopyFields {
  return {
    ...copy,
    subject: interpolate(copy.subject, vars),
    preview: copy.preview ? interpolate(copy.preview, vars) : undefined,
    heading: interpolate(copy.heading, vars),
    intro: interpolate(copy.intro, vars),
    outro: interpolate(copy.outro, vars),
    signature: interpolate(copy.signature, vars),
  }
}
