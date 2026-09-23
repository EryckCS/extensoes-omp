import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { harness, clock } from './harness.mjs';

test('Pomodoro sozinho: duração, pausas, quatro ciclos, recuperação e cancelamento', async t => {
  const advance = clock(t);
  let app = await harness(t, ['pomodoro']);
  await app.emit('session_start');
  assert.deepEqual(Object.keys(app.commands), ['pomodoro']);
  assert.equal(app.widgets.has('axolote'), false);
  const data = join(app.root, 'pomodoro-data');
  const stateFile = join(data, 'pomodoro.json');
  const saved = () => JSON.parse(readFileSync(stateFile, 'utf8'));
  const receipts = () => existsSync(join(data, 'completed.log')) ? readFileSync(join(data, 'completed.log'), 'utf8').trim().split('\n').filter(Boolean) : [];
  await app.cmd('pomodoro', 'iniciar');
  for (const value of ['0', '-5', '181', '1.5', 'abc', '50 junk']) await app.cmd('pomodoro', `iniciar ${value}`);
  assert.equal(app.intervals.size, 0);
  app.selections.push('Iniciar estudo (25:00)'); app.answers.push('50');
  await app.cmd('pomodoro');
  assert.deepEqual(saved().settings, { focus: 50, short: 10, long: 30 });
  advance(2 * 60000); app.tick(); await app.cmd('pomodoro', 'pausar');
  assert.equal(saved().remainingMs, 48 * 60000);
  advance(5 * 60000); assert.match(app.view('pomodoro'), /48:00/);
  await app.cmd('pomodoro', 'continuar');
  advance(48 * 60000); app.tick();
  assert.equal(receipts().length, 1); assert.equal(saved().phase, 'short'); assert.equal(saved().status, 'ready');
  assert.equal(app.intervals.size, 0);
  advance(60000); app.tick(); assert.equal(receipts().length, 1);
  await app.cmd('pomodoro', 'iniciar 15'); assert.equal(app.intervals.size, 0);
  await app.cmd('pomodoro', 'iniciar'); advance(10 * 60000); app.tick();
  assert.equal(saved().phase, 'focus'); assert.equal(receipts().length, 1);
  for (let cycle = 2; cycle <= 4; cycle++) {
    await app.cmd('pomodoro', 'iniciar 25'); advance(25 * 60000); app.tick();
    assert.equal(receipts().length, cycle);
    assert.equal(saved().phase, cycle === 4 ? 'long' : 'short');
    if (cycle < 4) { await app.cmd('pomodoro', 'iniciar'); advance(5 * 60000); app.tick(); }
  }
  assert.match(app.view('pomodoro'), /Pausa longa 15:00/);
  await app.cmd('pomodoro', 'cancelar'); assert.equal(receipts().length, 4);
  await app.cmd('pomodoro', 'iniciar 30'); advance(60000); app.tick(); await app.shutdown();
  assert.equal(saved().remainingMs, 29 * 60000); assert.equal(saved().status, 'paused');
  advance(24 * 60 * 60000);
  app = await harness(t, ['pomodoro'], app.root); await app.emit('session_start');
  assert.match(app.view('pomodoro'), /29:00/); assert.equal(app.intervals.size, 0);
  await app.cmd('pomodoro', 'continuar'); advance(29 * 60000); app.tick();
  assert.equal(receipts().length, 5);
  writeFileSync(stateFile, JSON.stringify({ ...saved(), phase: 'focus', status: 'running', id: receipts().at(-1), remainingMs: 0 }));
  await app.shutdown(); app = await harness(t, ['pomodoro'], app.root); await app.emit('session_start');
  assert.equal(saved().status, 'ready'); assert.equal(receipts().length, 5);
  assert.equal(existsSync(join(app.root, 'axolote-data')), false, 'timer never creates pet data');
  await app.cmd('pomodoro', 'cancelar'); await app.cmd('pomodoro', 'tempos 7');
  assert.deepEqual(saved().settings, { focus: 7, short: 1, long: 3 });
  for (const width of [0, 1, 20, 40, 82, 83, 110]) assert.ok(app.view('pomodoro', width).length <= Math.max(0, width - 1));
});
