/** A whole number as players read it: 1.200 in Bahasa Indonesia, 1,200 in English. */
export function formatNumber(n: number, language: string): string {
  return n.toLocaleString(language === 'en' ? 'en-US' : 'id-ID');
}
