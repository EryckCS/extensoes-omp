import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

test('novo usuário começa do zero, sem configurações pessoais ou timer ativo', async t => {
  const root = mkdtempSync(join(tmpdir(), 'extensoes-omp-fresh-'));
  t.after(() => {
    const target = resolve(root), base = resolve(tmpdir());
    if (dirname(target) !== base || !target.startsWith(base + sep)) throw new Error('Unsafe cleanup target');
    rmSync(target, { recursive: true, force: true });
  });
  const local = join(root, 'pets.mjs');
  copyFileSync(fileURLToPath(new URL('../extensions/pets/axolote.js', import.meta.url)), local);
  const { default: pets } = await import(pathToFileURL(local).href);
  const events = {};
  let widget, timers = 0;
  const ctx = {
    hasUI: true,
    setInterval() { timers++; },
    clearTimer() {},
    ui: { setWidget(_key, value) { widget = value; }, notify() {} },
  };
  pets({ on(name, handler) { events[name] = handler; }, registerCommand() {} });
  await events.session_start({}, ctx);
  const screen = widget().render(110).join('\n').replace(/\x1b\[[0-9;]*m/g, '');
  for (const name of ['Loti', 'Piu', 'Mochi']) assert.ok(screen.includes(name));
  assert.match(screen, /Lv\. 1/);
  assert.match(screen, /0 XP/);
  assert.doesNotMatch(screen, /POMODORO/);
  assert.equal(timers, 0);
  assert.equal(existsSync(join(root, 'axolote-data')), false);
});
