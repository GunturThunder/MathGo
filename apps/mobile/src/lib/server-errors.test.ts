import { ERROR_CODES, PROTOCOL_VERSION, parseServerMessage } from '@mathgo/protocol';
import { en } from '../i18n/en';
import { id } from '../i18n/id';
import { i18n } from '../i18n';
import { errorText } from './server-errors';

describe('server errors', () => {
  it('every protocol error code has text in both languages', () => {
    for (const code of ERROR_CODES) {
      expect(id.errors[code]).toBeTruthy();
      expect(en.errors[code]).toBeTruthy();
    }
    expect(Object.keys(id.errors).sort()).toEqual([...ERROR_CODES].sort());
  });

  it('turns a parsed server error into the player’s language', () => {
    const parsed = parseServerMessage('error', { code: 'update-required', detail: 'v0' });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok || parsed.message.type !== 'error') return;
    const t = i18n.getFixedT('id');
    expect(errorText(parsed.message.payload.code, t)).toBe(id.errors['update-required']);
    expect(errorText(parsed.message.payload.code, i18n.getFixedT('en'))).toBe(
      en.errors['update-required'],
    );
    expect(PROTOCOL_VERSION).toBe(1);
  });
});
