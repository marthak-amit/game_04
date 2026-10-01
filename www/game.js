/* GRAVITY DRIFT — one-tap orbital slingshot game.
   Pure HTML5 canvas, zero dependencies. Wrap with Capacitor for Android/iOS. */
(() => {
'use strict';

// ───────────────────────── helpers ─────────────────────────
const W = 720;                    // virtual width; height follows screen aspect
let H = 1280, SC = 1, DPR = 1;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const fmtDate = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const todayStr = () => fmtDate(new Date());
const yesterdayStr = () => fmtDate(new Date(Date.now() - 864e5));

// ───────────────────────── save data ─────────────────────────
const SAVE_KEY = 'gravity-drift-v1';
const DEFAULTS = {
  coins: 0, best: 0, games: 0, totalPlanets: 0,
  sound: true, music: true, haptics: true,
  skin: 'nova', theme: 'deep', ownedSkins: ['nova'], ownedThemes: ['deep'],
  adsRemoved: false, streak: 0, lastReward: '', tutorialDone: false,
  lastInterstitial: 0, runsSinceAd: 0,
  missions: { day: '', list: [] }, daily: { day: '', best: 0, claimed: false },
  levels: [], winStreak: 0, fails: {}, chests: {}, levelWins: 0,
};
let S;
function loadSave() {
  let o = {};
  try { o = JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { /* private mode */ }
  S = Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), o);
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
loadSave();

// ───────────────────────── content ─────────────────────────
const SKINS = [
  { id: 'nova',   name: 'Nova',       c: '#4df3ff', trail: 'line',    price: 0 },
  { id: 'ember',  name: 'Ember',      c: '#ff7a45', trail: 'line',    price: 300 },
  { id: 'orchid', name: 'Orchid',     c: '#ff5ad9', trail: 'dots',    price: 600 },
  { id: 'toxic',  name: 'Toxic',      c: '#b6ff3b', trail: 'dots',    price: 900 },
  { id: 'aurum',  name: 'Aurum',      c: '#ffd23f', trail: 'sparkle', price: 1500 },
  { id: 'prism',  name: 'Prism',      c: '#ffffff', trail: 'rainbow', price: 2500 },
  { id: 'void',   name: 'Voidwalker', c: '#9b6bff', trail: 'sparkle', price: 4000 },
];
const THEMES = [
  { id: 'deep',    name: 'Deep Space',     bg: ['#070b24', '#1a0f3d'], hue: 210, sat: 70, price: 0 },
  { id: 'sunset',  name: 'Solar Dusk',     bg: ['#1c0a2a', '#5a1d45'], hue: 20,  sat: 80, price: 500 },
  { id: 'aurora',  name: 'Aurora',         bg: ['#04161c', '#0b3a3a'], hue: 150, sat: 65, price: 900 },
  { id: 'crimson', name: 'Crimson Nebula', bg: ['#1a0508', '#40102a'], hue: 340, sat: 75, price: 1500 },
  { id: 'ghost',   name: 'Ghost',          bg: ['#0c0c10', '#23232c'], hue: 0,   sat: 0,  price: 2000 },
];
const PRODUCTS = [
  { id: 'starter',   name: 'Starter Pack',  desc: '1500 ✦ + Ember & Orchid orbs + no ads', price: '₹99' },
  { id: 'remove_ads', name: 'Remove Ads',   desc: 'No more interstitial ads',               price: '₹169' },
  { id: 'coins_s',   name: '600 ✦',         desc: 'Stardust pouch',                         price: '₹49' },
  { id: 'coins_m',   name: '2200 ✦',        desc: 'Stardust bag (+10%)',                    price: '₹129' },
  { id: 'coins_l',   name: '7000 ✦',        desc: 'Stardust chest (+25%)',                  price: '₹329' },
];
const DAILY_REWARDS = [50, 75, 100, 150, 200, 300, 500];
const MISSION_TPL = [
  { k: 'planets', txt: 'Visit {n} planets',        r: [40, 90],  reward: 80 },
  { k: 'dust',    txt: 'Collect {n} stardust',     r: [25, 60],  reward: 70 },
  { k: 'close',   txt: 'Pull off {n} close calls', r: [4, 10],   reward: 90 },
  { k: 'score',   txt: 'Score {n} in a single run', r: [20, 45], reward: 120, max: true },
  { k: 'games',   txt: 'Play {n} runs',            r: [3, 6],    reward: 50 },
  { k: 'levels',  txt: 'Complete {n} levels',      r: [2, 4],    reward: 100 },
];
// ───────────── level campaign: 5 worlds x 20 levels ─────────────
const LEVEL_COUNT = 100;
const WORLDS = [
  { name: 'Nebula Nursery',  theme: { bg: ['#070b24', '#1a0f3d'], hue: 210, sat: 70 }, reward: 'ember' },
  { name: 'Asteroid Belt',   theme: { bg: ['#1c0a2a', '#5a1d45'], hue: 20,  sat: 80 }, reward: 'orchid' },
  { name: 'Crumbling Reach', theme: { bg: ['#04161c', '#0b3a3a'], hue: 150, sat: 65 }, reward: 'aurum' },
  { name: 'Event Horizon',   theme: { bg: ['#1a0508', '#40102a'], hue: 340, sat: 75 }, reward: 'prism' },
  { name: 'Chaos Core',      theme: { bg: ['#0a0630', '#2b0f5c'], hue: 270, sat: 80 }, reward: 'void' },
];
const levelCache = [];
function levelDef(i) {
  if (levelCache[i]) return levelCache[i];
  const w = Math.floor(i / 20), k = i % 20, boss = k === 19;
  const diff = clamp(0.02 + (i / 99) * 0.93, 0, 1);
  const goal = 5 + Math.floor(k * 0.8) + w * 2 + (boss ? 6 : 0);
  let obj = 'reach';
  if (!boss) { if (k % 4 === 3) obj = 'launches'; else if (k >= 5 && k % 4 === 1) obj = 'collect'; else if (k >= 6 && k % 4 === 2) obj = 'time'; }
  const cfg = { d: diff, ast: 0, hole: 0, crumble: 0, mover: 0, shield: 0.08, coin: obj === 'collect' ? 1 : 0.9 };
  if (w === 0) { cfg.ast = k >= 5 ? 0.12 + 0.01 * k : 0; cfg.mover = k >= 12 ? 0.1 : 0; cfg.crumble = k >= 15 ? 0.1 : 0; }
  else if (w === 1) { cfg.ast = 0.28 + 0.012 * k; cfg.crumble = k >= 8 ? 0.1 : 0; cfg.mover = k >= 10 ? 0.12 : 0; }
  else if (w === 2) { cfg.ast = 0.15; cfg.crumble = 0.22 + 0.005 * k; cfg.mover = 0.22; }
  else if (w === 3) { cfg.hole = 0.28 + 0.01 * k; cfg.ast = 0.15; cfg.crumble = 0.1; cfg.mover = 0.12; }
  else { cfg.ast = 0.28; cfg.hole = 0.25; cfg.crumble = 0.2; cfg.mover = 0.2; }
  if (boss) { cfg.ast = Math.min(0.6, cfg.ast * 1.3 + 0.05); cfg.hole = Math.min(0.5, cfg.hole * 1.3); }
  return (levelCache[i] = {
    i, w, k, boss, goal, obj, diff, cfg, world: WORLDS[w],
    time: Math.round(goal * (3.6 - diff) + 8), launchLimit: goal + Math.ceil(goal * 0.3) + 1, needNominal: Math.round(goal * 0.9),
  });
}
const levelStars = (i) => S.levels[i] || 0;
const levelUnlocked = (i) => i === 0 || levelStars(i - 1) > 0;
function currentLevel() { for (let i = 0; i < LEVEL_COUNT; i++) if (levelStars(i) <= 0) return i; return LEVEL_COUNT - 1; }
const fmtTime = (s) => Math.floor(s / 60) + ':' + String(Math.max(0, Math.ceil(s) % 60)).padStart(2, '0');
function objText(L, short) {
  const base = { reach: 'Reach the beacon', collect: `Collect ${L.needNominal} ✦ and reach the beacon`, time: `Reach the beacon in ${fmtTime(L.time)}`, launches: `Reach the beacon in ${L.launchLimit} launches` }[L.obj];
  return short ? base.replace('Reach the beacon', 'Reach beacon').replace(' and reach beacon', '') : base;
}

const skinOf = () => SKINS.find((s) => s.id === S.skin) || SKINS[0];
const themeOf = () => THEMES.find((t) => t.id === S.theme) || THEMES[0];
const curTheme = () => (G && G.level ? G.level.world.theme : themeOf());

// ───────────────────────── audio (synthesised, no assets) ─────────────────────────
const SFX = {
  ctx: null, master: null, musicTimer: 0, step: 0,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.7; this.master.connect(this.ctx.destination);
    this.startMusic();
  },
  tone(freq, dur, type = 'sine', vol = 0.15, slide = 0, delay = 0) {
    if (!S.sound || !this.ctx) return;
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol, f0, f1) {
    if (!S.sound || !this.ctx) return;
    const c = this.ctx, n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(f0, c.currentTime); f.frequency.exponentialRampToValueAtTime(f1, c.currentTime + dur);
    const g = c.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(this.master); s.start();
  },
  note(i) { const sc = [0, 2, 4, 7, 9]; return 261.63 * Math.pow(2, (sc[i % 5] + 12 * Math.floor(i / 5)) / 12); },
  launch() { this.noise(0.25, 0.35, 400, 2400); this.tone(220, 0.18, 'triangle', 0.08, 300); },
  capture(streak) { const f = this.note(Math.min(streak, 14)); this.tone(f, 0.35, 'sine', 0.2); this.tone(f * 2, 0.25, 'triangle', 0.07, 0, 0.04); },
  coin() { this.tone(1320, 0.09, 'square', 0.05); this.tone(1760, 0.14, 'square', 0.05, 0, 0.06); },
  close() { this.tone(900, 0.2, 'sawtooth', 0.06, -500); },
  shield() { this.tone(500, 0.3, 'triangle', 0.15, 600); },
  shieldBreak() { this.noise(0.3, 0.4, 3000, 300); this.tone(300, 0.3, 'sawtooth', 0.1, -200); },
  die() { this.noise(0.7, 0.6, 1500, 60); this.tone(160, 0.6, 'sawtooth', 0.18, -120); },
  sector() { [0, 2, 4, 7].forEach((n, i) => this.tone(this.note(n + 5), 0.25, 'triangle', 0.12, 0, i * 0.08)); },
  click() { this.tone(660, 0.06, 'triangle', 0.1); },
  buy() { [0, 4, 7, 9].forEach((n, i) => this.tone(this.note(n + 5), 0.2, 'sine', 0.14, 0, i * 0.07)); },
  startMusic() {
    if (this.musicTimer) return;
    const prog = [[0, 4, 7], [-3, 0, 4], [-5, -1, 2], [-7, -3, 0]];
    this.musicTimer = setInterval(() => {
      if (!S.music || !S.sound || !this.ctx || document.hidden) return;
      const chord = prog[Math.floor(this.step / 4) % 4], i = this.step % 4;
      const f = 220 * Math.pow(2, (chord[i % 3] + (i === 3 ? 12 : 0)) / 12);
      this.tone(f, 1.4, 'sine', 0.035);
      if (i === 0) this.tone(f / 2, 2.2, 'triangle', 0.04);
      this.step++;
    }, 550);
  },
};
function buzz(ms) { if (S.haptics && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } } }

