import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

test('pets, XP, Pomodoro, recuperação e layout', async (t) => {
const root = mkdtempSync(join(tmpdir(), 'extensoes-omp-pets-'));
const originalNow = Date.now;
t.after(() => {
  Date.now = originalNow;
  const target = resolve(root), base = resolve(tmpdir());
  if (dirname(target) !== base || !target.startsWith(base + sep)) throw new Error('Unsafe cleanup target');
  rmSync(target, {recursive:true, force:true});
});
copyFileSync(fileURLToPath(new URL('../extensions/pets-pomodoro/axolote.js', import.meta.url)),join(root,'pets.mjs'));
const data=join(root,'axolote-data');mkdirSync(data);
const ledger=join(data,'perguntas.log'),focus=join(data,'pomodoro.json');
writeFileSync(ledger,'10\n'.repeat(4));
writeFileSync(join(data,'pet.json'),JSON.stringify({name:'Pipoca',color:'rosa',affection:9}));
const {default:pets}=await import(pathToFileURL(join(root,'pets.mjs')).href);
let now=1000000;Date.now=()=>now;
function setup() {
  const events={},commands={}, intervals=new Map(), timeouts=new Map(), notices=[];
  let counter=0,widget,answers=[],selections=[];
  const ctx={hasUI:true,
    setInterval:fn=>{const id=++counter;intervals.set(id,fn);return id;},
    setTimeout:fn=>{const id=++counter;timeouts.set(id,fn);return id;},
    clearTimer:id=>{intervals.delete(id);timeouts.delete(id);},
    ui:{setWidget:(_key,v)=>widget=v,notify:(msg,type)=>notices.push({msg,type}),input:async()=>answers.shift(),select:async()=>selections.shift()}};
  pets({on:(name,fn)=>events[name]=fn,registerCommand:(name,value)=>commands[name]=value});
  return {events,commands,ctx,intervals,timeouts,notices,answers,selections,
    cmd:arg=>commands.pomodoro.handler(arg,ctx),
    pet:arg=>commands.pet.handler(arg,ctx),
    tick:ms=>{now+=ms;for(const fn of [...intervals.values()])fn();},
    view:width=>widget?.().render(width??110).map(line=>line.replace(/\x1b\[[0-9;]*m/g,'')).join('\n')??''};
}
const saved=()=>JSON.parse(readFileSync(focus,'utf8'));
const rewardCount=()=>readFileSync(ledger,'utf8').split('\n').filter(s=>s.startsWith('pomodoro:')).length;
let app=setup();await app.events.session_start({},app.ctx);
assert.match(app.view(),/40 XP/);assert.match(app.view(),/Pipoca/);
assert.equal(app.intervals.size,0);
// Cancelling the input and rejecting bad durations must not start a timer or earn XP.
await app.cmd('iniciar');assert.equal(app.intervals.size,0);
for(const invalid of ['0','-5','181','1.5','abc','50 junk'])await app.cmd(`iniciar ${invalid}`);
assert.equal(app.intervals.size,0);assert.equal(rewardCount(),0);
// The pet menu leads to the timer; the duration is selected at the start.
app.selections.push('Pomodoro: estudar com os pets');app.selections.push('Iniciar estudo (25:00)');app.answers.push('50');
await app.pet('');assert.equal(saved().settings.focus,50);assert.equal(saved().settings.short,10);assert.equal(saved().settings.long,30);
assert.match(app.view(),/50:00/);assert.equal(app.intervals.size,1);
await app.cmd('iniciar 25');assert.equal(app.intervals.size,1);assert.equal(saved().settings.focus,50);
app.tick(2*60000);await app.cmd('pausar');assert.equal(app.intervals.size,0);assert.equal(saved().remainingMs,48*60000);
app.tick(5*60000);assert.match(app.view(),/48:00/);
await app.cmd('continuar');assert.equal(app.intervals.size,1);
// One remaining interval grants one reward, then waits for manual break start.
app.tick(48*60000);assert.equal(rewardCount(),1);assert.equal(saved().phase,'short');assert.equal(saved().status,'ready');
assert.match(app.view(),/90 XP/);assert.equal(app.intervals.size,0);assert.ok(app.notices.some(n=>n.msg.includes('+50 XP')));
app.tick(60000);assert.equal(rewardCount(),1);
await app.cmd('iniciar 15');assert.equal(app.intervals.size,0);assert.equal(saved().settings.short,10);
await app.cmd('iniciar');assert.equal(saved().phase,'short');assert.match(app.view(),/10:00/);
app.tick(10*60000);assert.equal(saved().phase,'focus');assert.equal(rewardCount(),1);
// Each new focus asks for a new duration; fourth completion receives a long break.
for(let cycle=2;cycle<=4;cycle++) {
  await app.pet('foco 25');assert.equal(saved().settings.short,5);
  app.tick(25*60000);assert.equal(rewardCount(),cycle);
  assert.equal(saved().phase,cycle===4?'long':'short');
  if(cycle<4){await app.cmd('iniciar');app.tick(5*60000);}
}
assert.match(app.view(),/Pausa longa 15:00/);assert.match(app.view(),/240 XP/);
// Hide pets without hiding an active timer.
await app.pet('ocultar');assert.match(app.view(),/POMODORO/);assert.doesNotMatch(app.view(),/Pipoca/);
await app.cmd('cancelar');assert.equal(app.view(),'');assert.equal(rewardCount(),4);
// Graceful close pauses exactly the remaining time and clears the background timer.
await app.cmd('iniciar 30');app.tick(60000);await app.events.session_shutdown({},app.ctx);
assert.equal(app.intervals.size,0);assert.equal(saved().status,'paused');assert.equal(saved().remainingMs,29*60000);
now+=24*60*60000;app=setup();await app.events.session_start({},app.ctx);
assert.match(app.view(),/29:00/);assert.equal(app.intervals.size,0);assert.equal(rewardCount(),4);
await app.cmd('continuar');app.tick(29*60000);assert.equal(rewardCount(),5);assert.equal(saved().phase,'short');
// Recovery after reward is written but timer-state write was interrupted: no duplicate XP.
const rewardedId=readFileSync(ledger,'utf8').split('\n').filter(s=>s.startsWith('pomodoro:')).at(-1).split(':')[1];
writeFileSync(focus,JSON.stringify({...saved(),phase:'focus',status:'running',id:rewardedId,remainingMs:0}));
app=setup();await app.events.session_start({},app.ctx);
assert.equal(saved().status,'ready');assert.equal(saved().phase,'short');assert.equal(app.intervals.size,0);assert.equal(rewardCount(),5);
await app.pet('mostrar');assert.match(app.view(),/290 XP/);
await app.cmd('cancelar');await app.cmd('tempos 60');assert.deepEqual(saved().settings,{focus:60,short:12,long:36});
await app.cmd('tempos 7');assert.deepEqual(saved().settings,{focus:7,short:1,long:3});
// Portrait rows remain ASCII and no line reaches the right margin.
await app.pet('todos');
for(const width of [0,1,20,24,25,50,82,83,110]) {
  const rows=app.view(width).split('\n');
  assert.ok(rows.every(row=>Array.from(row).length<=Math.max(0,width-1)),`width ${width}`);
}


});
