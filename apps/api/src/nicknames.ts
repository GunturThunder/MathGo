import { randomInt } from 'node:crypto';

export const NICKNAME_LANGUAGES = ['id', 'en'] as const;
export type NicknameLanguage = (typeof NICKNAME_LANGUAGES)[number];

/**
 * [Bahasa Indonesia, English] pairs. Positive, child-safe words only. Animals that are common
 * insults in Indonesia (anjing, babi, monyet, kambing, …) are left out on purpose.
 */
const ADJECTIVES: readonly (readonly [string, string])[] = [
  ['Cepat', 'Swift'],
  ['Berani', 'Brave'],
  ['Pintar', 'Clever'],
  ['Ceria', 'Cheerful'],
  ['Hebat', 'Awesome'],
  ['Lincah', 'Nimble'],
  ['Tangguh', 'Tough'],
  ['Gesit', 'Agile'],
  ['Cerdas', 'Bright'],
  ['Ramah', 'Friendly'],
  ['Tenang', 'Calm'],
  ['Kuat', 'Strong'],
  ['Gagah', 'Bold'],
  ['Bijak', 'Wise'],
  ['Riang', 'Jolly'],
  ['Sigap', 'Alert'],
  ['Tekun', 'Keen'],
  ['Setia', 'Loyal'],
  ['Mulia', 'Noble'],
  ['Ajaib', 'Magic'],
  ['Cemerlang', 'Brilliant'],
  ['Mungil', 'Tiny'],
  ['Perkasa', 'Mighty'],
  ['Cerah', 'Sunny'],
  ['Santai', 'Relaxed'],
  ['Tajam', 'Sharp'],
  ['Sakti', 'Mystic'],
  ['Lucu', 'Cute'],
  ['Gembira', 'Happy'],
  ['Jujur', 'Honest'],
];

const ANIMALS: readonly (readonly [string, string])[] = [
  ['Harimau', 'Tiger'],
  ['Gajah', 'Elephant'],
  ['Komodo', 'Komodo'],
  ['Elang', 'Eagle'],
  ['Rusa', 'Deer'],
  ['Kancil', 'Mousedeer'],
  ['Badak', 'Rhino'],
  ['Orangutan', 'Orangutan'],
  ['Penyu', 'Turtle'],
  ['Lumba-lumba', 'Dolphin'],
  ['Paus', 'Whale'],
  ['Kucing', 'Cat'],
  ['Kelinci', 'Rabbit'],
  ['Burung Hantu', 'Owl'],
  ['Merak', 'Peacock'],
  ['Rajawali', 'Hawk'],
  ['Singa', 'Lion'],
  ['Beruang', 'Bear'],
  ['Panda', 'Panda'],
  ['Jerapah', 'Giraffe'],
  ['Zebra', 'Zebra'],
  ['Kuda', 'Horse'],
  ['Rubah', 'Fox'],
  ['Serigala', 'Wolf'],
  ['Kupu-kupu', 'Butterfly'],
  ['Lebah', 'Bee'],
  ['Pinguin', 'Penguin'],
  ['Tupai', 'Squirrel'],
  ['Rangkong', 'Hornbill'],
  ['Kura-kura', 'Tortoise'],
];

/** Indonesian puts the adjective after the noun ("Harimau Cepat"); English before ("Swift Tiger"). */
function compose(language: NicknameLanguage, adjective: number, animal: number): string {
  const [adjId, adjEn] = ADJECTIVES[adjective] ?? [];
  const [animalId, animalEn] = ANIMALS[animal] ?? [];
  if (
    adjId === undefined ||
    adjEn === undefined ||
    animalId === undefined ||
    animalEn === undefined
  ) {
    throw new RangeError(`No nickname ${adjective}/${animal}`);
  }
  return language === 'id' ? `${animalId} ${adjId}` : `${adjEn} ${animalEn}`;
}

/** Every name the generator can produce, in both languages. */
export const ALL_NICKNAMES: ReadonlySet<string> = new Set(
  NICKNAME_LANGUAGES.flatMap((language) =>
    ADJECTIVES.flatMap((_, a) => ANIMALS.map((__, n) => compose(language, a, n))),
  ),
);

export function isGeneratedNickname(name: string): boolean {
  return ALL_NICKNAMES.has(name);
}

/** `count` different random names in one language. */
export function generateNicknames(language: NicknameLanguage, count: number): string[] {
  const names = new Set<string>();
  while (names.size < count) {
    names.add(compose(language, randomInt(ADJECTIVES.length), randomInt(ANIMALS.length)));
  }
  return [...names];
}

export const WORD_LISTS = { adjectives: ADJECTIVES, animals: ANIMALS } as const;