// ───────────────────────── ads & purchases (adapters) ─────────────────────────
// On device, define window.GameAds = { showRewarded(placement):Promise<bool>, showInterstitial():Promise<void> }
// and window.GameIAP = { purchase(id):Promise<bool>, restore():Promise<string[]> } using AdMob / Play Billing plugins.
// In the browser a demo overlay stands in for them so the full flow can be tested.
const adUI = { el: null };
function demoOverlay(title, body, okLabel, waitSec, cb) {
  const el = $('#adOverlay'); el.classList.add('show');
  $('#adTitle').textContent = title; $('#adBody').textContent = body;
  const ok = $('#adOk'), cancel = $('#adCancel');
  let left = waitSec, done = false, timer = 0;
  const finish = (v) => { if (done) return; done = true; clearInterval(timer); el.classList.remove('show'); ok.onclick = cancel.onclick = null; cb(v); };
  const paint = () => { ok.disabled = left > 0; ok.textContent = left > 0 ? `${okLabel} (${left})` : okLabel; };
  paint();
  timer = setInterval(() => { left = Math.max(0, left - 1); paint(); }, 1000);
  ok.onclick = () => finish(true); cancel.onclick = () => finish(false);
}
const Ads = {
  rewarded(placement, cb) {
    if (window.GameAds && window.GameAds.showRewarded) {
      window.GameAds.showRewarded(placement).then((ok) => cb(!!ok)).catch(() => cb(false));
    } else demoOverlay('REWARDED AD', 'Demo ad — a real video plays here on device.', 'CLAIM REWARD', 3, cb);
  },
  maybeInterstitial(done) {
    const due = !S.adsRemoved && S.games >= 6 && S.runsSinceAd >= 3 && Date.now() - S.lastInterstitial > 75000;
    if (!due) return done();
    const fin = () => { S.lastInterstitial = Date.now(); S.runsSinceAd = 0; save(); done(); };
    if (window.GameAds && window.GameAds.showInterstitial) window.GameAds.showInterstitial().then(fin).catch(fin);
    else demoOverlay('AD', 'Demo interstitial.', 'CLOSE', 2, fin);
  },
};
function grantProduct(id) {
  const addSkin = (s) => { if (!S.ownedSkins.includes(s)) S.ownedSkins.push(s); };
  if (id === 'remove_ads') S.adsRemoved = true;
  else if (id === 'starter') { S.coins += 1500; addSkin('ember'); addSkin('orchid'); S.adsRemoved = true; }
  else if (id === 'coins_s') S.coins += 600;
  else if (id === 'coins_m') S.coins += 2200;
  else if (id === 'coins_l') S.coins += 7000;
  save();
}
function purchase(id) {
  const p = PRODUCTS.find((x) => x.id === id); if (!p) return;
  const ok = (v) => { if (v) { grantProduct(id); SFX.buy(); toast('Purchased ' + p.name + '!'); renderShop(); refreshMenu(); } };
  if (window.GameIAP && window.GameIAP.purchase) window.GameIAP.purchase(id).then(ok).catch(() => {});
  else demoOverlay('DEMO PURCHASE', `${p.name} — ${p.price}\n(no real payment in browser demo)`, 'BUY', 0, ok);
}

// ───────────────────────── UI plumbing ─────────────────────────
let toastTimer = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 1800); }
function showScreen(id) { $$('.screen').forEach((s) => { if (s.id !== 'adOverlay') s.classList.toggle('show', s.id === id); }); }
function hideScreens() { $$('.screen').forEach((s) => { if (s.id !== 'adOverlay') s.classList.remove('show'); }); }
let backTo = 'menu';

// ───────────────────────── missions / daily ─────────────────────────
function ensureMissions() {
  const today = todayStr();
  if (S.missions.day === today) return;
  const rng = mulberry32(hashStr('m' + today));
  const pool = MISSION_TPL.slice(), list = [];
  for (let i = 0; i < 3; i++) {
    const t = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    const n = Math.round(lerp(t.r[0], t.r[1], rng()) / 5) * 5 || t.r[0];
    list.push({ k: t.k, n: t.k === 'games' || t.k === 'close' || t.k === 'levels' ? Math.max(1, Math.round(lerp(t.r[0], t.r[1], rng()))) : n, p: 0, claimed: false, reward: t.reward, txt: t.txt, max: !!t.max });
  }
  S.missions = { day: today, list };
  save();
}
function missionProgress(k, v, absolute) {
  ensureMissions();
  S.missions.list.forEach((m) => { if (m.k === k && !m.claimed) m.p = absolute ? Math.max(m.p, v) : m.p + v; });
}
const claimable = () => S.missions.list.some((m) => !m.claimed && m.p >= m.n);
function renderMissions() {
  ensureMissions();
  $('#missionList').innerHTML = S.missions.list.map((m, i) => {
    const done = m.p >= m.n, pct = Math.min(100, (m.p / m.n) * 100);
    return `<div class="mission" style="margin-bottom:8px"><div class="t">${m.txt.replace('{n}', m.n)}<div class="bar"><i style="width:${pct}%"></i></div></div>` +
      (m.claimed ? '<span>✔</span>' : `<button class="btn ${done ? 'primary' : ''}" data-claim="${i}" ${done ? '' : 'disabled'}>+${m.reward} ✦</button>`) + '</div>';
  }).join('');
}
function dailyState() {
  const today = todayStr();
  if (S.daily.day !== today) S.daily = { day: today, best: 0, claimed: false };
  return S.daily;
}
function refreshMenu() {
  ensureMissions(); dailyState();
  $('#menuBest').textContent = S.best; $('#menuCoins').textContent = S.coins;
  $('#playLabel').innerHTML = `PLAY <small>LEVEL ${currentLevel() + 1}</small>`;
  $('#missionBadge').classList.toggle('hidden', !claimable());
  $('#dailyBadge').classList.toggle('hidden', S.daily.claimed);
}
function maybeDailyReward() {
  const today = todayStr();
  if (S.lastReward === today) return;
  const streak = S.lastReward === yesterdayStr() ? S.streak % 7 : 0; // index of today's reward
  $('#rewardDays').innerHTML = DAILY_REWARDS.map((r, i) => `<div class="day ${i < streak ? 'done' : ''} ${i === streak ? 'cur' : ''}">Day ${i + 1}<b>${r}</b>✦</div>`).join('');
  $('#claimDaily').onclick = () => {
    S.coins += DAILY_REWARDS[streak]; S.streak = streak + 1; S.lastReward = today; save();
    SFX.buy(); toast(`+${DAILY_REWARDS[streak]} ✦  Come back tomorrow!`); showScreen('menu'); refreshMenu();
  };
  showScreen('reward');
}

