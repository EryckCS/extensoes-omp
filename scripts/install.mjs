#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, copyFileSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(`Extensões OMP — instalador portátil

  node scripts/install.mjs                         Instalar ou atualizar todas
  node scripts/install.mjs --list                  Listar extensões
  node scripts/install.mjs --only pets             Instalar apenas Pets
  node scripts/install.mjs --only pomodoro         Instalar apenas Pomodoro
  node scripts/install.mjs --agent-dir "caminho"    Escolher a pasta agent

Destino padrão: ~/.omp/agent/extensions/
Respeita PI_CODING_AGENT_DIR ou OMP_CODING_AGENT_DIR.
Guarda backups do código substituído e preserva dados de progresso.
Feche o OMP antes de instalar e abra novamente ao terminar.`);
  process.exit(0);
}
let requestedDir, only, list = false;
try {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--list') { list = true; continue; }
    if (!['--agent-dir', '--only'].includes(args[i]) || !args[i+1]?.trim() || args[i+1].startsWith('--')) throw new Error('Argumentos inválidos. Use --help.');
    const key = args[i++];
    if (key === '--agent-dir') requestedDir = args[i]; else only = args[i];
  }
  const manifest = JSON.parse(readFileSync(join(root, 'extensions.json'), 'utf8').replace(/^\uFEFF/, ''));
  if (manifest.version !== 1 || !Array.isArray(manifest.extensions)) throw new Error('Catálogo de extensões inválido.');
  if (list) {
    for (const entry of manifest.extensions) console.log(`${entry.id} — ${entry.name}\n  ${entry.description}`);
    process.exit(0);
  }
  const selected = manifest.extensions.filter(entry => !only || entry.id === only);
  if (!selected.length) throw new Error(`Extensão não encontrada: ${only || '(catálogo vazio)'}`);
  const configured = requestedDir || process.env.PI_CODING_AGENT_DIR || process.env.OMP_CODING_AGENT_DIR || join(homedir(), '.omp', 'agent');
  const expanded = configured === '~' ? homedir() : configured.startsWith('~/') || configured.startsWith('~\\') ? join(homedir(), configured.slice(2)) : configured;
  const agentDir = resolve(expanded);
  const targets = new Set();
  const plan = selected.map(entry => {
    if (!/^[a-z0-9][a-z0-9._-]*\.js$/i.test(entry.installAs)) throw new Error(`Nome de arquivo inválido: ${entry.id}`);
    if (targets.has(entry.installAs.toLowerCase())) throw new Error(`Nome de instalação duplicado: ${entry.installAs}`);
    targets.add(entry.installAs.toLowerCase());
    const source = resolve(root, entry.file), rel = relative(root, source);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error(`Arquivo fora do repositório: ${entry.id}`);
    const content = readFileSync(source);
    return { entry, source, content, target: join(agentDir, 'extensions', entry.installAs) };
  });
  const backupDir = join(agentDir, 'backups', 'extensoes-omp', `${Date.now()}-${process.pid}`);
  // The old combined extension owns /pomodoro too. Archive it when installing
  // only the standalone timer; installing Pets replaces it through the normal plan.
  const legacy = join(agentDir, 'extensions', 'axolote.js');
  if (selected.some(entry => entry.id === 'pomodoro') && !selected.some(entry => entry.id === 'pets') && existsSync(legacy)) {
    const code = readFileSync(legacy, 'utf8');
    if (/registerCommand\(\s*["']pomodoro["']/.test(code) && /registerCommand\(\s*["']pet["']/.test(code)) {
      const expected = resolve(agentDir, 'extensions', 'axolote.js');
      const destination = resolve(backupDir, 'axolote.js');
      if (resolve(legacy) !== expected || relative(resolve(agentDir, 'backups'), destination).startsWith('..')) throw new Error('Destino de migração inválido.');
      mkdirSync(backupDir, { recursive: true });
      renameSync(legacy, destination);
      console.log(`Versão combinada arquivada para evitar comandos duplicados: ${destination}`);
    }
  }
  for (const { entry, source, content, target } of plan) {
    if (existsSync(target) && content.equals(readFileSync(target))) { console.log(`Já atualizado: ${entry.name}`); continue; }
    if (existsSync(target)) {
      mkdirSync(backupDir, { recursive: true });
      const backup = join(backupDir, entry.installAs);
      copyFileSync(target, backup); console.log(`Backup: ${backup}`);
    }
    mkdirSync(join(agentDir, 'extensions'), { recursive: true });
    copyFileSync(source, target); console.log(`Instalado: ${entry.name}\n  ${target}`);
  }
  console.log('Pronto. Progresso preservado. Reinicie o OMP para carregar as extensões.');
} catch (error) {
  console.error(`Não foi possível instalar: ${error.message}`); process.exitCode = 1;
}
