import type { ErrorCode } from '@mathgo/protocol';
import type { TFunction } from 'i18next';

/** The server sends error codes; players see them in their language. */
export function errorText(code: ErrorCode, t: TFunction): string {
  return t(`errors.${code}`);
}