// ───────────────────────── shop ─────────────────────────
let shopTab = 'skins';
function renderShop() {
  $('#shopCoins').textContent = S.coins;
  $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === shopTab));
  const body = $('#shopBody');
  const btn = (kind, it, owned, sel) => owned
    ? `<button class="btn ${sel ? '' : 'primary'}" data-use="${kind}:${it.id}" ${sel ? 'disabled' : ''}>${sel ? 'Equipped' : 'Equip'}</button>`
    : `<button class="btn" data-buy="${kind}:${it.id}">✦ ${it.price}</button>`;
  if (shopTab === 'skins') {
    body.innerHTML = SKINS.map((s) => `<div class="card ${S.skin === s.id ? 'sel' : ''}"><div class="prev"><div class="orb" style="background:${s.c};box-shadow:0 0 18px ${s.c}"></div></div><b>${s.name}</b>${btn('skin', s, S.ownedSkins.includes(s.id), S.skin === s.id)}</div>`).join('');
  } else if (shopTab === 'themes') {
    body.innerHTML = THEMES.map((t) => `<div class="card ${S.theme === t.id ? 'sel' : ''}"><div class="prev"><div class="world" style="background:linear-gradient(${t.bg[0]},${t.bg[1]});border:1px solid hsl(${t.hue},${t.sat}%,55%)"></div></div><b>${t.name}</b>${btn('theme', t, S.ownedThemes.includes(t.id), S.theme === t.id)}</div>`).join('');
  } else {
    body.innerHTML = PRODUCTS.map((p) => {
      const owned = (p.id === 'remove_ads' || p.id === 'starter') && S.adsRemoved && p.id === 'remove_ads';
      return `<div class="card wide"><b>${p.name}<small>${p.desc}</small></b>${owned ? '<span>Owned ✔</span>' : `<button class="btn primary" data-iap="${p.id}">${p.price}</button>`}</div>`;
    }).join('') + '<div class="card wide"><b>Free stardust<small>Watch a short ad</small></b><button class="btn ad" data-freeads="1">+100 ✦</button></div>';
  }
}

// ───────────────────────── game state ─────────────────────────
const cv = $('#c'), ctx = cv.getContext('2d');
let G = null;     // current world
let P = null;     // player
let rng = Math.random;
const glowCache = {};
function glow(color, r) {
  const key = color + r;
  if (glowCache[key]) return glowCache[key];
  const c = document.createElement('canvas'); c.width = c.height = r * 2;
  const g = c.getContext('2d'), gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
  return (glowCache[key] = c);
}
const stars = Array.from({ length: 110 }, () => ({ x: Math.random() * W, y: Math.random() * 1700, z: 0.15 + Math.random() * 0.85, s: Math.random() * 2 + 0.6, p: Math.random() * 6 }));

const FLY = 620;
function diffOf(n) { return Math.min(1, n / 70); }

function newWorld(mode, seed, level) {
  rng = seed ? mulberry32(seed) : Math.random;
  const first = { x: W / 2, y: 0, r: 40, orbit: 92, hue: (level ? level.world.theme : themeOf()).hue, type: 'normal', visited: true, timer: 0, dead: false, bx: W / 2, amp: 0, sp: 0, ph: 0, idx: 0 };
  G = {
    mode, t: 0, camY: -H * 0.62, planets: [first], coins: [], asteroids: [], holes: [], shields: [],
    particles: [], texts: [], shake: 0, genCount: 0, count: 0, score: 0, dust: 0, close: 0, streak: 0,
    revived: false, deadT: 0, earned: 0, seeded: !!seed, sector: 0, flash: 0, isDaily: false, paused: false,
    level: level || null, levelIndex: level ? level.i : -1, maxIdx: 0, totalDust: 0, need: 0, bestStreak: 0, winT: 0, result: null,
    timeLeft: level ? level.time : 0, launchesLeft: level ? level.launchLimit : 0, overShown: false,
  };
  P = { x: first.x + first.orbit, y: first.y, vx: 0, vy: 0, state: 'orbit', planet: first, from: null, ang: 0, dir: 1, rad: first.orbit,
        cd: 0, orbitT: 0, lastOrbitT: 9, shield: 0, inv: 0, trail: [], alive: true };
  if (level) { while (genPlanet()); G.need = Math.min(level.needNominal, Math.floor(G.totalDust * 0.25)); }
  else for (let i = 0; i < 7; i++) genPlanet();
}

function cfgFor(n) {
  const d = diffOf(n);
  return { d, ast: n >= 4 ? 0.22 + 0.3 * d : 0, hole: n >= 9 ? 0.22 : 0, crumble: n >= 5 ? 0.12 + d * 0.12 : 0, mover: n >= 9 ? 0.16 + d * 0.1 : 0, shield: n >= 5 ? 0.07 : 0, coin: 0.85 };
}
function genPlanet() {
  if (G.level && G.genCount >= G.level.goal) return false;
  const last = G.planets[G.planets.length - 1], n = ++G.genCount, c = G.level ? G.level.cfg : cfgFor(n), d = c.d, th = curTheme();
  const dist = lerp(240, 410, d) * (0.88 + rng() * 0.24);
  const a = (rng() - 0.5) * 2 * lerp(0.5, 0.95, d);
  const r = lerp(36, 23, d) * (0.88 + rng() * 0.24);
  let x = clamp(last.x + Math.sin(a) * dist, 110, W - 110);
  const y = last.y - Math.max(170, Math.cos(a) * dist);
  const p = { x, y, r, orbit: r + lerp(54, 38, d), hue: th.hue + (rng() - 0.5) * 70, type: 'normal', visited: false, timer: 0, dead: false, bx: x, amp: 0, sp: 0, ph: rng() * TAU, idx: n };
  if (rng() < c.crumble) p.type = 'crumble';
  else if (rng() < c.mover) { p.type = 'mover'; p.amp = 55 + rng() * 40; p.sp = 0.8 + rng() * 0.8; p.bx = clamp(x, 110 + p.amp, W - 110 - p.amp); }
  if (G.level && n === G.level.goal) { p.type = 'goal'; p.amp = 0; p.bx = x; p.r = 42; p.orbit = 96; p.hue = 46; }
  G.planets.push(p);
  const mx = (last.x + p.x) / 2, my = (last.y + p.y) / 2, ang = Math.atan2(p.y - last.y, p.x - last.x), nx = -Math.sin(ang), ny = Math.cos(ang);
  if (rng() < c.ast) G.asteroids.push({ cx: mx, cy: my, nx, ny, amp: 70 + rng() * 40, sp: 1 + rng() * 1.2, ph: rng() * TAU, r: 15 + rng() * 8, x: mx, y: my, near: false, rot: 0 });
  else if (rng() < c.hole) { const s = rng() < 0.5 ? 1 : -1; G.holes.push({ x: clamp(mx + nx * 150 * s, 90, W - 90), y: my + ny * 150 * s, core: 20, pull: 200, rot: 0, near: false }); }
  if (rng() < c.coin) { const k = 3 + Math.floor(rng() * 3), bend = (rng() - 0.5) * 70; G.totalDust += k; for (let i = 0; i < k; i++) { const f = 0.25 + (0.5 * i) / (k - 1), arc = Math.sin(f * Math.PI) * bend; G.coins.push({ x: lerp(last.x, p.x, f) + nx * arc, y: lerp(last.y, p.y, f) + ny * arc, got: false, ph: i }); } }
  if (rng() < c.shield) G.shields.push({ x: lerp(last.x, p.x, 0.5) + nx * 40, y: lerp(last.y, p.y, 0.5) + ny * 40, got: false });
  return true;
}

function burst(x, y, color, n, speed, life, size = 3) {
  for (let i = 0; i < n && G.particles.length < 500; i++) {
    const a = Math.random() * TAU, s = speed * (0.3 + Math.random() * 0.7);
    G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + Math.random() * 0.4), max: life, size: size * (0.6 + Math.random()), color });
  }
}
function floatText(x, y, text, color = '#fff', size = 30) { G.texts.push({ x, y, text, color, size, life: 1 }); }

// ───────────────────────── gameplay ─────────────────────────
function beginRun() {
  S.games++; S.runsSinceAd++; missionProgress('games', 1);
  hideScreens(); $('#hud').classList.remove('hidden');
  $('#shieldIcon').classList.add('hidden');
  $('#prog').classList.toggle('hidden', !G.level); $('#obj').classList.toggle('hidden', !G.level);
  $('#score').classList.toggle('lvl', !!G.level);
  hud.score = -1; hud.dust = -1; hud.mult = ''; hud.lv = ''; hud.obj = '';
  updateHud();
  $('#hint').textContent = S.tutorialDone ? '' : 'TAP to launch!';
  save();
}
function startGame(daily) {
  SFX.init();
  newWorld('play', daily ? hashStr('daily' + todayStr()) : 0);
  G.isDaily = !!daily;
  beginRun();
}
function startLevel(i) {
  SFX.init();
  const L = levelDef(i);
  newWorld('play', hashStr('level' + i), L);
  beginRun();
  const b = $('#banner');
  b.innerHTML = `<b>LEVEL ${i + 1}</b><span>${objText(L)}</span>`;
  b.classList.remove('go'); void b.offsetWidth; b.classList.add('go');
}

