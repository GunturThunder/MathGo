import { describe, expect, it } from 'vitest';
import { redact } from './migrate.js';

describe('redact', () => {
  it('hides the password in logs', () => {
    expect(redact('postgres://mathgo:secret@db:5432/mathgo')).toBe(
      'postgres://mathgo:***@db:5432/mathgo',
    );
    expect(redact('postgres://localhost/mathgo')).toBe('postgres://localhost/mathgo');
  });
});
