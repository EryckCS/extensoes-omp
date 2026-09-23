import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { harness, clock } from './harness.mjs';

test('Pets sozinho: XP, cuidados e personalização, sem cronômetro', async t => {
  let app = await harness(t, ['pets']); await app.emit('session_start');
  assert.deepEqual(Object.keys(app.commands), ['pet']);
  assert.equal(app.widgets.has('pomodoro'), false);
  await app.emit('input', { source: 'interactive', text: 'Pergunta' });
  await app.emit('input', { source: 'extension', text: 'Automatic' });
  await app.emit('input', { source: 'interactive', text: '/pet' });
  assert.match(app.view('axolote'), /10 XP/);
  for (const kind of ['axolote', 'passarinho', 'gato']) {
    await app.cmd('pet', kind);
    for (const action of ['carinho', 'alimentar', 'brincar']) await app.cmd('pet', action);
  }
  await app.cmd('pet', 'nome Amora'); await app.cmd('pet', 'cor lilas');
  const prefs = JSON.parse(readFileSync(join(app.root, 'axolote-data', 'pet.json'), 'utf8'));
  assert.equal(prefs.pets.gato.name, 'Amora'); assert.equal(prefs.pets.gato.affection, 3);
  await app.shutdown(); app = await harness(t, ['pets'], app.root); await app.emit('session_start');
  assert.match(app.view('axolote'), /Amora/); assert.match(app.view('axolote'), /10 XP/);
  assert.equal(existsSync(join(app.root, 'pomodoro-data')), false);
  await app.cmd('pet', 'ocultar'); assert.equal(app.view('axolote'), '');
  await app.cmd('pet', 'mostrar');
  for (const width of [0, 1, 20, 40, 82, 83, 110]) assert.ok(app.view('axolote', width).split('\n').every(row => Array.from(row).length <= Math.max(0, width - 1)));
});

test('integração opcional: widgets independentes e +50 XP uma única vez', async t => {
  const advance = clock(t);
  let app = await harness(t, ['pomodoro', 'pets']); await app.emit('session_start');
  assert.deepEqual(Object.keys(app.commands).sort(), ['pet', 'pomodoro']);
  await app.cmd('pet', 'ocultar'); assert.equal(app.widgets.has('axolote'), false); assert.equal(app.widgets.has('pomodoro'), true);
  await app.cmd('pomodoro', 'iniciar 1'); advance(60000); app.tick();
  const id = readFileSync(join(app.root, 'pomodoro-data', 'completed.log'), 'utf8').trim();
  await app.cmd('pet', 'mostrar'); assert.match(app.view('axolote'), /50 XP/);
  app.bus.emit('extensoes-omp:pomodoro:completed', { id });
  app.bus.emit('extensoes-omp:pomodoro:completed', { id: 'invalid' });
  assert.match(app.view('axolote'), /50 XP/);
  await app.shutdown();
  app = await harness(t, ['pets', 'pomodoro'], app.root); await app.emit('session_start');
  app.bus.emit('extensoes-omp:pomodoro:completed', { id });
  assert.match(app.view('axolote'), /50 XP/);
  await app.emit('session_start');
  app.bus.emit('extensoes-omp:pomodoro:completed', { id: '11111111-1111-1111-1111-111111111111' });
  assert.match(app.view('axolote'), /100 XP/);
});
