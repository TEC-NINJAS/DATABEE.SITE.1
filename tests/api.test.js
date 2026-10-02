import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/index.js';

const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZAAAAABJRU5ErkJggg==';
async function start(dataDir) {
  const server = await createApp({ dataDir });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}
async function close(server) { await new Promise(resolve => server.close(resolve)); }
const post = (url, data) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
test('create observation, protect coordinates, comment and retain records after restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'databee-'));
  let app = await start(directory);
  try {
    assert.deepEqual(await (await fetch(app.url + '/api/observations')).json(), []);
    const response = await post(app.url + '/api/observations', { author: 'Ana', title: 'No jardim', place: 'Campinas, SP', taxon: '', notes: 'Visitando flores', photo, location: { lat: -22.9123, lng: -47.0612 } });
    assert.equal(response.status, 201);
    const observation = await response.json();
    assert.deepEqual(observation.location, { lat: -22.9, lng: -47.1 });
    assert.equal(observation.status, 'Aguardando revisão');
    assert.equal(observation.identificationSource, 'Não identificada');
    const comment = await post(`${app.url}/api/observations/${observation.id}/comments`, { author: 'Bia', text: 'Precisamos de uma foto lateral.' });
    assert.equal(comment.status, 201);
    assert.equal((await comment.json()).comments[0].text, 'Precisamos de uma foto lateral.');
    await close(app.server); app = await start(directory);
    const records = await (await fetch(app.url + '/api/observations')).json();
    assert.equal(records.length, 1); assert.equal(records[0].comments.length, 1);
    assert.equal(records[0].photo, photo);
  } finally { await close(app.server); await rm(directory, { recursive: true, force: true }); }
});
test('validate user input, refuse hostile origins, and report unavailable AI honestly', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'databee-'));
  const app = await start(directory);
  try {
    const valid = { author: 'Ana', title: 'Abelha', place: 'SP', photo };
    assert.equal((await post(app.url + '/api/observations', { ...valid, author: '' })).status, 400);
    assert.equal((await post(app.url + '/api/observations', { ...valid, photo: 'data:image/svg+xml;base64,abcd' })).status, 400);
    assert.equal((await post(app.url + '/api/observations', { ...valid, location: { lat: 100, lng: 0 } })).status, 400);
    assert.equal((await post(app.url + '/api/observations', { ...valid, notes: 'a'.repeat(2001) })).status, 400);
    assert.equal((await post(app.url + '/api/observations', { ...valid, photo: 'a'.repeat(8 * 1024 * 1024) })).status, 413);
    assert.equal((await fetch(app.url + '/api/observations', { headers: { Origin: 'https://untrusted.example' } })).status, 403);
    assert.equal((await post(app.url + '/api/observations/missing/comments', { author: 'Ana', text: 'Oi' })).status, 404);
    const response = await post(app.url + '/api/observations', { ...valid, taxon: 'Tetragonisca angustula' });
    assert.equal((await response.json()).identificationSource, 'Sugestão do observador');
    assert.equal((await (await fetch(app.url + '/api/health')).json()).ai, 'not-configured');
  } finally { await close(app.server); await rm(directory, { recursive: true, force: true }); }
});