function release(auto) {
  if (!G || G.mode !== 'play' || G.paused || P.state !== 'orbit' || !P.alive) return;
  if (G.level && !auto && G.level.obj === 'launches') { if (G.launchesLeft <= 0) return; G.launchesLeft--; }
  const tx = -Math.sin(P.ang) * P.dir, ty = Math.cos(P.ang) * P.dir;
  P.vx = tx * FLY; P.vy = ty * FLY; P.state = 'fly'; P.from = P.planet; P.cd = 0.3; P.lastOrbitT = P.orbitT;
  SFX.launch(); buzz(12); burst(P.x, P.y, skinOf().c, 8, 160, 0.35, 2.5);
  if (!S.tutorialDone) $('#hint').textContent = 'Land on the next planet!';
}

function capture(p, dx, dy, d) {
  const fresh = !p.visited;
  P.state = 'orbit'; P.planet = p; P.ang = Math.atan2(dy, dx); P.rad = d; P.orbitT = 0;
  P.dir = dx * P.vy - dy * P.vx >= 0 ? 1 : -1;
  if (p.type === 'crumble') p.timer = 2.6;
  if (fresh) {
    p.visited = true; G.count++;
    G.streak = P.lastOrbitT < 1.5 ? G.streak + 1 : P.lastOrbitT > 3.2 ? 0 : G.streak;
    const mult = 1 + Math.min(4, Math.floor(G.streak / 2));
    G.score += mult; G.lastPlanet = p; G.maxIdx = Math.max(G.maxIdx, p.idx); G.bestStreak = Math.max(G.bestStreak, mult);
    missionProgress('planets', 1); S.totalPlanets++;
    SFX.capture(G.streak); buzz(18);
    if (!G.level) floatText(p.x, p.y - p.orbit - 20, '+' + mult, mult > 1 ? '#ff4fd8' : '#fff', 34 + mult * 3);
    else if (mult > 1) floatText(p.x, p.y - p.orbit - 20, 'x' + mult, '#ff4fd8', 34 + mult * 3);
    burst(P.x, P.y, skinOf().c, 14, 220, 0.5);
    G.flash = 0.15; popScore();
    if (!S.tutorialDone) { S.tutorialDone = true; $('#hint').textContent = ''; save(); }
    if (!G.level && G.count % 10 === 0) { G.sector = G.count / 10; SFX.sector(); floatText(W / 2, G.camY + H * 0.3, 'SECTOR ' + (G.sector + 1), '#ffd23f', 54); G.shake = 8; }
  } else { SFX.capture(0); }
  G.lastPlanet = p;
  if (G.level) {
    if (p.type === 'goal') levelDone();
    else if (G.level.obj === 'launches' && G.launchesLeft <= 0) die('launches');
  }
}

function hit(reason) {
  if (!P.alive || P.inv > 0) return;
  if (P.shield > 0 && reason !== 'void') {
    P.shield = 0; P.inv = 1.2; SFX.shieldBreak(); buzz(40); G.shake = 14;
    burst(P.x, P.y, '#4df3ff', 30, 360, 0.6, 3.5); $('#shieldIcon').classList.add('hidden');
    return;
  }
  die(reason);
}
function die(reason) {
  if (!P.alive) return;
  P.alive = false; G.mode = 'dead'; G.deadT = 0; G.shake = 22; G.deathReason = reason;
  SFX.die(); buzz(120);
  burst(P.x, P.y, skinOf().c, 50, 460, 0.9, 4); burst(P.x, P.y, '#ffffff', 20, 300, 0.6, 2.5);
  $('#hint').textContent = '';
}

function update(dt) {
  G.t += dt;
  for (const p of G.planets) if (p.type === 'mover') p.x = p.bx + Math.sin(G.t * p.sp + p.ph) * p.amp;
  for (const a of G.asteroids) { a.rot += dt * 2; const o = Math.sin(G.t * a.sp + a.ph) * a.amp; a.x = a.cx + a.nx * o; a.y = a.cy + a.ny * o; }
  for (const h of G.holes) h.rot += dt * 2.5;
  if (G.mode === 'play') {
    updatePlayer(dt);
    if (G.level && G.level.obj === 'time' && G.mode === 'play') { G.timeLeft -= dt; if (G.timeLeft <= 0) { G.timeLeft = 0; die('time'); } }
  }
  else if (G.mode === 'dead') { G.deadT += dt; if (G.deadT > 0.9 && !G.overShown) { G.overShown = true; gameOver(); } }
  else if (G.mode === 'win') { updatePlayer(dt); G.winT += dt; if (Math.random() < 0.12) burst(P.planet.x + (Math.random() - 0.5) * 240, P.planet.y - 60 - Math.random() * 160, ['#ffd23f', '#ff4fd8', '#4df3ff'][Math.floor(Math.random() * 3)], 18, 300, 0.8); if (G.winT > 1.7 && !G.overShown) { G.overShown = true; showWin(); } }
  // camera
  const target = (P.alive ? P.y : G.camY + H * 0.62) - H * 0.62;
  G.camY += (target - G.camY) * Math.min(1, dt * 4.5);
  // spawn / cull
  while (G.planets[G.planets.length - 1].y > G.camY - 900 && genPlanet());
  const bot = G.camY + H + 400;
  G.planets = G.planets.filter((p) => p.y < bot || p === P.planet || p === P.from);
  G.coins = G.coins.filter((c) => !c.got && c.y < bot); G.asteroids = G.asteroids.filter((a) => a.y < bot);
  G.holes = G.holes.filter((h) => h.y < bot); G.shields = G.shields.filter((s) => !s.got && s.y < bot);
  if (G.level) updateHud();
}

function updatePlayer(dt) {
  P.cd -= dt; P.inv = Math.max(0, P.inv - dt);
  if (P.state === 'orbit') {
    const p = P.planet, d = G.level ? G.level.cfg.d : diffOf(G.count), spd = lerp(290, 400, d);
    P.orbitT += dt;
    P.rad += (p.orbit - P.rad) * Math.min(1, dt * 12);
    P.ang += (P.dir * spd / p.orbit) * dt;
    P.x = p.x + Math.cos(P.ang) * P.rad; P.y = p.y + Math.sin(P.ang) * P.rad;
    if (p.type === 'crumble') { p.timer -= dt; if (p.timer <= 0) { burst(p.x, p.y, '#ffb347', 40, 300, 0.8, 4); p.dead = true; G.shake = 8; SFX.shieldBreak(); release(true); } }
  } else {
    for (const h of G.holes) {
      const dx = h.x - P.x, dy = h.y - P.y, d = Math.hypot(dx, dy);
      if (d < h.pull) { const k = Math.pow(1 - d / h.pull, 1.4) * 1100; P.vx += (dx / d) * k * dt; P.vy += (dy / d) * k * dt; }
      if (d < h.core + 8) { hit('void'); return; }
      if (!h.near && d < h.core + 52 && d > h.core + 8) { h.near = true; nearMiss(h.x, h.y); }
    }
    const sp = Math.hypot(P.vx, P.vy) || 1; P.vx *= FLY / sp; P.vy *= FLY / sp;   // keep constant speed
    P.x += P.vx * dt; P.y += P.vy * dt;
    // capture
    for (const p of G.planets) {
      if (p.dead || (p === P.from && P.cd > 0)) continue;
      const dx = P.x - p.x, dy = P.y - p.y, d = Math.hypot(dx, dy);
      if (d < p.orbit) { capture(p, dx, dy, d); break; }
    }
    // bounds
    if (P.state === 'fly') {
      if (P.y > G.camY + H + 60 || P.x < -110 || P.x > W + 110 || Math.hypot(P.x - P.from.x, P.y - P.from.y) > 1050) { die('lost'); return; }
    }
  }
  if (G.mode !== 'play') return;   // celebrating a win: orbit only
  // asteroids (any state)
  for (const a of G.asteroids) {
    const d = Math.hypot(a.x - P.x, a.y - P.y);
    if (d < a.r + 8) { hit('asteroid'); if (!P.alive) return; }
    else if (!a.near && d < a.r + 46) { a.near = true; nearMiss(a.x, a.y); }
    else if (a.near && d > a.r + 90) a.near = false;
  }
  for (const c of G.coins) if (!c.got) {
    let d = Math.hypot(c.x - P.x, c.y - P.y);
    if (d < 70 && d >= 26) { const k = Math.min(1, dt * 9); c.x += (P.x - c.x) * k; c.y += (P.y - c.y) * k; d = Math.hypot(c.x - P.x, c.y - P.y); }   // stardust magnet
    if (d >= 26) continue;
    c.got = true; G.dust++; S.coins++; missionProgress('dust', 1); SFX.coin(); burst(c.x, c.y, '#ffd23f', 6, 140, 0.35, 2.2); updateHud();
  }
  for (const s of G.shields) if (!s.got && Math.hypot(s.x - P.x, s.y - P.y) < 34) {
    s.got = true; P.shield = 1; SFX.shield(); buzz(25); $('#shieldIcon').classList.remove('hidden'); burst(s.x, s.y, '#4df3ff', 20, 240, 0.5); floatText(s.x, s.y - 30, 'SHIELD', '#4df3ff', 30);
  }
  // trail
  P.trail.unshift({ x: P.x, y: P.y }); if (P.trail.length > 26) P.trail.pop();
  const sk = skinOf();
  if ((sk.trail === 'sparkle' || sk.trail === 'rainbow') && Math.random() < 0.6) G.particles.push({ x: P.x, y: P.y, vx: (Math.random() - 0.5) * 50, vy: (Math.random() - 0.5) * 50, life: 0.5, max: 0.5, size: 2.4, color: sk.trail === 'rainbow' ? `hsl(${(G.t * 400) % 360},100%,65%)` : sk.c });
}
function nearMiss(x, y) {
  G.close++; missionProgress('close', 1); S.totalClose = (S.totalClose || 0) + 1;
  G.score += 1; if (!G.level) popScore(); SFX.close(); buzz(15);
  floatText(P.x, P.y - 40, 'CLOSE! +1', '#ff4fd8', 28); updateHud();
}

