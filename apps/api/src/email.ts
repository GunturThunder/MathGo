// Parents' email addresses (S5-05). The address is used to send the code and never stored.

/** Longest address SMTP allows. */
const MAX_LENGTH = 254;

/**
 * ` Ayah.Budi@Gmail.com ` → `ayah.budi@gmail.com`. Null when it isn't a plausible address: one
 * `@`, no spaces, and a domain with a dot. The code itself is the real check that it works.
 */
export function normalizeEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  if (email.length > MAX_LENGTH) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/.test(email) ? email : null;
}

/** `ayah.budi@gmail.com` → `ay•••••••@gmail.com`: enough for a parent to recognise it. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  const local = email.slice(0, at);
  const shown = local.slice(0, Math.min(2, Math.max(1, local.length - 1)));
  return `${shown}${'•'.repeat(Math.max(1, local.length - shown.length))}${email.slice(at)}`;
}
