// Parents' phone numbers (S5-05). The launch country is Indonesia, so only Indonesian mobile
// numbers (+62 8…) are accepted. The number is used to send the code and never stored.

/**
 * `0812-3456-7890`, `812 3456 7890`, `+62 812 3456 7890` or `6281234567890` → `+6281234567890`.
 * Null when it isn't an Indonesian mobile number (8, then 8–11 more digits).
 */
export function normalizeIndonesianMobile(input: string): string | null {
  const compact = input.replace(/[\s\-().]/g, '');
  const local = /^(?:\+62|62|0)?(8\d{8,11})$/.exec(compact)?.[1];
  return local === undefined ? null : `+62${local}`;
}

/** `+6281234567890` → `+62 812 •••• 7890`: enough for a parent to recognise their number. */
export function maskPhone(e164: string): string {
  const local = e164.slice(3);
  return `+62 ${local.slice(0, 3)} •••• ${local.slice(-4)}`;
}