const hud = { score: -1, dust: -1, mult: '', lv: '', obj: '' };
function popScore() { const el = $('#score'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); updateHud(); }
function updateHud() {
  if (!G) return;
  if (hud.dust !== G.dust) { hud.dust = G.dust; $('#hudDust').textContent = G.dust; }
  if (G.level) {
    const L = G.level, lv = G.maxIdx + '/' + L.goal;
    if (hud.lv !== lv) { hud.lv = lv; $('#score').textContent = lv; $('#prog i').style.width = (G.maxIdx / L.goal * 100) + '%'; popScore(); }
    let t = 'LEVEL ' + (L.i + 1), warn = false;
    if (L.obj === 'collect') { t += ` · ✦ ${Math.min(G.dust, G.need)}/${G.need}`; warn = G.dust < G.need && G.maxIdx >= L.goal - 2; }
    else if (L.obj === 'time') { t += ' · ⏱ ' + fmtTime(G.timeLeft); warn = G.timeLeft < 10; }
    else if (L.obj === 'launches') { t += ` · ⟲ ${G.launchesLeft} LEFT`; warn = G.launchesLeft <= 2; }
    else t += ' · REACH THE BEACON';
    if (hud.obj !== t) { hud.obj = t; const o = $('#obj'); o.textContent = t; o.classList.toggle('warn', warn); }
  } else if (hud.score !== G.score) { hud.score = G.score; $('#score').textContent = G.score; }
  const m = G.streak >= 2 ? 'COMBO x' + (1 + Math.min(4, Math.floor(G.streak / 2))) : '';
  if (hud.mult !== m) { hud.mult = m; $('#mult').textContent = m; }
}

// ───────────────────────── game over / revive ─────────────────────────
const DEATH_TITLES = { lost: 'LOST IN SPACE', void: 'SWALLOWED', asteroid: 'CRASHED', time: "TIME'S UP", launches: 'OUT OF LAUNCHES', stardust: 'NOT ENOUGH STARDUST' };
function gameOver() {
  if (G.level) return levelFail();
  const score = G.score, newBest = score > S.best;
  if (newBest) S.best = score;
  missionProgress('score', score, true);
  let extra = '';
  if (G.isDaily) {
    const d = dailyState();
    if (score > d.best) d.best = score;
    if (!d.claimed && score >= 15) { d.claimed = true; S.coins += 150; extra = ' · Daily bonus +150 ✦'; }
  }
  G.earned = G.dust + Math.floor(score / 3); S.coins += Math.floor(score / 3);
  save(); refreshMenu();
  $('#hud').classList.add('hidden');
  setOverButtons(false);
  $('#overTitle').textContent = DEATH_TITLES[G.deathReason] || 'CRASHED';
  $('#overScore').textContent = score;
  $('#overBest').textContent = (newBest && score > 0 ? '★ NEW BEST! ★' : 'Best ' + S.best) + extra;
  $('#stPlanets').textContent = G.count; $('#stDust').textContent = G.dust; $('#stClose').textContent = G.close;
  $('#overEarn').textContent = G.earned;
  $('#reviveAd').classList.toggle('hidden', G.revived || score < 3);
  $('#reviveCoin').classList.toggle('hidden', G.revived || score < 3);
  $('#reviveCoin').disabled = S.coins < 150;
  $('#doubleAd').classList.toggle('hidden', G.earned < 10); $('#doubleAd').disabled = false;
  showScreen('over');
}
function revive() {
  G.revived = true;
  if (G.level) { if (G.level.obj === 'time') G.timeLeft += 15; if (G.level.obj === 'launches') G.launchesLeft += 3; } G.overShown = false; G.mode = 'play'; G.paused = false;
  let p = G.lastPlanet && G.planets.includes(G.lastPlanet) ? G.lastPlanet : G.planets[0];
  p.dead = false; if (p.type === 'crumble') p.timer = 2.6;
  P.alive = true; P.state = 'orbit'; P.planet = p; P.from = p; P.cd = 0.3; P.rad = p.orbit; P.orbitT = 0; P.shield = 1; P.inv = 2; P.trail = [];
  P.x = p.x + Math.cos(P.ang) * P.rad; P.y = p.y + Math.sin(P.ang) * P.rad;
  hideScreens(); $('#hud').classList.remove('hidden'); $('#shieldIcon').classList.remove('hidden'); updateHud(); save();
}

// ───────────────────────── level result screens ─────────────────────────
function setOverButtons(level) {
  $('#againBtn').textContent = level ? '↻ RETRY' : 'PLAY AGAIN';
  const h = $('#homeBtn'); h.textContent = level ? '🗺 Map' : '🏠 Menu'; h.dataset.act = level ? 'map' : 'home';
  $('#skipAd').classList.add('hidden'); $('#overTip').textContent = '';
}
const TIPS = {
  asteroid: 'Tip: wait in orbit until the asteroid swings past, then launch.',
  void: 'Tip: black holes bend your path — aim away from them.',
  lost: 'Tip: launch when the planet ring points at the next planet.',
  time: 'Tip: chain quick landings — less waiting, more flying.',
  launches: 'Tip: skip planets — you can aim past the next one.',
  stardust: 'Tip: fly through the stardust trails between planets.',
};
function levelFail() {
  const L = G.level, i = G.levelIndex;
  S.winStreak = 0; S.fails[i] = (S.fails[i] || 0) + 1; save(); refreshMenu();
  const pct = Math.round(G.maxIdx / L.goal * 100), left = L.goal - G.maxIdx;
  $('#hud').classList.add('hidden'); setOverButtons(true);
  $('#overTitle').textContent = DEATH_TITLES[G.deathReason] || 'CRASHED';
  $('#overScore').textContent = pct + '%';
  $('#overBest').textContent = left <= 3 && left > 0 ? `So close! ${left} planet${left > 1 ? 's' : ''} to go` : `Level ${i + 1} · ${objText(L, true)}`;
  $('#stPlanets').textContent = G.maxIdx + '/' + L.goal; $('#stDust').textContent = G.dust; $('#stClose').textContent = G.close;
  $('#overEarn').parentElement.classList.add('hidden');
  $('#overTip').textContent = TIPS[G.deathReason] || '';
  const canRevive = !G.revived && G.deathReason !== 'stardust' && G.maxIdx >= 2;
  $('#reviveAd').classList.toggle('hidden', !canRevive); $('#reviveCoin').classList.toggle('hidden', !canRevive); $('#reviveCoin').disabled = S.coins < 150;
  $('#doubleAd').classList.add('hidden');
  $('#skipAd').classList.toggle('hidden', !((S.fails[i] || 0) >= 3 && !L.boss));
  showScreen('over');
}

function levelDone() {
  G.mode = 'win'; G.winT = 0; G.overShown = false;
  if (G.level.obj === 'collect' && G.dust < G.need) { G.mode = 'play'; die('stardust'); return; }
  P.shield = 0; $('#shieldIcon').classList.add('hidden');
  SFX.sector(); buzz(60); G.shake = 6; G.flash = 0.25;
  burst(P.x, P.y, '#ffd23f', 60, 420, 1.1, 4); burst(P.x, P.y, skinOf().c, 30, 300, 0.9, 3);
  floatText(P.planet.x, P.planet.y - 130, 'COMPLETE!', '#ffd23f', 56);
  computeWin();
}
function computeWin() {
  const L = G.level, i = G.levelIndex, ratio = G.totalDust ? G.dust / G.totalDust : 1;
  let stars = ratio >= 0.7 ? 3 : ratio >= 0.35 ? 2 : 1;
  if (G.revived) stars = Math.min(stars, 2);
  while (S.levels.length < LEVEL_COUNT) S.levels.push(0);
  const prev = S.levels[i], first = prev === 0, newStars = Math.max(0, stars - prev);
  S.levels[i] = Math.max(prev, stars); S.winStreak++; S.levelWins++; S.fails[i] = 0;
  let reward = (first ? 20 + 5 * L.w : 8) + newStars * 10 + Math.min(10, S.winStreak) * 2;
  let worldReward = null;
  if (L.boss && first) {
    reward += 150; const id = L.world.reward;
    if (!S.ownedSkins.includes(id)) { S.ownedSkins.push(id); worldReward = id; }
  }
  S.coins += reward; missionProgress('levels', 1);
  G.result = { stars, prev, newStars, first, reward, worldReward, ratio, doubled: false };
  save(); refreshMenu();
}

