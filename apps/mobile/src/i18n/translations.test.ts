import { en } from './en';
import { id } from './id';

type Tree = { readonly [key: string]: string | Tree };

const flatten = (tree: Tree, prefix = ''): Record<string, string> =>
  Object.fromEntries(
    Object.entries(tree).flatMap(([key, value]) =>
      typeof value === 'string'
        ? [[`${prefix}${key}`, value]]
        : Object.entries(flatten(value, `${prefix}${key}.`)),
    ),
  );

const placeholders = (text: string) => [...text.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort();

describe('translation files', () => {
  const idStrings = flatten(id);
  const enStrings = flatten(en);

  it('have the same keys', () => {
    expect(Object.keys(enStrings).sort()).toEqual(Object.keys(idStrings).sort());
  });

  it('have no empty strings', () => {
    for (const text of [...Object.values(idStrings), ...Object.values(enStrings)]) {
      expect(text.trim()).not.toBe('');
    }
  });

  it('use the same placeholders in both languages', () => {
    for (const [key, text] of Object.entries(idStrings)) {
      expect({ key, placeholders: placeholders(enStrings[key] ?? '') }).toEqual({
        key,
        placeholders: placeholders(text),
      });
    }
  });
});
