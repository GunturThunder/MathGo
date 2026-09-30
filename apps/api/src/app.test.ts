import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { ApiError, type ErrorBody } from './errors.js';

const config = loadConfig({ LOG_LEVEL: 'silent' });
let app = buildApp(config);

afterEach(async () => {
  await app.close();
  app = buildApp(config);
});

describe('GET /health', () => {
  it('returns 200 with a request id', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('keeps a request id sent by the proxy', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'abc-123' },
    });
    expect(res.headers['x-request-id']).toBe('abc-123');
  });
});

describe('error format', () => {
  const errorOf = (body: string) => (JSON.parse(body) as ErrorBody).error;

  it('unknown routes: 404 not-found', async () => {
    const res = await app.inject({ method: 'GET', url: '/nope' });
    expect(res.statusCode).toBe(404);
    expect(errorOf(res.body)).toEqual({
      code: 'not-found',
      message: 'No route for GET /nope',
      requestId: res.headers['x-request-id'],
    });
  });

  it('ApiError: its status, code and message', async () => {
    app.get('/teapot', () => {
      throw new ApiError(409, 'nickname-taken', 'Pick another nickname.');
    });
    const res = await app.inject({ method: 'GET', url: '/teapot' });
    expect(res.statusCode).toBe(409);
    expect(errorOf(res.body)).toMatchObject({
      code: 'nickname-taken',
      message: 'Pick another nickname.',
    });
  });

  it('schema validation: 400 invalid-request', async () => {
    app.get(
      '/count',
      {
        schema: {
          querystring: { type: 'object', required: ['n'], properties: { n: { type: 'integer' } } },
        },
      },
      () => ({ ok: true }),
    );
    const res = await app.inject({ method: 'GET', url: '/count?n=abc' });
    expect(res.statusCode).toBe(400);
    expect(errorOf(res.body).code).toBe('invalid-request');
  });

  it('malformed JSON: 400 bad-request', async () => {
    app.post('/echo', (request) => request.body);
    const res = await app.inject({
      method: 'POST',
      url: '/echo',
      headers: { 'content-type': 'application/json' },
      payload: '{"broken"',
    });
    expect(res.statusCode).toBe(400);
    expect(errorOf(res.body).code).toBe('bad-request');
  });

  it('unexpected errors: 500 without leaking details', async () => {
    app.get('/boom', () => {
      throw new Error('database password is hunter2');
    });
    const res = await app.inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(500);
    expect(errorOf(res.body)).toMatchObject({
      code: 'internal-error',
      message: 'Something went wrong.',
    });
    expect(res.body).not.toContain('hunter2');
  });
});

describe('loadConfig', () => {
  it('has defaults for local development', () => {
    expect(loadConfig({})).toEqual({
      NODE_ENV: 'development',
      HOST: '0.0.0.0',
      PORT: 3000,
      LOG_LEVEL: 'info',
    });
  });

  it('reads the port as a number and rejects bad values', () => {
    expect(loadConfig({ PORT: '8080' }).PORT).toBe(8080);
    expect(() => loadConfig({ PORT: 'eighty' })).toThrow(/PORT/);
    expect(() => loadConfig({ LOG_LEVEL: 'loud' })).toThrow(/LOG_LEVEL/);
  });
});