let winTimers = [];
function winTimer(fn, ms) { winTimers.push(setTimeout(fn, ms)); }
function countUp(el, to, ms) {
  const t0 = performance.now(), tick = (n) => { const k = clamp((n - t0) / ms, 0, 1); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
function showWin() {
  const r = G.result, L = G.level, i = G.levelIndex, skins = SKINS;
  winTimers.forEach(clearTimeout); winTimers = [];
  $('#hud').classList.add('hidden');
  const worldDone = L.boss && r.first;
  $('#winTitle').textContent = worldDone ? 'WORLD COMPLETE!' : `LEVEL ${i + 1} COMPLETE!`;
  $$('#winStars i').forEach((el) => { el.className = ''; });
  $('#winCoins').textContent = '0';
  const total = G.totalDust, pctNeed = (p) => Math.max(0, Math.ceil(total * p) - G.dust);
  $('#winDust').textContent = `✦ ${G.dust} / ${total} stardust`;
  $('#winNudge').textContent = r.stars === 3 ? '⭐ PERFECT RUN!' : r.stars === 2 ? `Collect ${pctNeed(0.7)} more ✦ for ★★★` : `Collect ${pctNeed(0.35)} more ✦ for ★★`;
  $('#winNudge').classList.toggle('gold', r.stars === 3);
  const chips = [`🔥 Win streak ${S.winStreak}`];
  if (G.bestStreak >= 3) chips.push(`⚡ Combo x${G.bestStreak}`);
  if (r.newStars > 0 && !r.first) chips.push(`+${r.newStars} new ★`);
  if (G.revived) chips.push('Continued (max ★★)');
  $('#winChips').innerHTML = chips.map((c) => `<span>${c}</span>`).join('');
  // world progress / next unlock
  const w0 = L.w * 20; let done = 0; for (let k = 0; k < 20; k++) if (levelStars(w0 + k) > 0) done++;
  const sk = skins.find((x) => x.id === L.world.reward);
  $('#mileTxt').innerHTML = worldDone && r.worldReward ? `🎁 <b>${sk.name} orb unlocked!</b> +150 ✦ chest` : done >= 20 ? `World ${L.w + 1} cleared!` : `World ${L.w + 1} · <b>${done}/20</b> — ${20 - done} more to unlock the <b>${sk.name}</b> orb`;
  $('#mileBar').style.width = '0%'; winTimer(() => { $('#mileBar').style.width = (done / 20 * 100) + '%'; }, 900);
  // next level teaser
  const nxt = i + 1 < LEVEL_COUNT ? levelDef(i + 1) : null;
  if (nxt) {
    const fresh = [nxt.cfg.ast > 0 && L.cfg.ast === 0 ? '🪨 asteroids' : '', nxt.cfg.hole > 0 && L.cfg.hole === 0 ? '🌀 black holes' : '', nxt.cfg.crumble > 0 && L.cfg.crumble === 0 ? '💥 crumbling planets' : '', nxt.cfg.mover > 0 && L.cfg.mover === 0 ? '↔ moving planets' : ''].filter(Boolean);
    $('#nextInfo').textContent = `Next: Level ${i + 2} · ${objText(nxt, true)}` + (fresh.length ? ` · NEW ${fresh.join(', ')}` : '');
    $('#nextBtn').textContent = 'NEXT LEVEL ▶';
  } else { $('#nextInfo').textContent = 'You cleared every level!'; $('#nextBtn').textContent = '🗺 MAP'; }
  $('#winReplay').classList.toggle('hidden', r.stars >= 3);
  $('#winDouble').classList.remove('hidden'); $('#winDouble').disabled = false;
  // confetti
  $('#confetti').innerHTML = Array.from({ length: 44 }, () => `<s style="left:${Math.random() * 100}%;background:hsl(${Math.random() * 360},90%,62%);animation-delay:${Math.random() * 1.2}s;animation-duration:${2.2 + Math.random() * 1.6}s"></s>`).join('');
  showScreen('win'); SFX.buy();
  for (let k = 0; k < r.stars; k++) winTimer(() => { $$('#winStars i')[k].classList.add('on'); SFX.tone(SFX.note(4 + k * 2), 0.5, 'triangle', 0.2); SFX.tone(SFX.note(9 + k * 2), 0.4, 'sine', 0.1, 0, 0.05); buzz(25); }, 450 + k * 450);
  winTimer(() => countUp($('#winCoins'), r.reward, 900), 450 + r.stars * 450);
}

// ───────────────────────── level map ─────────────────────────
const GAP = 104, MAP_TOP = 200, MAP_BOT = 170;
const mapH = () => MAP_TOP + MAP_BOT + (LEVEL_COUNT - 1) * GAP;
function smoothPath(pts) {
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C${(p1.x + (p2.x - p0.x) / 6).toFixed(1)},${(p1.y + (p2.y - p0.y) / 6).toFixed(1)} ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)},${(p2.y - (p3.y - p1.y) / 6).toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}
function chestReward(i) { return 30 + 10 * Math.floor(i / 5); }
function renderMap() {
  const mw = $('#app').clientWidth, cur = currentLevel(), HH = mapH();
  const pos = (i) => ({ x: mw * (0.5 + 0.27 * Math.sin(i * 0.8) + 0.04 * Math.sin(i * 2.3)), y: HH - MAP_BOT - i * GAP });
  let h = '';
  WORLDS.forEach((wd, wi) => {
    const top = wi === 4 ? 0 : pos(wi * 20 + 19).y - GAP / 2, bot = wi === 0 ? HH : pos(wi * 20).y + GAP / 2;
    h += `<div class="wbg" style="top:${top}px;height:${bot - top}px;background:linear-gradient(${wd.theme.bg[0]},${wd.theme.bg[1]})"></div>`;
    const r = mulberry32(wi * 77 + 5);
    for (let d = 0; d < 7; d++) {
      const sz = 30 + r() * 70, left = r() < 0.5 ? -sz * 0.35 + r() * mw * 0.14 : mw * 0.82 + r() * mw * 0.12, y = top + r() * (bot - top - sz), hue = wd.theme.hue + (r() - 0.5) * 60;
      h += `<div class="deco" style="left:${left}px;top:${y}px;width:${sz}px;height:${sz}px;background:radial-gradient(circle at 32% 30%,hsl(${hue},${wd.theme.sat}%,68%),hsl(${hue},${wd.theme.sat}%,22%))"></div>`;
    }
    const sk = SKINS.find((x) => x.id === wd.reward), got = S.ownedSkins.includes(wd.reward);
    h += `<div class="ribbon" style="top:${wi === 0 ? pos(0).y + GAP * 0.78 : pos(wi * 20).y + GAP / 2}px"><b>WORLD ${wi + 1} · ${wd.name.toUpperCase()}</b><span>${got ? '✔' : '🎁'} ${sk.name} orb ${got ? 'unlocked' : 'for clearing this world'}</span></div>`;
  });
  const all = [], litPts = [];
  for (let i = 0; i < LEVEL_COUNT; i++) { all.push(pos(i)); if (i <= cur) litPts.push(pos(i)); }
  h += `<svg class="mpath" width="${mw}" height="${HH}"><path class="dim" d="${smoothPath(all)}"/><path class="lit" d="${smoothPath(litPts.length > 1 ? litPts : [all[0], all[0]])}"/></svg>`;
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const p = pos(i), L = levelDef(i), st = levelStars(i), unlocked = levelUnlocked(i), hue = L.world.theme.hue;
    const cls = [st > 0 ? 'done' : '', i === cur ? 'cur' : '', unlocked ? '' : 'locked', L.boss ? 'boss' : ''].join(' ');
    h += `<button class="node ${cls}" data-lv="${i}" style="left:${p.x}px;top:${p.y}px;--h:${hue}">${L.boss ? '<em>👑</em>' : ''}<b>${unlocked ? i + 1 : '🔒'}</b>` +
      (st > 0 ? `<span class="ns">${[0, 1, 2].map((k) => `<i class="${k < st ? 'on' : ''}">★</i>`).join('')}</span>` : '') + '</button>';
    if (i === cur) h += `<div class="me" style="left:${p.x}px;top:${p.y}px"><i style="background:${skinOf().c};box-shadow:0 0 12px ${skinOf().c}"></i></div><div class="here" style="left:${p.x}px;top:${p.y - 62}px">YOU</div>`;
    if (L.k % 5 === 4) {
      const cx = p.x + (p.x < mw / 2 ? 78 : -78), claimed = !!S.chests[i], ready = st > 0 && !claimed;
      h += `<button class="chest ${claimed ? 'claimed' : ready ? 'ready' : ''}" data-chest="${i}" style="left:${cx}px;top:${p.y}px">${claimed ? '✔' : '🎁'}</button>`;
    }
  }
  $('#mapInner').style.height = HH + 'px'; $('#mapInner').innerHTML = h;
  const stars = S.levels.reduce((a, b) => a + b, 0);
  $('#mapStars').textContent = `${stars}/${LEVEL_COUNT * 3}`; $('#mapCoins').textContent = S.coins;
  $('#mapPlay').innerHTML = `PLAY LEVEL ${cur + 1}`;
  return pos(cur).y;
}
function openMap() {
  if (G && G.mode !== 'menu') { menuWorld = false; G = null; }
  ensureMenuWorld(); $('#hud').classList.add('hidden');
  showScreen('map'); $('#levelInfo').classList.remove('show');
  const y = renderMap(), sc = $('#mapScroll');
  requestAnimationFrame(() => { sc.scrollTop = y - sc.clientHeight * 0.6; });
}
function showLevelInfo(i) {
  const L = levelDef(i), st = levelStars(i);
  $('#infoTitle').textContent = `LEVEL ${i + 1}${L.boss ? ' · BOSS' : ''}`;
  $('#infoWorld').textContent = `World ${L.w + 1} · ${L.world.name}`;
  $('#infoObj').textContent = objText(L);
  $('#infoStars').innerHTML = [['Reach the beacon', 1], ['Collect 35% of stardust', 2], ['Collect 70% of stardust', 3]].map(([t, n]) => `<div class="${st >= n ? 'got' : ''}"><span>${'★'.repeat(n)}</span>${t}</div>`).join('');
  const hz = [L.cfg.ast > 0 ? '🪨 Asteroids' : '', L.cfg.hole > 0 ? '🌀 Black holes' : '', L.cfg.crumble > 0 ? '💥 Crumbling' : '', L.cfg.mover > 0 ? '↔ Moving' : ''].filter(Boolean);
  $('#infoHaz').textContent = hz.length ? hz.join('   ') : 'No hazards — enjoy the flight';
  $('#infoPlay').dataset.play = i; $('#infoPlay').textContent = st > 0 ? '↻ REPLAY' : '▶ PLAY';
  $('#levelInfo').classList.add('show');
}
function skipLevel() {
  const i = G.levelIndex;
  Ads.rewarded('skip_level', (ok) => {
    if (!ok) return;
    while (S.levels.length < LEVEL_COUNT) S.levels.push(0);
    S.levels[i] = Math.max(S.levels[i], 1); S.fails[i] = 0; save(); toast('Level skipped'); startLevel(Math.min(i + 1, LEVEL_COUNT - 1));
  });
}

