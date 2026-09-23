import { appendFileSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Standalone pets. Optional XP rewards arrive through the OMP event bus.
export default function companions(pi) {
  const dir = fileURLToPath(new URL("./axolote-data/", import.meta.url));
  const ledger = join(dir, "perguntas.log"), profile = join(dir, "pet.json");
  let activeContext, unsubscribe;
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
    return progress.xp;
  }
  function save(ctx) {
    try {
      mkdirSync(dir, { recursive: true });
      const temp = `${profile}.${process.pid}.tmp`;
      writeFileSync(temp, JSON.stringify(state), "utf8"); renameSync(temp, profile);
    } catch { ctx.ui.notify("Não consegui salvar os cuidados dos pets.", "warning"); }
  }
  function art(kind) {
    const mood = moods[kind];
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
    if (available < 24) return [
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
    return [header, ...rows, tint(` ${current().name}: ${messages[state.active]}`, colors[current().color]), tint(` ${total} XP | +10 por pergunta | /pet abre o menu${visible.length === 1 && state.together ? ' | amplie para ver os 3' : ''}`, 245)].map(line => fit(line, available));
  }
  function draw(ctx) {
    if (!ctx.hasUI) return;
    if (state.hidden) { ctx.ui.setWidget("axolote", undefined); return; }
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
    activeContext = ctx;
    unsubscribe?.();
    unsubscribe = pi.events?.on("extensoes-omp:pomodoro:completed", event => {
      if (!activeContext?.hasUI || !event || typeof event.id !== "string" || !/^[0-9a-f-]{36}$/.test(event.id)) return;
      try {
        if (readProgress().rewards.has(event.id)) return;
        mkdirSync(dir, { recursive: true });
        appendFileSync(ledger, `pomodoro:${event.id}:50\n`, "utf8");
        total = readXP();
        react(activeContext, state.active, "happy", "Pomodoro concluído! +50 XP!");
        activeContext.ui.notify("Pets: +50 XP pelo estudo concluído!", "info");
      } catch { activeContext.ui.notify("Pets: não consegui salvar o XP do Pomodoro.", "warning"); }
    });
    draw(ctx);
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
  pi.on("session_shutdown", async () => { generation++; activeContext = undefined; unsubscribe?.(); unsubscribe = undefined; });
  const options = {
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
  pi.registerCommand("pet", {
    description: "Pets: axolote, passarinho, gato, todos, solo, carinho, alimentar, brincar",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) return;
      let [action, ...parts] = args.trim().split(/\s+/); action = action.toLowerCase();
      if (!action) {
        const chosen = await ctx.ui.select(`${current().name} · ${state.active} · Lv. ${Math.floor(total / 100) + 1}`, Object.keys(options));
        if (!chosen) return; action = options[chosen];
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

