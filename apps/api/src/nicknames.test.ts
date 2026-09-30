import { createTestDatabase } from '@mathgo/db/testing';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { ALL_NICKNAMES, generateNicknames, isGeneratedNickname, WORD_LISTS } from './nicknames.js';

describe('word lists', () => {
  it('30 adjectives × 30 animals: 900 distinct names per language', () => {
    expect(WORD_LISTS.adjectives).toHaveLength(30);
    expect(WORD_LISTS.animals).toHaveLength(30);
    expect(ALL_NICKNAMES.size).toBe(1_800);
  });

  it('leave out animals that are insults in Indonesia', () => {
    const words = [...WORD_LISTS.adjectives, ...WORD_LISTS.animals]
      .flat()
      .map((w) => w.toLowerCase());
    for (const banned of [
      'anjing',
      'babi',
      'monyet',
      'kambing',
      'kera',
      'dog',
      'pig',
      'monkey',
      'donkey',
      'rat',
    ]) {
      expect(words).not.toContain(banned);
    }
  });

  it('put the adjective after the noun in Indonesian and before it in English', () => {
    expect(isGeneratedNickname('Harimau Cepat')).toBe(true);
    expect(isGeneratedNickname('Swift Tiger')).toBe(true);
    expect(isGeneratedNickname('Burung Hantu Bijak')).toBe(true);
    expect(isGeneratedNickname('Cepat Harimau')).toBe(false);
  });
});

describe('generateNicknames', () => {
  it('gives distinct generated names in the asked language', () => {
    const id = generateNicknames('id', 5);
    expect(new Set(id).size).toBe(5);
    expect(id.every(isGeneratedNickname)).toBe(true);
    const en = generateNicknames('en', 50);
    const englishAdjectives = new Set(WORD_LISTS.adjectives.map(([, e]) => e));
    expect(en.every((n) => englishAdjectives.has(n.split(' ')[0] ?? ''))).toBe(true);
  });
});

const config = loadConfig({ LOG_LEVEL: 'silent' });
const database = await createTestDatabase();
const app = buildApp(config, { db: database.db });
afterAll(async () => {
  await app.close();
  await database.close();
});

describe('nickname endpoints', () => {
  const guest = async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/guest',
      payload: { birthYear: 2000 },
    });
    return res.json<{ accessToken: string }>().accessToken;
  };
  const setNickname = (token: string, nickname: unknown) =>
    app.inject({
      method: 'PATCH',
      url: '/me/nickname',
      headers: { authorization: `Bearer ${token}` },
      payload: { nickname },
    });
  const codeOf = (res: { json: () => unknown }) =>
    (res.json() as { error: { code: string } }).error.code;

  it('GET /nicknames offers 5 names, in Bahasa Indonesia unless asked for English', async () => {
    const id = (await app.inject({ method: 'GET', url: '/nicknames' })).json<{
      nicknames: string[];
    }>();
    expect(id.nicknames).toHaveLength(5);
    expect(id.nicknames.every(isGeneratedNickname)).toBe(true);
    const en = await app.inject({ method: 'GET', url: '/nicknames?lang=en' });
    expect(en.statusCode).toBe(200);
    expect(codeOf(await app.inject({ method: 'GET', url: '/nicknames?lang=fr' }))).toBe(
      'invalid-request',
    );
  });

  it('Done when: only generated names are accepted', async () => {
    const token = await guest();
    const offered = (await app.inject({ method: 'GET', url: '/nicknames' })).json<{
      nicknames: string[];
    }>().nicknames[0];
    const ok = await setNickname(token, offered);
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ nickname: offered });
    expect((await setNickname(token, 'Swift Tiger')).statusCode).toBe(200); // English works too

    for (const typed of [
      'Budi123',
      'harimau cepat',
      'Harimau  Cepat',
      ' Harimau Cepat',
      'Harimau Swift',
      '',
    ]) {
      const res = await setNickname(token, typed);
      expect(res.statusCode).toBe(400);
      expect(codeOf(res)).toBe('nickname-not-allowed');
    }
    expect((await setNickname(token, 42)).statusCode).toBe(400);

    const me = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(me.json()).toMatchObject({ nickname: 'Swift Tiger' });
  });

  it('PATCH /me/nickname needs a signed-in player', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/me/nickname',
      payload: { nickname: 'Swift Tiger' },
    });
    expect(res.statusCode).toBe(401);
  });
});
