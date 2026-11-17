/**
 * HackhIt — Institutional Email & Role Authentication Utilities
 *
 * Separates authentication requirements between Student and University accounts:
 * - Students: May use personal emails (Gmail, Yahoo, Outlook, etc.), Google OAuth, or Phone OTP.
 * - Universities: MUST use an official institutional email address (.edu, .ac.in, or university domain).
 * - Enforces that generic freemail domains are rejected for university registrations.
 */

export const CONSUMER_EMAIL_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.in',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'aol.com',
  'zoho.com',
  'proton.me',
  'protonmail.com',
  'mail.com',
  'gmx.com',
  'yandex.com',
]

/**
 * Validates whether an email is permissible for a University / Organizer account.
 */
export function validateUniversityEmail(email: string): {
  isValid: boolean
  error?: string
} {
  const trimmed = email.trim().toLowerCase()
  if (!trimmed) {
    return { isValid: false, error: 'Please enter your official college email address.' }
  }

  const parts = trimmed.split('@')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { isValid: false, error: 'Please enter a valid email address.' }
  }

  const domain = parts[1].toLowerCase()

  if (CONSUMER_EMAIL_DOMAINS.includes(domain)) {
    return {
      isValid: false,
      error:
        'Personal email providers (like @gmail.com, @yahoo.com) cannot be used for University accounts. Please use your official college/institution email (.edu, .ac.in, or college domain).',
    }
  }

  if (!domain.includes('.')) {
    return { isValid: false, error: 'Invalid university email domain.' }
  }

  return { isValid: true }
}

/**
 * Checks whether an email address belongs to an educational / institutional domain.
 */
export function isInstitutionalDomain(email: string): boolean {
  const trimmed = email.trim().toLowerCase()
  const parts = trimmed.split('@')
  if (parts.length !== 2) return false
  const domain = parts[1].toLowerCase()

  if (CONSUMER_EMAIL_DOMAINS.includes(domain)) return false

  return (
    domain.endsWith('.edu') ||
    domain.endsWith('.ac.in') ||
    domain.endsWith('.edu.in') ||
    domain.endsWith('.ac.uk') ||
    domain.endsWith('.edu.au') ||
    domain.endsWith('.edu.sg') ||
    domain.includes('.ac.') ||
    domain.includes('.edu.') ||
    !CONSUMER_EMAIL_DOMAINS.includes(domain)
  )
}
