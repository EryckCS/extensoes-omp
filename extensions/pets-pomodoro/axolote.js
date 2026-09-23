import { appendFileSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

// Local companions and Pomodoro. No network calls or prompt storage.
export default function companions(pi) {
  const dir = fileURLToPath(new URL("./axolote-data/", import.meta.url));
  const ledger = join(dir, "perguntas.log"), profile = join(dir, "pet.json");
  const focusFile = join(dir, "pomodoro.json");
  let pomo = {
    settings: { focus: 25, short: 5, long: 15 },
    phase: "focus", status: "idle", remainingMs: 25 * 60000, deadline: 0, id: null,
  };
  let ticker, tickerContext, completedFocus = 0;
  const colors = { rosa: 218, lilas: 183, azul: 117, verde: 157, amarelo: 222, caramelo: 215 };
  const kinds = ["axolote", "passarinho", "gato"];
  const defaults = {
    axolote: { name: "Loti", color: "rosa", affection: 0 },
    passarinho: { name: "Piu", color: "amarelo", affection: 0 },
    gato: { name: "Mochi", color: "caramelo", affection: 0 },
  };
  let state = { version: 3, active: "axolote", together: true, hidden: false, pets: structuredClone(defaults) };
  let total = 0, generation = 0, frame = 0;
  const moods = Object.fromEntries(kinds.map(k => [k, "awake"]));
  const messages = { axolote: "Bolhinhas e descobertas!", passarinho: "Piu! Vamos estudar?", gato: "Seu parceiro de estudos." };
  const tint = (text, color) => `\x1b[38;5;${color}m${text}\x1b[39m`;
  const clean = s => Array.from(s.normalize("NFC").replace(/[\p{C}\p{Zl}\p{Zp}]/gu, "").trim()).slice(0, 14).join("");
  const current = () => state.pets[state.active];
  // Keep the widget inside the available terminal columns, including narrow panes.
  function charWidth(c) {
    if (/\p{Mark}/u.test(c)) return 0;
    const n = c.codePointAt(0);
    return n >= 0x1100 && (n <= 0x115f || (n >= 0x2e80 && n <= 0xa4cf) || (n >= 0xac00 && n <= 0xd7a3) || (n >= 0xf900 && n <= 0xfaff) || (n >= 0xfe10 && n <= 0xfe6f) || (n >= 0xff01 && n <= 0xff60) || n >= 0x1f000) ? 2 : 1;
  }
  function fit(text, width, pad = false) {
    let result = "", used = 0;
    for (const token of text.match(/\x1b\[[0-9;]*m|[^]/gu) || []) {
      if (token.startsWith("\x1b[")) { result += token; continue; }
      const w = charWidth(token);
      if (used + w > width) break;
      result += token; used += w;
    }
    return result + "\x1b[0m" + (pad ? " ".repeat(Math.max(0, width - used)) : "");
  }
  function readProgress() {
    let lines;
    try { lines = readFileSync(ledger, "utf8").split("\n"); }
    catch (e) { if (e.code === "ENOENT") lines = []; else throw e; }
    const rewards = new Set();
    let xp = 0;
    for (const line of lines) {
      if (line === "10") xp += 10;
      else if (/^pomodoro:[0-9a-f-]{36}:50$/.test(line)) rewards.add(line.split(":")[1]);
    }
    return { xp: xp + rewards.size * 50, rewards };
  }
  function readXP() {
    const progress = readProgress();
    completedFocus = progress.rewards.size;
    return progress.xp;
  }
  const phaseLabel = phase => ({ focus: "Estudo", short: "Pausa", long: "Pausa longa" })[phase];
  const settingsFor = focus => {
    const short = Math.max(1, Math.round(focus / 5));
    return { focus, short, long: short * 3 };
  };
  const duration = phase => pomo.settings[phase] * 60000;
  const remaining = () => pomo.status === "running" ? Math.max(0, pomo.deadline - Date.now()) : pomo.remainingMs;
  function clockText(ms) {
    const seconds = Math.ceil(ms / 1000);
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }
  function focusLine(compact = false) {
    const status = { idle: "pronto", ready: "pronto", running: "em curso", paused: "pausado" }[pomo.status];
    const label = `${phaseLabel(pomo.phase)} ${clockText(remaining())}`;
    return compact ? `${label} (${status})` : ` POMODORO | ${label} | ${status} | ${completedFocus} concluidos | /pomodoro`;
  }
  function persistFocus(next, ctx) {
    try {
      mkdirSync(dir, { recursive: true });
      const temp = `${focusFile}.${process.pid}.tmp`;
      writeFileSync(temp, JSON.stringify(next), "utf8"); renameSync(temp, focusFile);
      return true;
    } catch { ctx.ui.notify("Não consegui salvar o Pomodoro. Verifique o acesso à pasta dos pets.", "warning"); return false; }
  }
  function stopTicker() {
    if (ticker !== undefined) tickerContext.clearTimer(ticker);
    ticker = undefined; tickerContext = undefined;
  }
  function startTicker(ctx) {
    stopTicker();
    tickerContext = ctx;
    ticker = ctx.setInterval(() => {
      if (pomo.status !== "running") return;
      if (remaining() <= 0) finishFocus(ctx);
      else draw(ctx);
    }, 1000);
  }
  function nextPhase(progress) {
    return progress.rewards.size % 4 === 0 ? "long" : "short";
  }
  function finishFocus(ctx) {
    if (pomo.status !== "running") return;
    stopTicker();
    let phase = "focus", notice;
    try {
      if (pomo.phase === "focus") {
        const before = readProgress();
        if (!before.rewards.has(pomo.id)) {
          mkdirSync(dir, { recursive: true });
          appendFileSync(ledger, `pomodoro:${pomo.id}:50\n`, "utf8");
        }
        const progress = readProgress();
        total = progress.xp; completedFocus = progress.rewards.size; phase = nextPhase(progress);
        notice = `Estudo concluído! +50 XP para os pets. ${phaseLabel(phase)} de ${pomo.settings[phase]} min pronta; use /pomodoro iniciar.`;
      } else notice = "Pausa concluída! Use /pomodoro iniciar quando quiser começar outro estudo.";
    } catch {
      pomo = { ...pomo, status: "paused", remainingMs: 0, deadline: 0 };
      persistFocus(pomo, ctx);
      ctx.ui.notify("Não consegui salvar a recompensa. Use /pomodoro continuar para tentar novamente.", "warning");
      draw(ctx); return;
    }
    pomo = { ...pomo, phase, status: "ready", remainingMs: duration(phase), deadline: 0, id: null };
    persistFocus(pomo, ctx);
    for (const kind of kinds) moods[kind] = "happy";
    react(ctx, state.active, "happy", phase === "focus" ? "Descansamos! Vamos aprender?" : "+50 XP! Hora de descansar!");
    ctx.ui.notify(notice, "info");
  }
  function loadFocus(ctx) {
    try {
      const saved = JSON.parse(readFileSync(focusFile, "utf8"));
      const validMinutes = (x, max) => Number.isInteger(x) && x >= 1 && x <= max;
      if (!saved || !validMinutes(saved.settings?.focus, 180) || !validMinutes(saved.settings?.short, 60) || !validMinutes(saved.settings?.long, 120)) throw new Error("Invalid settings");
      const validId = typeof saved.id === "string" && /^[0-9a-f-]{36}$/.test(saved.id);
      if (!["focus", "short", "long"].includes(saved.phase) || !["idle", "ready", "running", "paused"].includes(saved.status) || !Number.isFinite(saved.remainingMs) || saved.remainingMs < 0 || saved.remainingMs > saved.settings[saved.phase] * 60000) throw new Error("Invalid timer");
      if (saved.phase === "focus" && ["running", "paused"].includes(saved.status) && !validId) throw new Error("Invalid focus id");
      pomo = { settings: saved.settings, phase: saved.phase, status: saved.status, remainingMs: saved.remainingMs, deadline: 0, id: validId ? saved.id : null };
      const progress = readProgress();
      if (pomo.phase === "focus" && pomo.id && progress.rewards.has(pomo.id)) {
        const phase = nextPhase(progress);
        pomo = { ...pomo, phase, status: "ready", remainingMs: duration(phase), id: null };
        persistFocus(pomo, ctx);
      } else if (pomo.status === "running") {
        // A closed/crashed app never silently earns focus time or starts a new cycle.
        pomo.status = "paused"; persistFocus(pomo, ctx);
        ctx.ui.notify("Pomodoro recuperado pausado. Use /pomodoro continuar.", "info");
      }
    } catch (e) { if (e.code !== "ENOENT") ctx.ui.notify("Não consegui recuperar o Pomodoro; usando os tempos padrão.", "warning"); }
  }
  async function handlePomodoro(args, ctx) {
    if (!ctx.hasUI) return;
    let [action, minutesArg, ...extra] = args.trim().toLowerCase().split(/\s+/);
    if (extra.length || (minutesArg !== undefined && action !== "iniciar" && action !== "tempos")) {
      ctx.ui.notify("Use /pomodoro iniciar 25, ou abra /pomodoro para escolher.", "info"); return;
    }
    if (pomo.status === "running" && remaining() <= 0) finishFocus(ctx);
    if (!action) {
      const actions = {};
      if (["idle", "ready"].includes(pomo.status)) actions[`Iniciar ${phaseLabel(pomo.phase).toLowerCase()} (${clockText(remaining())})`] = "iniciar";
      if (pomo.status === "running") actions["Pausar cronômetro"] = "pausar";
      if (pomo.status === "paused") actions["Continuar cronômetro"] = "continuar";
      if (pomo.status !== "idle") actions["Cancelar ciclo atual (sem XP extra)"] = "cancelar";
      if (["idle", "ready"].includes(pomo.status) && pomo.phase === "focus") actions["Definir duração do próximo estudo"] = "tempos";
      const selected = await ctx.ui.select(`Pomodoro com ${current().name} | ${completedFocus} estudos concluídos | +50 XP por estudo`, Object.keys(actions));
      if (!selected) return; action = actions[selected];
    }
    if (action === "iniciar" || action === "continuar") {
      if (pomo.status === "running") { ctx.ui.notify("O Pomodoro já está rodando.", "info"); return; }
      if (action === "continuar" && pomo.status !== "paused") { ctx.ui.notify("Não há cronômetro pausado. Use /pomodoro iniciar.", "info"); return; }
      let settings = pomo.settings, remainingMs = pomo.remainingMs;
      if (pomo.phase === "focus" && pomo.status !== "paused") {
        const value = minutesArg ?? await ctx.ui.input("Quantos minutos de estudo? (1 a 180; pausa automática de 20%)", String(pomo.settings.focus));
        if (value === undefined) return;
        const minutes = value.trim() === "" ? pomo.settings.focus : Number(value);
        if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) { ctx.ui.notify("Escolha um tempo inteiro de 1 a 180 minutos.", "warning"); return; }
        settings = settingsFor(minutes); remainingMs = settings.focus * 60000;
      } else if (minutesArg !== undefined) {
        ctx.ui.notify("A pausa é calculada pelo estudo concluído. Para mudar um estudo pausado, cancele-o primeiro.", "info"); return;
      }
      // A second command may have started the timer while the duration dialog was open.
      if (pomo.status === "running") return;
      const next = { ...pomo, settings, remainingMs, status: "running", deadline: Date.now() + remainingMs, id: pomo.phase === "focus" ? pomo.id || randomUUID() : null };
      if (!persistFocus(next, ctx)) return;
      pomo = next; state.hidden = false; startTicker(ctx);
      react(ctx, state.active, pomo.phase === "focus" ? "thinking" : "sleeping", pomo.phase === "focus" ? "Vamos focar juntos!" : "Pausa: respire e estique as pernas.");
      if (pomo.phase === "focus") ctx.ui.notify(`Estudo: ${pomo.settings.focus} min. Pausa: ${pomo.settings.short} min; após 4 estudos: ${pomo.settings.long} min.`, "info");
    } else if (action === "pausar") {
      if (pomo.status !== "running") { ctx.ui.notify("O cronômetro não está rodando.", "info"); return; }
      const next = { ...pomo, status: "paused", remainingMs: remaining(), deadline: 0 };
      if (!persistFocus(next, ctx)) return;
      pomo = next; stopTicker(); draw(ctx);
    } else if (action === "cancelar") {
      const next = { ...pomo, phase: "focus", status: "idle", remainingMs: duration("focus"), deadline: 0, id: null };
      if (!persistFocus(next, ctx)) return;
      pomo = next; stopTicker(); generation++; frame = 0;
      for (const kind of kinds) moods[kind] = "awake";
      messages[state.active] = "Quando quiser, tentamos de novo."; draw(ctx);
      ctx.ui.notify("Ciclo cancelado. Nenhum XP extra foi concedido pelo trecho cancelado.", "info");
    } else if (action === "tempos") {
      if (["running", "paused"].includes(pomo.status) || pomo.phase !== "focus") { ctx.ui.notify("Conclua ou cancele o ciclo antes de mudar o tempo de estudo.", "info"); return; }
      const answer = minutesArg ?? await ctx.ui.input("Minutos de estudo (1 a 180); pausa calculada automaticamente", String(pomo.settings.focus));
      if (answer === undefined) return;
      const minutes = answer.trim() === "" ? pomo.settings.focus : Number(answer);
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) { ctx.ui.notify("Escolha um tempo inteiro de 1 a 180 minutos. Nada foi alterado.", "warning"); return; }
      const settings = settingsFor(minutes);
      // A timer can complete while a dialog is open; never replace an active cycle.
      if (["running", "paused"].includes(pomo.status) || pomo.phase !== "focus") return;
      const next = { ...pomo, settings, remainingMs: settings[pomo.phase] * 60000 };
      if (!persistFocus(next, ctx)) return;
      pomo = next; draw(ctx);
    } else ctx.ui.notify("Use /pomodoro iniciar [minutos], pausar, continuar, cancelar ou tempos. Pausa: 20% do estudo, arredondada ao minuto (mínimo 1); longa: 3 vezes a pausa a cada 4 estudos. +50 XP por estudo concluído.", "info");
  }
  function save(ctx) {
    try {
      mkdirSync(dir, { recursive: true });
      const temp = `${profile}.${process.pid}.tmp`;
      writeFileSync(temp, JSON.stringify(state), "utf8"); renameSync(temp, profile);
    } catch { ctx.ui.notify("Não consegui salvar os cuidados dos pets.", "warning"); }
  }
  function art(kind) {
    const mood = pomo.status === "running" ? (pomo.phase === "focus" ? "thinking" : "sleeping") : moods[kind];
    const asleep = mood === "sleeping" || frame === 1;
    // The portrait uses only single-cell ASCII. Mixed box-drawing, kana and
    // Unicode faces can have different advances in Windows fallback fonts.
    const eye = asleep ? "-" : mood === "happy" ? "^" : mood === "thinking" ? "O" : "o";
    const sparkle = frame === 2 ? "*" : ".";
    if (kind === "axolote") return [
      `   o      ${sparkle}      o`,
      "    \\|/     \\|/",
      "   --.-------.--",
      `  --( ${eye}  v  ${eye} )--`,
      "   --'-------'--",
      "     /(_) (_)\\___)",
      "    ~~~~~~~~~~~~~~",
    ];
    if (kind === "passarinho") return [
      `    ${sparkle}      *`,
      "        ,_,",
      "      .-----.",
      `     ( ${eye} > ${eye} )`,
      frame === 2 ? "    \\|  \\_/  |/" : "    /|  \\_/  |\\",
      "     '-------'",
      "   -----^--^-----",
    ];
    return [
      `    ${sparkle}            ${sparkle}`,
      "      /\\___/\\",
      `     ( ${eye}   ${eye} )`,
      "    =(  =^=  )=",
      "     /  (_)  \\  ,",
      frame === 2 ? "    (u       u)/ /" : "    (u       u)/ )",
      "     '-------'--'",
    ];
  }
  function card(kind) {
    const p = state.pets[kind], count = Math.min(5, Math.floor(p.affection / 3));
    return [
      tint(`${kind === state.active ? '>' : '+'} ${p.name} - ${kind}`, colors[p.color]),
      ...art(kind).map(line => tint(line, colors[p.color])),
      tint("  [" + "*".repeat(count) + ".".repeat(5 - count) + "]", 218) + tint("  vínculo", 245),
    ];
  }
  function render(width) {
    // Leave one column clear to avoid right-margin autowrap on terminal repaint.
    const available = Math.max(0, Math.floor(width) - 1);
    if (state.hidden) return [tint(focusLine(), 117)].map(line => fit(line, available));
    if (available < 24) return [
      focusLine(true),
      tint(`${current().name} - Lv. ${Math.floor(total / 100) + 1}`, colors[current().color]),
      `${total} XP | /pet`,
      "Amplie para ver o pet",
    ].map(line => fit(line, available));
    const visible = state.together && available >= 82 ? kinds : [state.active];
    const columnWidth = visible.length === 3 ? 26 : Math.min(available, 48);
    const cards = visible.map(card);
    const xp = total % 100;
    const header = tint(` JARDIM DOS PETS | Lv. ${Math.floor(total / 100) + 1} `, 183) + "[" + tint("=".repeat(xp / 10), 117) + tint("-".repeat(10 - xp / 10), 240) + `] ${xp}/100 XP`;
    const rows = cards[0].map((_, i) => cards.map(lines => fit(lines[i], columnWidth, true)).join("  "));
    return [tint(focusLine(), pomo.phase === "focus" ? 117 : 157), header, ...rows, tint(` ${current().name}: ${messages[state.active]}`, colors[current().color]), tint(` ${total} XP | +10 por pergunta | /pet abre o menu${visible.length === 1 && state.together ? ' | amplie para ver os 3' : ''}`, 245)].map(line => fit(line, available));
  }
  function draw(ctx) {
    if (!ctx.hasUI) return;
    if (state.hidden && pomo.status === "idle") { ctx.ui.setWidget("axolote", undefined); return; }
    // Component widgets adapt on resize and are not limited to the string-array height.
    ctx.ui.setWidget("axolote", () => ({ render, invalidate() {} }), { placement: "aboveEditor" });
  }
  function react(ctx, kind, mood, message) {
    moods[kind] = mood; messages[kind] = message; frame = 0;
    const ticket = ++generation;
    draw(ctx);
    if (ctx.setTimeout && !state.hidden) {
      for (const [delay, next] of [[700, 1], [1000, 2], [1600, 0]]) {
        ctx.setTimeout(() => { if (ticket !== generation) return; frame = next; draw(ctx); }, delay);
      }
    }
  }
  pi.on("session_start", async (_event, ctx) => {
    stopTicker();
    try { total = readXP(); } catch { ctx.ui.notify("Não consegui ler o XP salvo.", "warning"); }
    try {
      const old = JSON.parse(readFileSync(profile, "utf8"));
      if (!old || typeof old !== "object") throw new Error("Invalid profile");
      // Migrate the original axolotl without losing its name, color or bond.
      const storedPets = old.version === 3 ? old.pets : { axolote: old };
      for (const kind of kinds) {
        const p = storedPets?.[kind]; if (!p) continue;
        state.pets[kind] = {
          name: typeof p.name === "string" ? clean(p.name) || defaults[kind].name : defaults[kind].name,
          color: Object.hasOwn(colors, p.color) ? p.color : defaults[kind].color,
          affection: Number.isSafeInteger(p.affection) && p.affection >= 0 ? p.affection : 0,
        };
      }
      state.hidden = old.hidden === true;
      state.active = kinds.includes(old.active) ? old.active : "axolote";
      state.together = old.together !== false;
    } catch (e) { if (e.code !== "ENOENT") ctx.ui.notify("Preferências inválidas: usando os pets padrão.", "warning"); }
    loadFocus(ctx); draw(ctx);
  });
  pi.on("input", async (event, ctx) => {
    if (!ctx.hasUI || event.source !== "interactive" || !event.text.trim() || event.text.trimStart().startsWith("/")) return;
    try {
      mkdirSync(dir, { recursive: true }); const previous = readXP();
      appendFileSync(ledger, "10\n", "utf8"); total = readXP();
      for (const k of kinds) moods[k] = "thinking";
      react(ctx, state.active, "thinking", Math.floor(total / 100) > Math.floor(previous / 100) ? "Subimos de nível! ★" : "+10 XP! Aprendendo...");
    } catch { react(ctx, state.active, "awake", "Não consegui salvar o XP."); }
  });
  pi.on("agent_end", async (_event, ctx) => {
    for (const k of kinds) moods[k] = "happy";
    react(ctx, state.active, "happy", "Mais uma descoberta! ♡");
  });
  pi.on("session_shutdown", async (_event, ctx) => {
    generation++;
    if (pomo.status === "running") {
      pomo = { ...pomo, status: "paused", remainingMs: remaining(), deadline: 0 };
      persistFocus(pomo, ctx);
    }
    stopTicker();
  });
  const options = {
    "Pomodoro: estudar com os pets": "pomodoro",
    "♡ Fazer carinho": "carinho", "◦ Dar comida": "alimentar", "☆ Brincar": "brincar",
    "☾ Tirar uma soneca": "dormir", "⇄ Escolher bichinho": "escolher", "✿ Mostrar os três": "todos",
    "◌ Mostrar só o escolhido": "solo", "✎ Mudar nome": "nome", "◈ Mudar cor": "cor",
    "◌ Ocultar pets": "ocultar", "● Mostrar pets": "mostrar",
  };
  const reactions = {
    axolote: { carinho: "Fez bolhinhas de alegria!", alimentar: "Nhac! Minhoca deliciosa!", brincar: "Dançando entre as bolhas!" },
    passarinho: { carinho: "Piu-piu! Afofou as penas!", alimentar: "Croc! Sementinhas!", brincar: "Bateu as asinhas! ♫" },
    gato: { carinho: "Prrrr... ronronando!", alimentar: "Miau! Petisco gostoso!", brincar: "Peguei o novelo!" },
  };
  pi.registerCommand("pomodoro", {
    description: "Estudo com pets: iniciar, pausar, continuar, cancelar, tempos. +50 XP por estudo.",
    handler: handlePomodoro,
  });
  pi.registerCommand("pet", {
    description: "Pets e Pomodoro: foco, pomodoro, axolote, passarinho, gato, todos, solo, carinho, alimentar, brincar",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) return;
      let [action, ...parts] = args.trim().split(/\s+/); action = action.toLowerCase();
      if (!action) {
        const chosen = await ctx.ui.select(`${current().name} · ${state.active} · Lv. ${Math.floor(total / 100) + 1}`, Object.keys(options));
        if (!chosen) return; action = options[chosen];
      }
      if (action === "pomodoro" || action === "foco") {
        await handlePomodoro(action === "foco" ? `iniciar ${parts.join(" ")}` : parts.join(" "), ctx); return;
      }
      if (action === "escolher") {
        action = await ctx.ui.select("Quem vai receber os cuidados?", kinds);
        if (!action) return;
      }
      if (kinds.includes(action)) {
        generation++; frame = 0; state.active = action; state.hidden = false; save(ctx); draw(ctx); return;
      }
      if (["carinho", "alimentar", "brincar"].includes(action)) {
        current().affection++; state.hidden = false; save(ctx);
        react(ctx, state.active, action === "alimentar" ? "eating" : "happy", reactions[state.active][action]); return;
      }
      if (action === "dormir") { react(ctx, state.active, "sleeping", "Zzz... sonhos fofinhos."); return; }
      if (action === "nome") {
        const value = parts.join(" ") || await ctx.ui.input("Nome do bichinho escolhido", current().name);
        if (value === undefined) return;
        const name = clean(value); if (!name) { ctx.ui.notify("Digite um nome de 1 a 14 caracteres.", "info"); return; }
        current().name = name;
      } else if (action === "cor") {
        const color = parts[0]?.toLowerCase() || await ctx.ui.select("Cor do bichinho escolhido", Object.keys(colors));
        if (!color) return;
        if (!Object.hasOwn(colors, color)) { ctx.ui.notify("Cores: rosa, lilas, azul, verde, amarelo, caramelo.", "info"); return; }
        current().color = color;
      } else if (action === "todos" || action === "solo") { state.together = action === "todos"; state.hidden = false; }
      else if (action === "ocultar" || action === "mostrar") { state.hidden = action === "ocultar"; }
      else { ctx.ui.notify("Use /pet para abrir o menu dos bichinhos.", "info"); return; }
      generation++; frame = 0; save(ctx); draw(ctx);
    },
  });
}

