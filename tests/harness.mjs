import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function clock(t) {
  let now = 1000000;
  t.mock.method(Date, 'now', () => now);
  return ms => { now += ms; };
}
export async function harness(t, ids, root) {
  if (!root) {
    root = mkdtempSync(join(tmpdir(), 'extensoes-omp-split-'));
    t.after(() => {
      const target = resolve(root), base = resolve(tmpdir());
      if (dirname(target) !== base || !target.startsWith(base + sep)) throw new Error('Unsafe cleanup');
      rmSync(target, { recursive: true, force: true });
    });
  }
  const events = new Map(), listeners = new Map(), commands = {}, widgets = new Map();
  const intervals = new Map(), timeouts = new Map(), notices = [], answers = [], selections = [];
  let counter = 0;
  const bus = {
    on(name, handler) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(handler);
      return () => listeners.get(name)?.delete(handler);
    },
    emit(name, data) { for (const handler of listeners.get(name) || []) handler(data); },
  };
  const ctx = {
    hasUI: true,
    setInterval(fn) { const id = ++counter; intervals.set(id, fn); return id; },
    setTimeout(fn) { const id = ++counter; timeouts.set(id, fn); return id; },
    clearTimer(id) { intervals.delete(id); timeouts.delete(id); },
    ui: {
      setWidget(key, value) { if (value === undefined) widgets.delete(key); else widgets.set(key, value); },
      notify(msg, type) { notices.push({ msg, type }); },
      input: async () => answers.shift(), select: async () => selections.shift(),
    },
  };
  for (const id of ids) {
    const filename = id === 'pets' ? 'axolote.js' : 'pomodoro.js';
    const source = fileURLToPath(new URL(`../extensions/${id}/${filename}`, import.meta.url));
    const target = join(root, `${id}.mjs`);
    copyFileSync(source, target);
    const { default: extension } = await import(pathToFileURL(target).href);
    extension({
      events: bus,
      on(name, handler) { if (!events.has(name)) events.set(name, []); events.get(name).push(handler); },
      registerCommand(name, command) {
        if (commands[name]) throw new Error(`Duplicate command: ${name}`);
        commands[name] = command;
      },
    });
  }
  const emit = async (name, data = {}) => { for (const fn of events.get(name) || []) await fn(data, ctx); };
  return {
    root, ctx, bus, commands, widgets, intervals, timeouts, notices, answers, selections, emit,
    cmd: (name, args = '') => commands[name].handler(args, ctx),
    tick: () => { for (const fn of [...intervals.values()]) fn(); },
    view: (key, width = 110) => widgets.get(key)?.().render(width).join('\n').replace(/\x1b\[[0-9;]*m/g, '') || '',
    async shutdown() { await emit('session_shutdown'); intervals.clear(); timeouts.clear(); },
  };
}
