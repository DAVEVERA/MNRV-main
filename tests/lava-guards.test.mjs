import assert from 'node:assert/strict';
import test from 'node:test';

import { verifyToolAuth, verifyTurnstile } from '../api/lava/_lib/guards.mjs';

const ENV_KEYS = ['LAVA_TOOL_SECRET', 'TURNSTILE_SECRET_KEY'];

// Runs fn with a controlled environment, then restores the previous one.
async function withEnv(overrides, fn) {
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, overrides);
  try {
    return await fn();
  } finally {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

const req = (headers) => ({ headers });

test('verifyToolAuth rejects a missing header', async () => {
  await withEnv({ LAVA_TOOL_SECRET: 'correct-secret' }, () => {
    assert.equal(verifyToolAuth(req({})), false);
  });
});

test('verifyToolAuth rejects a wrong secret of equal length', async () => {
  await withEnv({ LAVA_TOOL_SECRET: 'correct-secret' }, () => {
    assert.equal(verifyToolAuth(req({ 'x-lava-tool-secret': 'incorrect-secre' })), false);
    assert.equal(verifyToolAuth(req({ 'x-lava-tool-secret': 'wrong' })), false);
  });
});

test('verifyToolAuth rejects everything when no secret is configured', async () => {
  await withEnv({}, () => {
    assert.equal(verifyToolAuth(req({ 'x-lava-tool-secret': '' })), false);
    assert.equal(verifyToolAuth(req({ 'x-lava-tool-secret': 'anything' })), false);
  });
});

test('verifyToolAuth accepts the configured secret', async () => {
  await withEnv({ LAVA_TOOL_SECRET: 'correct-secret' }, () => {
    assert.equal(verifyToolAuth(req({ 'x-lava-tool-secret': 'correct-secret' })), true);
  });
});

test('verifyTurnstile posts the token and returns the success flag', async () => {
  await withEnv({ TURNSTILE_SECRET_KEY: 'ts-secret' }, async () => {
    const calls = [];
    const answer = (success) => async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ success }), { status: 200 });
    };

    assert.equal(await verifyTurnstile('tok-1', '203.0.113.9', answer(true)), true);
    assert.equal(calls[0].url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    assert.equal(calls[0].init.method, 'POST');
    const form = new URLSearchParams(calls[0].init.body);
    assert.equal(form.get('secret'), 'ts-secret');
    assert.equal(form.get('response'), 'tok-1');
    assert.equal(form.get('remoteip'), '203.0.113.9');

    assert.equal(await verifyTurnstile('tok-2', '203.0.113.9', answer(false)), false);
  });
});

test('verifyTurnstile returns false when the siteverify call throws', async () => {
  await withEnv({ TURNSTILE_SECRET_KEY: 'ts-secret' }, async () => {
    const boom = async () => {
      throw new Error('network down');
    };
    assert.equal(await verifyTurnstile('tok-1', '203.0.113.9', boom), false);
  });
});

test('verifyTurnstile returns false for an error status, a bad body, an empty token or no secret', async () => {
  await withEnv({ TURNSTILE_SECRET_KEY: 'ts-secret' }, async () => {
    const status500 = async () => new Response('{"success":true}', { status: 500 });
    const notJson = async () => new Response('<html>', { status: 200 });
    const ok = async () => new Response('{"success":true}', { status: 200 });
    assert.equal(await verifyTurnstile('tok-1', 'ip', status500), false);
    assert.equal(await verifyTurnstile('tok-1', 'ip', notJson), false);
    assert.equal(await verifyTurnstile('', 'ip', ok), false);
  });
  await withEnv({}, async () => {
    const ok = async () => new Response('{"success":true}', { status: 200 });
    assert.equal(await verifyTurnstile('tok-1', 'ip', ok), false);
  });
});
