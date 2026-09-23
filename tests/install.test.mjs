import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/install.mjs', import.meta.url));
const source = fileURLToPath(new URL('../extensions/pets-pomodoro/axolote.js', import.meta.url));
function sandbox(t) {
  const root = mkdtempSync(join(tmpdir(), 'extensoes-omp-install-'));
  t.after(() => {
    const target = resolve(root), base = resolve(tmpdir());
    if (dirname(target) !== base || !target.startsWith(base + sep)) throw new Error('Unsafe cleanup target');
    rmSync(target, { recursive: true, force: true });
  });
  return root;
}
function run(args, env = {}) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
}

test('instala, preserva dados, faz backup e não duplica backup da mesma versão', t => {
  const root = sandbox(t), agent = join(root, 'meu perfil', 'agent');
  const data = join(agent, 'extensions', 'axolote-data');
  mkdirSync(data, { recursive: true });
  writeFileSync(join(data, 'perguntas.log'), '10\n10\n');
  const prefs = JSON.stringify({ name: 'Meu pet', hidden: false });
  writeFileSync(join(data, 'pet.json'), prefs);
  const target = join(agent, 'extensions', 'axolote.js');
  writeFileSync(target, '// antiga versão\n');
  const result = run(['--agent-dir', agent, '--only', 'pets-pomodoro']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readFileSync(target), readFileSync(source));
  assert.equal(readFileSync(join(data, 'perguntas.log'), 'utf8'), '10\n10\n');
  assert.equal(readFileSync(join(data, 'pet.json'), 'utf8'), prefs);
  const backupRoot = join(agent, 'backups', 'extensoes-omp');
  const versions = readdirSync(backupRoot);
  assert.equal(versions.length, 1);
  assert.equal(readFileSync(join(backupRoot, versions[0], 'axolote.js'), 'utf8'), '// antiga versão\n');
  assert.equal(run(['--agent-dir', agent]).status, 0);
  assert.equal(readdirSync(backupRoot).length, 1);
});

test('aceita configuração por ambiente e lista o catálogo sem instalar', t => {
  const root = sandbox(t), agent = join(root, 'agent');
  const env = { PI_CODING_AGENT_DIR: agent };
  const listed = run(['--list'], env);
  assert.equal(listed.status, 0, listed.stderr);
  assert.match(listed.stdout, /pets-pomodoro/);
  assert.equal(existsSync(agent), false);
  assert.equal(run([], env).status, 0);
  assert.deepEqual(readFileSync(join(agent, 'extensions', 'axolote.js')), readFileSync(source));
});

test('recusa argumentos e extensão inexistente sem criar arquivos', t => {
  const root = sandbox(t), agent = join(root, 'agent');
  for (const args of [['--bad'], ['--agent-dir'], ['--only', 'nao-existe']]) {
    const result = run(args, { PI_CODING_AGENT_DIR: agent });
    assert.notEqual(result.status, 0);
    assert.equal(existsSync(agent), false);
  }
});
