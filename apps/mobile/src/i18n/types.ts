import type { id } from './id';

type Strings<T> = { readonly [K in keyof T]: T[K] extends string ? string : Strings<T[K]> };

/** Every language has exactly the keys of the Bahasa Indonesia file. */
export type Translation = Strings<typeof id>;