// ───────────────────────── rendering ─────────────────────────
function resize() {
  const app = $('#app'), w = app.clientWidth, h = app.clientHeight;
  DPR = Math.min(window.devicePixelRatio || 1, 2); SC = w / W; H = h / SC;
  cv.width = Math.round(w * DPR); cv.height = Math.round(h * DPR);
}
window.addEventListener('resize', resize);

function drawBackground() {
  const th = curTheme(), g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // nebula blobs (parallax)
  ctx.globalCompositeOperation = 'lighter';
  const cam = G ? G.camY : 0, col = `hsla(${th.hue},${Math.max(20, th.sat)}%,45%,0.22)`;
  for (let i = 0; i < 3; i++) {
    const y = ((i * 640 - cam * 0.12) % 1900 + 1900) % 1900 - 300;
    ctx.drawImage(glow(col, 260), (i * 310 + 40) % W - 260, y - 260, 520, 520);
  }
  const tt = (G ? G.t : performance.now() / 1000);
  for (const s of stars) {
    const y = (((s.y - cam * s.z * 0.45) % 1700) + 1700) % 1700 * (H / 1700);
    ctx.globalAlpha = (0.35 + 0.65 * s.z) * (0.6 + 0.4 * Math.sin(tt * 2 + s.p));
    ctx.fillStyle = '#fff'; ctx.fillRect(s.x, y, s.s * s.z * 1.6, s.s * s.z * 1.6);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

function drawPlanet(p, active, t) {
  const sat = p.type === 'goal' ? 85 : curTheme().sat, g = ctx.createRadialGradient(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.1, p.x, p.y, p.r);
  g.addColorStop(0, `hsl(${p.hue},${sat}%,72%)`); g.addColorStop(1, `hsl(${p.hue},${sat}%,24%)`);
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6;
  ctx.drawImage(glow(`hsla(${p.hue},${Math.max(30, sat)}%,55%,0.7)`, 96), p.x - p.r * 2.2, p.y - p.r * 2.2, p.r * 4.4, p.r * 4.4);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
  if (p.type === 'crumble') { ctx.strokeStyle = 'rgba(255,200,120,.8)'; ctx.lineWidth = 3; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.7, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  if (p.type === 'mover') { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(p.x - 12, p.y - 2, 24, 4); }
  // orbit ring
  ctx.lineWidth = active ? 4 : 2.5;
  ctx.strokeStyle = active ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.22)';
  ctx.setLineDash([10, 12]); ctx.lineDashOffset = -t * 20;
  ctx.beginPath(); ctx.arc(p.x, p.y, p.orbit, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  if (p.type === 'goal') {
    const ready = !G.level || G.level.obj !== 'collect' || G.dust >= G.need, pulse = 0.5 + 0.5 * Math.sin(t * 4);
    ctx.strokeStyle = ready ? `rgba(255,210,63,${0.5 + 0.4 * pulse})` : 'rgba(255,90,90,.85)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.orbit + 10 + pulse * 8, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x, p.y - p.r); ctx.lineTo(p.x, p.y - p.r - 34); ctx.stroke();
    ctx.fillStyle = ready ? '#ffd23f' : '#ff5a5a'; ctx.beginPath(); ctx.moveTo(p.x, p.y - p.r - 34); ctx.lineTo(p.x + 26, p.y - p.r - 25); ctx.lineTo(p.x, p.y - p.r - 16); ctx.fill();
  }
  if (p.type === 'crumble' && active && p.timer > 0) {
    ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 7; ctx.beginPath();
    ctx.arc(p.x, p.y, p.orbit + 12, -Math.PI / 2, -Math.PI / 2 + TAU * (p.timer / 2.6)); ctx.stroke();
  }
}

function drawTrail(sk) {
  const tr = P.trail; if (tr.length < 2) return;
  if (sk.trail === 'dots') {
    for (let i = 2; i < tr.length; i += 2) { ctx.globalAlpha = 1 - i / tr.length; ctx.fillStyle = sk.c; ctx.beginPath(); ctx.arc(tr[i].x, tr[i].y, 6 * (1 - i / tr.length) + 1, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1; return;
  }
  ctx.lineCap = 'round';
  for (let i = 1; i < tr.length; i++) {
    const k = 1 - i / tr.length;
    ctx.globalAlpha = k * 0.9; ctx.lineWidth = 3 + 11 * k;
    ctx.strokeStyle = sk.trail === 'rainbow' ? `hsl(${(i * 14 + G.t * 300) % 360},100%,65%)` : sk.c;
    ctx.beginPath(); ctx.moveTo(tr[i - 1].x, tr[i - 1].y); ctx.lineTo(tr[i].x, tr[i].y); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function render() {
  ctx.setTransform(SC * DPR, 0, 0, SC * DPR, 0, 0);
  drawBackground();
  if (!G) return;
  const sk = skinOf(), sx = (Math.random() - 0.5) * G.shake, sy = (Math.random() - 0.5) * G.shake;
  ctx.save(); ctx.translate(sx, -G.camY + sy);
  for (const h of G.holes) {
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glow('rgba(160,80,255,.55)', 128), h.x - h.pull * 0.8, h.y - h.pull * 0.8, h.pull * 1.6, h.pull * 1.6);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(190,120,255,.7)'; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(h.x, h.y, h.core + 8 + i * 12, h.rot + i, h.rot + i + 3.6); ctx.stroke(); }
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(h.x, h.y, h.core, 0, TAU); ctx.fill();
  }
  for (const c of G.coins) {
    const sw = Math.abs(Math.cos(G.t * 4 + c.ph));
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glow('rgba(255,210,63,.6)', 32), c.x - 20, c.y - 20, 40, 40); ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 3 + 8 * sw, 11, 0, 0, TAU); ctx.fill();
  }
  for (const s of G.shields) {
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glow('rgba(77,243,255,.7)', 48), s.x - 34, s.y - 34, 68, 68); ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#4df3ff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(s.x, s.y, 14 + Math.sin(G.t * 5) * 2, 0, TAU); ctx.stroke();
  }
  for (const a of G.asteroids) {
    ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.rot);
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glow('rgba(255,90,70,.5)', 48), -a.r * 2, -a.r * 2, a.r * 4, a.r * 4); ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#3b2a30'; ctx.strokeStyle = '#ff6b4a'; ctx.lineWidth = 3; ctx.beginPath();
    for (let i = 0; i < 7; i++) { const an = (i / 7) * TAU, rr = a.r * (0.82 + 0.28 * ((i * 7) % 3) / 2); ctx[i ? 'lineTo' : 'moveTo'](Math.cos(an) * rr, Math.sin(an) * rr); }
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  for (const p of G.planets) if (!p.dead) drawPlanet(p, P && P.planet === p && P.state === 'orbit', G.t);
  if (P.alive) {
    ctx.globalCompositeOperation = 'lighter'; drawTrail(sk); ctx.globalCompositeOperation = 'source-over';
    const blink = P.inv > 0 && Math.floor(G.t * 14) % 2 === 0;
    if (!blink) {
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glow(sk.c, 40), P.x - 30, P.y - 30, 60, 60); ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(P.x, P.y, 9, 0, TAU); ctx.fill();
      ctx.strokeStyle = sk.c; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(P.x, P.y, 9, 0, TAU); ctx.stroke();
      if (P.shield) { ctx.strokeStyle = 'rgba(77,243,255,.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(P.x, P.y, 19 + Math.sin(G.t * 8) * 1.5, 0, TAU); ctx.stroke(); }
    }
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const q of G.particles) { ctx.globalAlpha = clamp(q.life / q.max, 0, 1); ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  for (const t of G.texts) { ctx.globalAlpha = clamp(t.life * 1.5, 0, 1); ctx.font = `900 ${t.size}px "Trebuchet MS",sans-serif`; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,20,.7)'; ctx.strokeText(t.text, t.x, t.y); ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y); }
  ctx.globalAlpha = 1; ctx.restore();
  if (G.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${G.flash * 0.6})`; ctx.fillRect(0, 0, W, H); }
}

function updateFx(dt) {
  for (const q of G.particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.98; q.vy *= 0.98; q.life -= dt; }
  G.particles = G.particles.filter((q) => q.life > 0);
  for (const t of G.texts) { t.y -= 50 * dt; t.life -= dt * 0.9; }
  G.texts = G.texts.filter((t) => t.life > 0);
  G.shake = Math.max(0, G.shake - dt * 40); G.flash = Math.max(0, G.flash - dt);
}

// ───────────────────────── main loop ─────────────────────────
let last = 0, menuWorld = false;
function ensureMenuWorld() {
  if (menuWorld) return;
  newWorld('menu'); menuWorld = true;
  G.planets[0].y = H * 0.55; P.y = G.planets[0].y; G.camY = 0;
  G.planets.length = 1; P.planet = G.planets[0];
}
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000 || 0.016); last = now;
  if (!G) ensureMenuWorld();
  if (G.mode === 'menu') {
    G.t += dt; P.ang += dt * 1.1; const p = G.planets[0]; p.x = W / 2; p.y = H * 0.55; G.camY = 0;
    P.x = p.x + Math.cos(P.ang) * p.orbit; P.y = p.y + Math.sin(P.ang) * p.orbit;
    P.trail.unshift({ x: P.x, y: P.y }); if (P.trail.length > 26) P.trail.pop();
    updateFx(dt);
  } else if (!G.paused) { update(dt); updateFx(dt); }
  render();
  requestAnimationFrame(frame);
}

// ───────────────────────── input & wiring ─────────────────────────
function goMenu() {
  if (G && G.mode !== 'menu') { menuWorld = false; G = null; }
  ensureMenuWorld();
  $('#hud').classList.add('hidden'); refreshMenu(); showScreen('menu');
}
function pause() { if (G && G.mode === 'play' && !G.paused) { G.paused = true; showScreen('pause'); } }
function resume() { if (G && G.paused) { G.paused = false; hideScreens(); } }

cv.addEventListener('pointerdown', (e) => { e.preventDefault(); SFX.init(); release(); });
document.addEventListener('keydown', (e) => { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); release(); } if (e.code === 'Escape') pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
$('#pauseBtn').addEventListener('click', () => { SFX.click(); pause(); });

const actions = {
  play: () => openMap(),
  endless: () => startGame(false),
  daily: () => startGame(true),
  map: () => openMap(),
  closeInfo: () => $('#levelInfo').classList.remove('show'),
  again: () => Ads.maybeInterstitial(() => (G && G.level ? startLevel(G.levelIndex) : startGame(G && G.isDaily))),
  home: () => Ads.maybeInterstitial(goMenu),
  shop: () => { backTo = 'menu'; renderShop(); showScreen('shop'); },
  missions: () => { renderMissions(); showScreen('missions'); },
  settings: () => { renderSettings(); showScreen('settings'); },
  close: () => { refreshMenu(); showScreen('menu'); },
  resume, quit: () => { if (G && G.level) openMap(); else goMenu(); },
  share: () => {
    const text = G && G.level ? `I'm on Level ${currentLevel() + 1} in Gravity Drift! Can you catch up? 🚀` : `I scored ${G ? G.score : S.best} in Gravity Drift! Can you beat me? 🚀`;
    if (navigator.share) navigator.share({ title: 'Gravity Drift', text, url: location.href }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(text + ' ' + location.href).then(() => toast('Copied challenge link!')).catch(() => {});
  },
  restore: () => {
    if (window.GameIAP && window.GameIAP.restore) window.GameIAP.restore().then((ids) => { (ids || []).forEach(grantProduct); toast('Purchases restored'); refreshMenu(); }).catch(() => toast('Nothing to restore'));
    else toast('Nothing to restore');
  },
};
document.addEventListener('click', (e) => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.act && actions[t.dataset.act]) { SFX.init(); SFX.click(); actions[t.dataset.act](); return; }
  if (t.dataset.lv !== undefined) {
    const i = +t.dataset.lv; SFX.click();
    if (!levelUnlocked(i)) toast(`Complete level ${i} first`); else showLevelInfo(i);
    return;
  }
  if (t.dataset.chest !== undefined) {
    const i = +t.dataset.chest;
    if (S.chests[i]) return;
    if (levelStars(i) <= 0) { toast(`Clear level ${i + 1} to open this chest`); return; }
    S.chests[i] = true; S.coins += chestReward(i); save(); SFX.buy(); buzz(30); toast(`🎁 +${chestReward(i)} ✦`);
    t.className = 'chest claimed'; t.textContent = '✔'; $('#mapCoins').textContent = S.coins; refreshMenu(); return;
  }
  if (t.dataset.tab) { shopTab = t.dataset.tab; SFX.click(); renderShop(); return; }
  if (t.dataset.set) { S[t.dataset.set] = !S[t.dataset.set]; save(); renderSettings(); SFX.click(); return; }
  if (t.dataset.claim !== undefined) {
    const m = S.missions.list[+t.dataset.claim]; if (m && !m.claimed && m.p >= m.n) { m.claimed = true; S.coins += m.reward; save(); SFX.buy(); toast(`+${m.reward} ✦`); renderMissions(); refreshMenu(); }
    return;
  }
  if (t.dataset.buy) {
    const [kind, id] = t.dataset.buy.split(':'), list = kind === 'skin' ? SKINS : THEMES, it = list.find((x) => x.id === id);
    if (S.coins >= it.price) { S.coins -= it.price; (kind === 'skin' ? S.ownedSkins : S.ownedThemes).push(id); S[kind === 'skin' ? 'skin' : 'theme'] = id; save(); SFX.buy(); toast('Unlocked ' + it.name + '!'); }
    else { toast('Not enough stardust ✦ — play or visit Store'); }
    renderShop(); refreshMenu(); return;
  }
  if (t.dataset.use) { const [kind, id] = t.dataset.use.split(':'); S[kind] = id; save(); SFX.click(); renderShop(); return; }
  if (t.dataset.iap) { purchase(t.dataset.iap); return; }
  if (t.dataset.freeads) { Ads.rewarded('shop_free', (ok) => { if (ok) { S.coins += 100; save(); SFX.buy(); toast('+100 ✦'); renderShop(); refreshMenu(); } }); return; }
});
$('#infoPlay').addEventListener('click', () => { SFX.init(); startLevel(+$('#infoPlay').dataset.play); });
$('#mapPlay').addEventListener('click', () => { SFX.init(); SFX.click(); startLevel(currentLevel()); });
$('#skipAd').addEventListener('click', skipLevel);
$('#nextBtn').addEventListener('click', () => { SFX.init(); SFX.click(); const i = G.levelIndex; Ads.maybeInterstitial(() => (i + 1 < LEVEL_COUNT ? startLevel(i + 1) : openMap())); });
$('#winReplay').addEventListener('click', () => { SFX.click(); startLevel(G.levelIndex); });
$('#winDouble').addEventListener('click', () => Ads.rewarded('win_double', (ok) => {
  if (!ok || G.result.doubled) return;
  G.result.doubled = true; S.coins += G.result.reward; save(); SFX.buy(); $('#winCoins').textContent = G.result.reward * 2; $('#winDouble').disabled = true; refreshMenu(); toast(`+${G.result.reward} ✦ bonus!`);
}));
$('#reviveAd').addEventListener('click', () => Ads.rewarded('revive', (ok) => { if (ok) revive(); }));
$('#reviveCoin').addEventListener('click', () => { if (S.coins >= 150) { S.coins -= 150; revive(); } });
$('#doubleAd').addEventListener('click', () => Ads.rewarded('double', (ok) => {
  if (ok) { S.coins += G.earned; save(); toast(`+${G.earned} ✦ doubled!`); SFX.buy(); $('#overEarn').textContent = G.earned * 2; $('#doubleAd').disabled = true; refreshMenu(); }
}));
function renderSettings() {
  const lab = { sound: 'Sound effects', music: 'Music', haptics: 'Vibration' };
  $$('[data-set]').forEach((b) => { b.textContent = `${lab[b.dataset.set]}: ${S[b.dataset.set] ? 'ON' : 'OFF'}`; });
}

// ───────────────────────── boot ─────────────────────────
resize();
refreshMenu();
requestAnimationFrame(frame);
maybeDailyReward();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});

// test hook
window.__GD = { levelDef, startLevel, openMap, currentLevel, LEVEL_COUNT, get G() { return G; }, get P() { return P; }, get S() { return S; }, step: (dt) => { update(dt); updateFx(dt); }, release, startGame, actions, FLY };
})();
