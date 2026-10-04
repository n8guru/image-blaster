import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { generateWorld } from '../.claude/scripts/world/generate-world.mjs';

async function fixture(run) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'image-blaster-world-'));
  const cwd = process.cwd(), fetch = globalThis.fetch, key = process.env.WORLD_LABS_API_KEY;
  process.chdir(dir); process.env.WORLD_LABS_API_KEY = 'mock-test-key';
  await mkdir('worlds/test/output/world', {recursive: true});
  try { await run(); } finally {
    process.chdir(cwd); globalThis.fetch = fetch;
    if (key === undefined) delete process.env.WORLD_LABS_API_KEY; else process.env.WORLD_LABS_API_KEY = key;
    await rm(dir, {recursive: true, force: true});
  }
}
const completed = id => ({operation_id: id, done: true, response: {assets: {}}});

test('hidden running request resumes original operation instead of becoming a completed artifact', async () => fixture(async () => {
  await writeFile('worlds/test/output/world/.0-world-request.json', JSON.stringify({
    request_id: 'existing-operation', status: 'running', submitted_at: '2026-10-04T00:00:00Z',
    request: {display_name: 'test', world_prompt: {type: 'text', text_prompt: 'room'}},
    result: {operation_id: 'existing-operation', done: false},
  }));
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({url, method: options.method || 'GET'});
    return new Response(JSON.stringify(completed('existing-operation')), {status: 200});
  };
  const result = await generateWorld({world: 'test', pollIntervalMs: 0});
  assert.equal(result.operation_id, 'existing-operation');
  assert.equal(result.index, 0);
  assert.deepEqual(calls.map(x => x.method), ['GET']);
  assert.match(calls[0].url, /operations\/existing-operation$/);
  const metadata = JSON.parse(await readFile('worlds/test/output/world/.0-world-request.json'));
  assert.equal(metadata.status, 'completed');
  assert.equal(JSON.parse(await readFile(result.world_json)).assets.constructor, Object);
}));

test('failed hidden request permits a new indexed operation and preserves failed history', async () => fixture(async () => {
  const original = JSON.stringify({request_id: 'failed-operation', status: 'failed'});
  await writeFile('worlds/test/output/world/.0-world-request.json', original);
  let posts = 0;
  globalThis.fetch = async (url, options) => {
    assert.equal(options.method, 'POST'); posts++;
    return new Response(JSON.stringify(completed('retry-operation')), {status: 200});
  };
  const result = await generateWorld({world: 'test', prompt: 'room', pollIntervalMs: 0});
  assert.equal(posts, 1); assert.equal(result.index, 1);
  assert.equal(await readFile('worlds/test/output/world/.0-world-request.json', 'utf8'), original);
  assert.equal(result.operation_id, 'retry-operation');
}));

test('visible completed world is reused without any network request', async () => fixture(async () => {
  await writeFile('worlds/test/output/world/2-world.json', JSON.stringify({assets: {}}));
  globalThis.fetch = async () => { throw new Error('unexpected network request'); };
  const result = await generateWorld({world: 'test'});
  assert.equal(result.skipped, true); assert.equal(result.index, 2);
}));
