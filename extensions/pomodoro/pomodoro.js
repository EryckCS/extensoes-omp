import { appendFileSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

// Standalone Pomodoro. Does not import Pets or read/write pet data.
export default function pomodoro(pi) {
  const dir = fileURLToPath(new URL("./pomodoro-data/", import.meta.url));
  const ledger = join(dir, "completed.log"), focusFile = join(dir, "pomodoro.json");
  let pomo = {
    settings: { focus: 25, short: 5, long: 15 },
    phase: "focus", status: "idle", remainingMs: 25 * 60000, deadline: 0, id: null,
  };
  let ticker, tickerContext, completedFocus = 0;
  function readProgress() {
    let lines;
    try { lines = readFileSync(ledger, "utf8").split("\n"); }
    catch (e) { if (e.code === "ENOENT") lines = []; else throw e; }
    return { rewards: new Set(lines.filter(line => /^[0-9a-f-]{36}$/.test(line))) };
  }
  function draw(ctx) {
    if (!ctx.hasUI) return;
    ctx.ui.setWidget("pomodoro", () => ({
      render(width) {
        const available = Math.max(0, Math.floor(width) - 1);
        const text = available < 65 ? focusLine(true) : focusLine();
        return [text.slice(0, available)];
      },
      invalidate() {},
    }), { placement: "aboveEditor" });
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
    } catch { ctx.ui.notify("Não consegui salvar o Pomodoro. Verifique o acesso à pasta do Pomodoro.", "warning"); return false; }
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
    let phase = "focus", notice, completedId = null;
    try {
      if (pomo.phase === "focus") {
        completedId = pomo.id;
        const before = readProgress();
        if (!before.rewards.has(pomo.id)) {
          mkdirSync(dir, { recursive: true });
          appendFileSync(ledger, `${pomo.id}\n`, "utf8");
        }
        const progress = readProgress();
        completedFocus = progress.rewards.size; phase = nextPhase(progress);
        notice = `Estudo concluído! ${phaseLabel(phase)} de ${pomo.settings[phase]} min pronta; use /pomodoro iniciar.`;
      } else notice = "Pausa concluída! Use /pomodoro iniciar quando quiser começar outro estudo.";
    } catch {
      pomo = { ...pomo, status: "paused", remainingMs: 0, deadline: 0 };
      persistFocus(pomo, ctx);
      ctx.ui.notify("Não consegui salvar a conclusão. Use /pomodoro continuar para tentar novamente.", "warning");
      draw(ctx); return;
    }
    pomo = { ...pomo, phase, status: "ready", remainingMs: duration(phase), deadline: 0, id: null };
    persistFocus(pomo, ctx);
    draw(ctx);
    if (completedId) pi.events?.emit("extensoes-omp:pomodoro:completed", { id: completedId });
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
      if (pomo.status !== "idle") actions["Cancelar ciclo atual"] = "cancelar";
      if (["idle", "ready"].includes(pomo.status) && pomo.phase === "focus") actions["Definir duração do próximo estudo"] = "tempos";
      const selected = await ctx.ui.select(`Pomodoro | ${completedFocus} estudos concluídos`, Object.keys(actions));
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
      pomo = next; startTicker(ctx);
      draw(ctx);
      if (pomo.phase === "focus") ctx.ui.notify(`Estudo: ${pomo.settings.focus} min. Pausa: ${pomo.settings.short} min; após 4 estudos: ${pomo.settings.long} min.`, "info");
    } else if (action === "pausar") {
      if (pomo.status !== "running") { ctx.ui.notify("O cronômetro não está rodando.", "info"); return; }
      const next = { ...pomo, status: "paused", remainingMs: remaining(), deadline: 0 };
      if (!persistFocus(next, ctx)) return;
      pomo = next; stopTicker(); draw(ctx);
    } else if (action === "cancelar") {
      const next = { ...pomo, phase: "focus", status: "idle", remainingMs: duration("focus"), deadline: 0, id: null };
      if (!persistFocus(next, ctx)) return;
      pomo = next; stopTicker(); draw(ctx);
      ctx.ui.notify("Ciclo cancelado. O trecho cancelado não conta como estudo concluído.", "info");
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
    } else ctx.ui.notify("Use /pomodoro iniciar [minutos], pausar, continuar, cancelar ou tempos. Pausa: 20% do estudo, arredondada ao minuto (mínimo 1); longa: 3 vezes a pausa a cada 4 estudos.", "info");
  }
  pi.on("session_start", async (_event, ctx) => {
    stopTicker();
    try { completedFocus = readProgress().rewards.size; }
    catch { ctx.ui.notify("Não consegui ler as sessões concluídas.", "warning"); }
    loadFocus(ctx); draw(ctx);
  });
  pi.on("session_shutdown", async (_event, ctx) => {
    if (pomo.status === "running") {
      pomo = { ...pomo, status: "paused", remainingMs: remaining(), deadline: 0 };
      persistFocus(pomo, ctx);
    }
    stopTicker();
  });
  pi.registerCommand("pomodoro", {
    description: "Estudo: iniciar, pausar, continuar, cancelar, tempos. Pausas proporcionais.",
    handler: handlePomodoro,
  });
}
