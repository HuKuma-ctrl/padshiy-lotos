'use strict';

/* ================= ДИАГНОСТИКА И ТОСТЫ ================= */
// Вместо alert(): лёгкий тост + ловушка ошибок для отладки в WebView
function toast(msg) {
  const t = document.createElement('div');
  t.style.cssText =
    'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);' +
    'background:#241e33;color:#e8c15a;border:1px solid #9a7f3a;border-radius:12px;' +
    'padding:12px 18px;font-size:14px;max-width:85%;text-align:center;' +
    'white-space:pre-line;z-index:999;box-shadow:0 4px 20px rgba(0,0,0,.5);';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .4s'; }, 2600);
  setTimeout(() => t.remove(), 3000);
}

window.addEventListener('error', e => {
  toast('⚠️ Ошибка: ' + e.message + '\n(' + (e.filename || '').split('/').pop() + ':' + e.lineno + ')');
});

/* ================= ЗВУК (WebAudio, синтез) ================= */
const SFX = {
  ctx: null,
  ensure() {
    if (typeof AudioContext === 'undefined' && typeof webkitAudioContext === 'undefined') return false;
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  },
  play(freq, dur, type, vol, slide) {
    if (typeof state !== 'undefined' && state && state.sound === false) return;
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    gain.gain.setValueAtTime(vol || 0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  },
  tap()      { this.play(880, 0.05, 'sine', 0.025); },
  hit()      { this.play(200, 0.06, 'square', 0.03, -80); },
  crit()     { this.play(700, 0.12, 'sawtooth', 0.045, -400); },
  skill()    { this.play(440, 0.18, 'triangle', 0.05, 260); },
  kill()     { this.play(320, 0.12, 'triangle', 0.04, -160); },
  warn()     { this.play(1100, 0.12, 'square', 0.03); },
  heal()     { this.play(520, 0.15, 'sine', 0.035, 180); },
  victory()  { [440, 554, 659, 880].forEach((f, i) => setTimeout(() => this.play(f, 0.22, 'triangle', 0.05), i * 120)); },
  defeat()   { [330, 262, 196, 131].forEach((f, i) => setTimeout(() => this.play(f, 0.28, 'sawtooth', 0.04), i * 160)); },
};
// AudioContext разблокируется первым касанием
document.addEventListener('pointerdown', function unlockAudio() {
  SFX.ensure();
  document.removeEventListener('pointerdown', unlockAudio);
});

// Полифилл для старых WebView
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

/* ================= TELEGRAM ================= */
const tg = window.Telegram && window.Telegram.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

/* ================= СОХРАНЕНИЕ ================= */
const SAVE_KEY = 'lotus_save_v1';

function defaultState() {
  return {
    qi: 0,
    ash: 0,
    deaths: 0,
    path: null, // 'righteous' | 'fallen'
    upgrades: { breath: 0, sword: 0, body: 0 },
    talismans: { seal: 0, ward: 0, feather: 0, tear: 0 },
    maxFloor: 1,
    rebirths: 0,
    dailyStreak: 0,
    lastDaily: '',
    achievements: {},
    sound: true,
    lastSeen: Date.now(),
    victories: 0,
  };
}

function mergeState(loaded) {
  const base = defaultState();
  const merged = Object.assign(base, loaded);
  // вложенные объекты — аккуратно, чтобы не потерять новые поля
  merged.upgrades = Object.assign(defaultState().upgrades, loaded && loaded.upgrades);
  merged.talismans = Object.assign(defaultState().talismans, loaded && loaded.talismans);
  return merged;
}

// Облако Telegram (синхронизация между устройствами) + localStorage как запасной слой
const Cloud = {
  available: !!(tg && tg.CloudStorage && tg.initData),
  load(cb) {
    if (!this.available) return cb(null);
    tg.CloudStorage.getItem(SAVE_KEY, (err, val) => {
      if (err || !val) return cb(null);
      try { cb(JSON.parse(val)); } catch (e) { cb(null); }
    });
  },
  save(json) {
    if (!this.available) return;
    tg.CloudStorage.setItem(SAVE_KEY, json, () => {});
  },
};

function loadLocal() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function saveState() {
  state.lastSeen = Date.now();
  const json = JSON.stringify(state);
  try { localStorage.setItem(SAVE_KEY, json); } catch (e) {}
  Cloud.save(json);
}

let state = defaultState();

// Оффлайн-культивация + ежедневный бонус (вызывается после загрузки сохранения)
function applyLoginRewards() {
  const awaySec = (Date.now() - (state.lastSeen || Date.now())) / 1000;
  const capped = Math.min(awaySec, 6 * 3600);
  const perMin = 5 + state.upgrades.breath * 2; // ци в минуту оффлайн
  const gained = Math.floor((capped / 60) * perMin * (1 + 0.10 * state.rebirths));
  if (gained > 0 && awaySec > 120) {
    state.qi += gained;
    setTimeout(() => toast(`Пока вы медитировали в реальном мире,\nкультивация принесла ${gained} ци ✨`), 300);
  }

  // Ежедневный бонус за серию входов
  const today = new Date().toDateString();
  if (state.lastDaily !== today) {
    const yesterday = new Date(Date.now() - 864e5).toDateString();
    state.dailyStreak = (state.lastDaily === yesterday) ? state.dailyStreak + 1 : 1;
    state.lastDaily = today;
    const bonusQi = Math.floor(30 * state.dailyStreak * (1 + 0.10 * state.rebirths));
    state.qi += bonusQi;
    setTimeout(() => toast(`День ${state.dailyStreak} культивации подряд.\nНебеса даруют ${bonusQi} ци ✨`), 700);
  }
  saveState();
}

/* ================= ЭКОНОМИКА ================= */
const ECON = {
  rebirthDmgMult: () => 1 + 0.15 * state.rebirths,
  rebirthQiMult: () => 1 + 0.10 * state.rebirths,
  tapQi: () => Math.max(1, Math.floor((1 + state.upgrades.breath) * (1 + 0.10 * state.rebirths))),
  breathCost: () => Math.floor(30 * Math.pow(1.4, state.upgrades.breath)),
  swordCost:  () => Math.floor(50 * Math.pow(1.5, state.upgrades.sword)),
  bodyCost:   () => Math.floor(40 * Math.pow(1.45, state.upgrades.body)),
  baseHP:  () => Math.floor((100 + state.upgrades.body * 25) * (1 + 0.10 * state.talismans.ward)),
  baseDMG: () => (10 + state.upgrades.sword * 4) * (1 + 0.08 * state.talismans.seal),
  baseAtkSpeed: () => 1 + 0.05 * state.talismans.feather,
  baseLifesteal: () => 0.01 * state.talismans.tear,
  legacyMult: () => 1 + Math.min(0.5, state.deaths * 0.05),
};

/* ================= ТАЛИСМАНЫ (крафт из пепла) ================= */
const TALISMANS = [
  { id: 'seal',    icon: '☯️', name: 'Печать Небес',     desc: '+8% к урону за уровень',        max: 5 },
  { id: 'ward',    icon: '🧿', name: 'Нефритовый Оберег', desc: '+10% к здоровью за уровень',     max: 5 },
  { id: 'feather', icon: '🪶', name: 'Перо Жар-птицы',    desc: '+5% к скорости атаки за уровень', max: 5 },
  { id: 'tear',    icon: '💧', name: 'Слеза Дракона',     desc: '+1% вампиризма за уровень',      max: 5 },
];

function talismanCost(lvl) { return 20 * Math.pow(2, lvl); }

/* ================= ДОСТИЖЕНИЯ ================= */
const ACHIEVEMENTS = [
  { id: 'path',     icon: '🪞', name: 'Пробуждение',       desc: 'Выберите свой путь' },
  { id: 'tengu',    icon: '👺', name: 'Сердце Леса',       desc: 'Победите Тенгу' },
  { id: 'vampire',  icon: '🧛', name: 'Суд над Предателем', desc: 'Победите Вампира' },
  { id: 'dragon',   icon: '🐉', name: 'Укротитель Бездны',  desc: 'Победите Дракона' },
  { id: 'archon',   icon: '⚜️', name: 'Падение Небес',      desc: 'Победите Архонта' },
  { id: 'reborn',   icon: '🌀', name: 'Новый Цикл',         desc: 'Совершите перерождение' },
  { id: 'rich',     icon: '💰', name: 'Хранитель Ци',       desc: 'Накопите 10 000 ци' },
  { id: 'deaths',   icon: '💀', name: 'Боль — Учитель',     desc: 'Падите 5 раз' },
  { id: 'talisman', icon: '☯️', name: 'Мастер Печатей',     desc: 'Поднимите талисман до 3 уровня' },
  { id: 'share',    icon: '📣', name: 'Глас Секты',         desc: 'Поделитесь карточкой' },
];

function unlockAchievement(id) {
  if (state.achievements[id]) return;
  state.achievements[id] = true;
  state.ash += 20;
  const a = ACHIEVEMENTS.find(x => x.id === id);
  toast(`${a.icon} Достижение: «${a.name}»\n+20 пепла 🔥`);
  saveState();
}

function renderAchievements() {
  const wrap = document.getElementById('achv-list');
  if (!wrap) return;
  wrap.innerHTML = '';
  ACHIEVEMENTS.forEach(a => {
    const got = !!state.achievements[a.id];
    const row = document.createElement('div');
    row.className = 'achv' + (got ? ' got' : '');
    row.innerHTML = `<span class="achv-icon">${got ? a.icon : '🔒'}</span>` +
      `<span class="achv-info"><b>${a.name}</b><i>${a.desc}</i></span>`;
    wrap.appendChild(row);
  });
}

/* ================= ПУТИ ================= */
const PATHS = {
  righteous: {
    subtitle: 'Путь Вознесения · Мечник Нирваны',
    skillQ: { icon: '🪷', name: 'Тысяча Лотосов' },
    skillW: { icon: '🛡️', name: 'Стойка Небес' },
    dmgColor: '#e8c15a',
    critColor: '#ffd700',
    aura: 'rgba(232,193,90,.35)',
    bgTop: '#0d1420', bgBottom: '#101a12',
    defeatLine: 'Но горечь ваша слишком велика для забвения.',
  },
  fallen: {
    subtitle: 'Путь Падения · Клинок Кровавой Луны',
    skillQ: { icon: '🩸', name: 'Когти Разрыва' },
    skillW: { icon: '💉', name: 'Кровавый Пакт' },
    dmgColor: '#e05656',
    critColor: '#ff2020',
    aura: 'rgba(224,86,86,.45)',
    bgTop: '#180a10', bgBottom: '#1e0d0d',
    defeatLine: 'Бездна возвращает тебя. Голод только растёт.',
  },
};

function currentPath() { return PATHS[state.path] || PATHS.righteous; }

function applyTheme() {
  document.body.dataset.path = state.path || '';
  document.getElementById('hub-subtitle').textContent = state.path
    ? currentPath().subtitle
    : 'Юный культиватор клана Цинхэ';
}

function choosePath(p) {
  state.path = p;
  saveState();
  applyTheme();
  refreshHub();
  unlockAchievement('path');
  showShareCard();
}

document.getElementById('choose-righteous').onclick = () => choosePath('righteous');
document.getElementById('choose-fallen').onclick = () => choosePath('fallen');

/* ================= ВИРАЛЬНАЯ КАРТОЧКА ================= */
const GAME_LINK = 'https://t.me/padshiy_lotos_bot/game'; // заменить после деплоя бота

function shareStatsLine() {
  return `Побед: ${state.victories} · Перерождений: ${state.rebirths} · Наследие: +${Math.round((ECON.legacyMult() - 1) * 100)}%`;
}

function shareText() {
  if (state.path === 'fallen') {
    return `🩸 Я предал небеса в «Падшем Лотосе».\n${shareStatsLine()}\nА ты слишком слаб, чтобы пасть?`;
  }
  return `🪷 Я сохранил чистоту духа в «Падшем Лотосе».\n${shareStatsLine()}\nПрисоединяйся к моей секте!`;
}

function showShareCard() {
  const card = document.getElementById('share-card');
  const fallen = state.path === 'fallen';
  card.classList.toggle('fallen', fallen);
  document.getElementById('share-icon').textContent = state.path ? (fallen ? '🩸' : '🪷') : '🪞';
  document.getElementById('share-title').textContent = state.path
    ? (fallen ? 'Я выбрал Падение' : 'Я выбрал Вознесение')
    : 'Зеркало ждёт моего выбора';
  document.getElementById('share-stats').textContent = shareStatsLine();
  showScreen('hub');
  document.getElementById('share-overlay').classList.remove('hidden');
}

document.getElementById('btn-share').onclick = showShareCard;
document.getElementById('btn-share-close').onclick = () => {
  document.getElementById('share-overlay').classList.add('hidden');
};
document.getElementById('btn-share-tg').onclick = () => {
  const url = 'https://t.me/share/url?url=' + encodeURIComponent(GAME_LINK) +
              '&text=' + encodeURIComponent(shareText());
  unlockAchievement('share');
  if (tg && tg.openLink) tg.openLink(url);
  else window.open(url, '_blank');
  if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
};

/* ================= UI: ЭКРАНЫ ================= */
const screens = {
  hub: document.getElementById('screen-hub'),
  meditate: document.getElementById('screen-meditate'),
  battle: document.getElementById('screen-battle'),
  choice: document.getElementById('screen-choice'),
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

function fmt(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(Math.floor(n)); }

function refreshHub() {
  document.getElementById('hub-qi').textContent = fmt(state.qi);
  document.getElementById('hub-ash').textContent = fmt(state.ash);
  document.getElementById('hub-dmg').textContent = Math.floor(ECON.baseDMG() * ECON.legacyMult() * ECON.rebirthDmgMult());
  document.getElementById('hub-hp').textContent = ECON.baseHP();
  document.getElementById('hub-legacy').textContent = '+' + Math.round((ECON.legacyMult() - 1) * 100) + '%';
  document.getElementById('hub-rebirths').textContent = state.rebirths;

  const snd = document.getElementById('hub-sound');
  snd.textContent = state.sound ? 'Вкл' : 'Выкл';
  snd.onclick = () => {
    state.sound = !state.sound;
    snd.textContent = state.sound ? 'Вкл' : 'Выкл';
    saveState();
    if (state.sound) SFX.heal();
  };

  document.getElementById('lvl-breath').textContent = state.upgrades.breath;
  document.getElementById('lvl-sword').textContent = state.upgrades.sword;
  document.getElementById('lvl-body').textContent = state.upgrades.body;

  const bc = ECON.breathCost(), sc = ECON.swordCost(), dc = ECON.bodyCost();
  const btnB = document.getElementById('buy-breath');
  const btnS = document.getElementById('buy-sword');
  const btnD = document.getElementById('buy-body');
  btnB.textContent = fmt(bc); btnB.disabled = state.qi < bc;
  btnS.textContent = fmt(sc); btnS.disabled = state.qi < sc;
  btnD.textContent = fmt(dc); btnD.disabled = state.qi < dc;

  renderTalismans();
  renderFloorButtons();
  renderAchievements();

  // мягкие проверки достижений по состоянию
  if (state.qi >= 10000) unlockAchievement('rich');
  if (Object.values(state.talismans).some(l => l >= 3)) unlockAchievement('talisman');
}

function buyUpgrade(kind) {
  const costFn = { breath: ECON.breathCost, sword: ECON.swordCost, body: ECON.bodyCost }[kind];
  const cost = costFn();
  if (state.qi < cost) return;
  state.qi -= cost;
  state.upgrades[kind]++;
  saveState();
  refreshHub();
}

function renderTalismans() {
  const wrap = document.getElementById('talisman-list');
  wrap.innerHTML = '';
  TALISMANS.forEach(t => {
    const lvl = state.talismans[t.id];
    const maxed = lvl >= t.max;
    const cost = talismanCost(lvl);
    const row = document.createElement('div');
    row.className = 'upgrade';
    row.innerHTML =
      `<div class="upgrade-info">` +
      `<div class="upgrade-name">${t.icon} ${t.name} <span class="lvl">${lvl}/${t.max}</span></div>` +
      `<div class="upgrade-desc">${t.desc}</div></div>`;
    const btn = document.createElement('button');
    btn.className = 'btn btn-small';
    btn.textContent = maxed ? 'МАКС' : '🔥' + cost;
    btn.disabled = maxed || state.ash < cost;
    btn.onclick = () => {
      if (state.ash < cost || maxed) return;
      state.ash -= cost;
      state.talismans[t.id]++;
      saveState();
      refreshHub();
    };
    row.appendChild(btn);
    wrap.appendChild(row);
  });
}

function renderFloorButtons() {
  const wrap = document.getElementById('floor-buttons');
  wrap.innerHTML = '';
  FLOORS.forEach((f, i) => {
    const unlocked = i + 1 <= state.maxFloor;
    const btn = document.createElement('button');
    btn.className = 'btn floor-btn ' + (unlocked ? 'btn-red' : 'locked');
    btn.innerHTML = unlocked
      ? `⚔️ Этаж ${i + 1} — ${f.name}<span class="floor-sub">${f.sub}</span>`
      : `🔒 Этаж ${i + 1} — ${f.name}<span class="floor-sub">Пройдите предыдущий этаж</span>`;
    if (unlocked) btn.onclick = () => startRun(i);
    wrap.appendChild(btn);
  });
}

document.getElementById('buy-breath').onclick = () => buyUpgrade('breath');
document.getElementById('buy-sword').onclick = () => buyUpgrade('sword');
document.getElementById('buy-body').onclick = () => buyUpgrade('body');

document.getElementById('btn-meditate').onclick = () => {
  document.getElementById('med-qi').textContent = fmt(state.qi);
  document.getElementById('med-per-tap').textContent = ECON.tapQi();
  showScreen('meditate');
};
document.getElementById('back-meditate').onclick = () => { refreshHub(); showScreen('hub'); };

/* ================= МЕДИТАЦИЯ (КЛИКЕР) ================= */
const lotus = document.getElementById('lotus-canvas');
const lotusArea = document.getElementById('lotus-area');
const lotusCtx = lotus.getContext('2d');

function resizeLotus() {
  const s = lotus.clientWidth || 260;
  lotus.width = s * devicePixelRatio;
  lotus.height = s * devicePixelRatio;
  lotusCtx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
resizeLotus();
window.addEventListener('resize', resizeLotus);

(function lotusLoop(t) {
  if (screens.meditate.classList.contains('active')) {
    const s = lotus.clientWidth;
    lotusCtx.clearRect(0, 0, s, s);
    drawLotus(lotusCtx, s / 2, s / 2, s * 0.34, t / 1000);
  }
  requestAnimationFrame(lotusLoop);
})(0);

function onTap(e) {
  const gain = ECON.tapQi();
  state.qi += gain;
  document.getElementById('med-qi').textContent = fmt(state.qi);

  lotus.classList.add('pressed');
  setTimeout(() => lotus.classList.remove('pressed'), 70);

  const rect = lotusArea.getBoundingClientRect();
  const x = (e.clientX || (e.touches && e.touches[0].clientX) || rect.width / 2) - rect.left;
  const y = (e.clientY || (e.touches && e.touches[0].clientY) || rect.height / 2) - rect.top;
  const f = document.createElement('div');
  f.className = 'float-qi';
  f.textContent = '+' + gain;
  f.style.left = (x - 10 + (Math.random() * 30 - 15)) + 'px';
  f.style.top = (y - 20) + 'px';
  lotusArea.appendChild(f);
  setTimeout(() => f.remove(), 800);

  if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
  SFX.tap();
}

lotusArea.addEventListener('pointerdown', onTap);
setInterval(saveState, 5000);

/* ================= РОГАЛИК-УСИЛЕНИЯ ================= */
const RUN_UPGRADES = [
  { id: 'sharp',   name: '⚔️ Острый Лотос',      desc: '+25% к урону меча', apply: r => { r.dmgMult *= 1.25; } },
  { id: 'jade',    name: '💎 Нефритовая Кожа',   desc: '+30% к макс. здоровью и исцеление на 30%', apply: r => { r.hpMult *= 1.3; r.heal(r.maxHP() * 0.3); } },
  { id: 'wind',    name: '🍃 Ветер в Лепестках', desc: '+20% к скорости атаки', apply: r => { r.atkSpeedMult *= 1.2; } },
  { id: 'drink',   name: '🌸 Лотос Питается',    desc: '8% нанесённого урона возвращается здоровьем', apply: r => { r.lifesteal += 0.08; } },
  { id: 'wrath',   name: '⛈️ Гнев Небес',         desc: 'Каждое 5-е убийство: вспышка 60 урона всем врагам', apply: r => { r.wrath = true; } },
  { id: 'thunder', name: '🌩️ Громовая Кара',      desc: '+60% к урону «Тысячи Лотосов»', apply: r => { r.skillQMult *= 1.6; } },
  { id: 'fate',    name: '🗡️ Клинок Судьбы',      desc: '+15% шанс критического удара (x2)', apply: r => { r.critChance += 0.15; } },
];

/* ================= БОЙ ================= */
const canvas = document.getElementById('battle-canvas');
const ctx = canvas.getContext('2d');

const ENEMY_TYPES = {
  // Этаж 1 — Лес Духов
  spirit:  { emoji: '👻', hp: 30,   dmg: 4,  atkCd: 1.5, speed: 55, radius: 22, qi: 6,   ash: 0 },
  elite:   { emoji: '👹', hp: 110,  dmg: 8,  atkCd: 1.8, speed: 45, radius: 28, qi: 15,  ash: 1 },
  boss:    { emoji: '👺', hp: 500,  dmg: 14, atkCd: 2.2, speed: 35, radius: 40, qi: 60,  ash: 5, isBoss: true },
  // Этаж 2 — Руины Цинхэ
  skeleton:{ emoji: '💀', hp: 75,   dmg: 8,  atkCd: 1.4, speed: 62, radius: 22, qi: 12,  ash: 1 },
  zombie:  { emoji: '🧟', hp: 260,  dmg: 14, atkCd: 2.0, speed: 40, radius: 30, qi: 30,  ash: 2 },
  vampire: { emoji: '🧛', hp: 1150, dmg: 22, atkCd: 2.0, speed: 48, radius: 40, qi: 130, ash: 10, isBoss: true },
  // Этаж 3 — Пещеры Бездны
  imp:     { emoji: '👿', hp: 150,  dmg: 13, atkCd: 1.3, speed: 68, radius: 22, qi: 20,  ash: 1 },
  demon:   { emoji: '😈', hp: 480,  dmg: 22, atkCd: 1.8, speed: 48, radius: 30, qi: 55,  ash: 3 },
  // Этаж 4 — Небесная Тюрьма
  guard:   { emoji: '🗿', hp: 320,  dmg: 20, atkCd: 1.5, speed: 52, radius: 26, qi: 40,  ash: 2 },
  seraph:  { emoji: '👁️', hp: 950,  dmg: 30, atkCd: 1.7, speed: 46, radius: 32, qi: 110, ash: 4 },
  archon:  { emoji: '⚜️', hp: 5200, dmg: 45, atkCd: 2.0, speed: 40, radius: 48, qi: 650, ash: 40, isBoss: true },
};

const FLOORS = [
  {
    name: 'Лес Духов', sub: 'Первое испытание',
    rooms: [
      { name: 'Комната 1 — Шёпот Леса',  spawns: ['spirit', 'spirit', 'spirit'] },
      { name: 'Комната 2 — Корни Зла',   spawns: ['spirit', 'spirit', 'elite', 'spirit'] },
      { name: 'Комната 3 — Сердце Леса', spawns: ['boss', 'spirit', 'spirit'] },
    ],
  },
  {
    name: 'Руины Цинхэ', sub: 'Тени павшей секты',
    rooms: [
      { name: 'Комната 1 — Разбитые Врата',   spawns: ['skeleton', 'skeleton', 'skeleton', 'skeleton'] },
      { name: 'Комната 2 — Зал Размышлений',  spawns: ['skeleton', 'skeleton', 'zombie', 'skeleton'] },
      { name: 'Комната 3 — Трон Предателя',   spawns: ['vampire', 'skeleton', 'skeleton'] },
    ],
  },
  {
    name: 'Пещеры Бездны', sub: 'Здесь шепчет тьма',
    rooms: [
      { name: 'Комната 1 — Спуск во Мглу',  spawns: ['imp', 'imp', 'imp', 'imp'] },
      { name: 'Комната 2 — Купол Страданий', spawns: ['imp', 'imp', 'demon', 'imp'] },
      { name: 'Комната 3 — Сердце Бездны',  spawns: ['dragon', 'imp', 'imp'] },
    ],
  },
  {
    name: 'Небесная Тюрьма', sub: 'Суд над падшими',
    rooms: [
      { name: 'Комната 1 — Цепи Света',      spawns: ['guard', 'guard', 'guard'] },
      { name: 'Комната 2 — Хор Безгласных',  spawns: ['guard', 'seraph', 'guard'] },
      { name: 'Комната 3 — Престол Архонта', spawns: ['archon', 'guard', 'guard'] },
    ],
  },
];

/* ================= ИИ БОССОВ (фазы) ================= */
function summonAdds(b, type, n) {
  for (let i = 0; i < n; i++) {
    const t = ENEMY_TYPES[type];
    const e = {
      type,
      emoji: t.emoji,
      hp: t.hp, maxHP: t.hp,
      dmg: t.dmg, atkCd: t.atkCd, atkTimer: 1 + i * 0.5,
      speed: t.speed, radius: t.radius, qi: t.qi, ash: t.ash,
      x: canvas.clientWidth + 40,
      y: canvas.clientHeight / 2 + (i - (n - 1) / 2) * 90,
      hitFlash: 0,
    };
    b.enemies.push(e);
    addParticles(e.x - 30, e.y, '#a040ff', 10);
  }
}

function announce(e, text) {
  addDmgNumber(e.x, e.y - e.radius - 34, text, '#ff8040');
}

const BOSS_AI = {
  // Тенгу: зовёт духов, ярость, телеграфированный удар (блокируется Стойкой)
  boss(e, dt, b) {
    if (!e.phase) { e.phase = 1; e.specialTimer = 7; }
    if (e.phase === 1 && e.hp < e.maxHP * 0.6) {
      e.phase = 2;
      summonAdds(b, 'spirit', 2);
      announce(e, 'Тенгу зовёт духов леса!');
    }
    if (e.phase === 2 && e.hp < e.maxHP * 0.3) {
      e.phase = 3;
      e.atkCd *= 0.7;
      e.speed *= 1.4;
      announce(e, 'Тенгу впадает в ярость!');
    }
    e.specialTimer -= dt;
    if (e.specialTimer <= 0) {
      e.specialTimer = 7;
      b.telegraphs.push({ t: 1.5, dmg: 20, label: '⚠️ ВЗМАХ ТЕНГУ' });
      SFX.warn();
    }
  },

  // Вампир: питьё крови (DPS-гонка), в финале — стая скелетов
  vampire(e, dt, b) {
    if (!e.phase) { e.phase = 1; e.specialTimer = 5; }
    if (e.phase === 1 && e.hp < e.maxHP * 0.7) {
      e.phase = 2;
      announce(e, 'Вампир жаждет вашей крови!');
    }
    if (e.phase === 2 && e.hp < e.maxHP * 0.35) {
      e.phase = 3;
      e.dmg = Math.floor(e.dmg * 1.3);
      summonAdds(b, 'skeleton', 2);
      announce(e, 'Предатель зовёт мёртвых Цинхэ!');
    }
    if (e.phase >= 2) {
      e.specialTimer -= dt;
      if (e.specialTimer <= 0) {
        e.specialTimer = 5;
        const nowSec = performance.now() / 1000;
        if (nowSec >= b.player.invulnUntil) {
          b.run.hp -= 8;
          e.hp = Math.min(e.maxHP, e.hp + 25);
          addDmgNumber(b.player.x, b.player.y - 40, '-8 🩸', '#ff6060');
          addDmgNumber(e.x, e.y - e.radius - 10, '+25', '#60ff80');
          updateHpBar();
        }
      }
    }
  },

  // Дракон: огненное дыхание (телеграф), берсерк в финале
  dragon(e, dt, b) {
    if (!e.phase) { e.phase = 1; e.specialTimer = 4.5; }
    if (e.phase === 1 && e.hp < e.maxHP * 0.7) {
      e.phase = 2;
      announce(e, 'Дракон раз за разом вдыхает Бездну!');
    }
    if (e.phase === 2 && e.hp < e.maxHP * 0.4) {
      e.phase = 3;
      e.atkCd *= 0.7;
      e.speed *= 1.4;
      summonAdds(b, 'imp', 2);
      announce(e, 'Сердце Бездны бьётся в бешенстве!');
    }
    if (e.phase >= 2) {
      e.specialTimer -= dt;
      if (e.specialTimer <= 0) {
        e.specialTimer = 4.5;
        b.telegraphs.push({ t: 1.2, dmg: 16, label: '⚠️ ДЫХАНИЕ ДРАКОНА' });
        SFX.warn();
      }
    }
  },
  // Архонт: Суд Небес (телеграф), в финале — стражи и ускорение
  archon(e, dt, b) {
    if (!e.phase) { e.phase = 1; e.specialTimer = 5; }
    if (e.phase === 1 && e.hp < e.maxHP * 0.65) {
      e.phase = 2;
      announce(e, 'Архонт возносит меч Суда!');
    }
    if (e.phase === 2 && e.hp < e.maxHP * 0.3) {
      e.phase = 3;
      e.atkCd *= 0.7;
      e.speed *= 1.3;
      summonAdds(b, 'guard', 2);
      announce(e, 'Небеса не признают поражения!');
    }
    if (e.phase >= 2) {
      e.specialTimer -= dt;
      if (e.specialTimer <= 0) {
        e.specialTimer = 5;
        b.telegraphs.push({ t: 1.3, dmg: 25, label: '⚠️ СУД НЕБЕС' });
        SFX.warn();
      }
    }
  },
};

let battle = null;

function resizeCanvas() {
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
window.addEventListener('resize', resizeCanvas);

function startRun(floorIndex) {
  showScreen('battle');
  resizeCanvas();
  battle = {
    floorIndex: floorIndex || 0,
    floor: FLOORS[floorIndex || 0],
    roomIndex: 0,
    enemies: [],
    particles: [],
    dmgNumbers: [],
    telegraphs: [],
    player: {
      x: 90,
      y: canvas.clientHeight / 2,
      radius: 24,
      atkTimer: 0,
      invulnUntil: 0,
    },
    run: null,
    phase: 'fight', // fight | upgrade | over
    lastTime: performance.now(),
    cdQ: 0, cdW: 0,
    runQi: 0,
    runAsh: 0,
    kills: 0,
  };

  const fallen = state.path === 'fallen';
  const r = {
    dmgMult: 1,
    hpMult: 1,
    atkSpeedMult: ECON.baseAtkSpeed(),
    lifesteal: ECON.baseLifesteal() + (fallen ? 0.05 : 0),
    wrath: false,
    skillQMult: 1,
    critChance: 0.05,
    madness: 0, // стаки безумия (демонический путь)
    bloodPactUntil: 0,
    hp: 0,
    maxHP() { return Math.floor(ECON.baseHP() * this.hpMult); },
    dmg() {
      let d = ECON.baseDMG() * ECON.legacyMult() * ECON.rebirthDmgMult() * this.dmgMult;
      if (performance.now() / 1000 < this.bloodPactUntil) d *= 2;
      return d;
    },
    heal(v) { this.hp = Math.min(this.maxHP(), this.hp + v); },
  };
  battle.run = r;
  r.hp = r.maxHP();

  const path = currentPath();
  document.querySelector('#skill-q .skill-icon').textContent = path.skillQ.icon;
  document.querySelector('#skill-q .skill-name').textContent = path.skillQ.name;
  document.querySelector('#skill-w .skill-icon').textContent = path.skillW.icon;
  document.querySelector('#skill-w .skill-name').textContent = path.skillW.name;

  spawnRoom(0);
  if (/^#(battle|fallen)/.test(location.hash)) battle.enemies.forEach((e, i) => { e.x = 210 + i * 70; }); // отладка
  updateHpBar();
  requestAnimationFrame(battleLoop);
}

function spawnRoom(idx) {
  const cfg = battle.floor.rooms[idx];
  document.getElementById('battle-room-name').textContent = cfg.name;
  battle.enemies = cfg.spawns.map((type, i) => {
    const t = ENEMY_TYPES[type];
    return {
      type,
      emoji: t.emoji,
      hp: t.hp, maxHP: t.hp,
      dmg: t.dmg, atkCd: t.atkCd, atkTimer: 1 + i * 0.4,
      speed: t.speed,
      radius: t.radius,
      qi: t.qi, ash: t.ash,
      x: canvas.clientWidth + 60 + i * 90,
      y: canvas.clientHeight / 2 + (i - (cfg.spawns.length - 1) / 2) * 70,
      hitFlash: 0,
    };
  });
}

function updateHpBar() {
  const r = battle.run;
  document.getElementById('player-hp-bar').style.width = Math.max(0, (r.hp / r.maxHP()) * 100) + '%';
}

function addDmgNumber(x, y, text, color) {
  battle.dmgNumbers.push({ x, y, text, color, life: 0.9 });
}

function addParticles(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    battle.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 160,
      vy: (Math.random() - 0.5) * 160,
      life: 0.5 + Math.random() * 0.3,
      color,
    });
  }
}

function dealDamage(enemy, amount, isCrit) {
  const path = currentPath();
  enemy.hp -= amount;
  enemy.hitFlash = 0.12;
  addDmgNumber(enemy.x, enemy.y - enemy.radius - 6, Math.floor(amount), isCrit ? path.critColor : '#fff');
  addParticles(enemy.x, enemy.y, isCrit ? path.critColor : path.dmgColor, isCrit ? 10 : 5);
  if (isCrit) SFX.crit(); else SFX.hit();
  const r = battle.run;
  if (r.lifesteal > 0) { r.heal(amount * r.lifesteal); updateHpBar(); }
}

function killEnemy(enemy) {
  const r = battle.run;
  battle.kills++;
  battle.runQi += enemy.qi;
  battle.runAsh += enemy.ash;
  addParticles(enemy.x, enemy.y, '#fff', 14);
  addDmgNumber(enemy.x, enemy.y, '+' + enemy.qi + ' ✨', currentPath().dmgColor);
  SFX.kill();
  // Безумие (демонический путь): +2% урона за убийство, макс +100%
  if (state.path === 'fallen' && r.madness < 50) {
    r.madness++;
    r.dmgMult *= 1.02;
  }
  if (r.wrath && battle.kills % 5 === 0) {
    addDmgNumber(enemy.x, enemy.y - 40, '⛈️ ГНЕВ НЕБЕС', '#9b59b6');
    battle.enemies.forEach(e => { if (e !== enemy && e.hp > 0) dealDamage(e, 60, false); });
  }
}

/* ---- Навыки ---- */
function useSkillQ() {
  if (!battle || battle.phase !== 'fight' || battle.cdQ > 0) return;
  const r = battle.run;
  const path = currentPath();
  if (state.path === 'fallen') {
    // Когти Разрыва: меньше мгновенного урона, но кровотечение 3 сек
    battle.cdQ = 7;
    const dmg = (40 + r.dmg() * 0.8) * r.skillQMult;
    const bleedDps = r.dmg() * 0.3;
    addDmgNumber(battle.player.x + 60, battle.player.y - 60, '🩸 КОГТИ РАЗРЫВА', '#e05656');
    battle.enemies.forEach(e => {
      if (e.hp <= 0) return;
      dealDamage(e, dmg, false);
      e.bleedDps = bleedDps;
      e.bleedT = 3;
      e.bleedTick = 0;
    });
  } else {
    battle.cdQ = 8;
    const dmg = (60 + r.dmg()) * r.skillQMult;
    addDmgNumber(battle.player.x + 60, battle.player.y - 60, '🪷 ТЫСЯЧА ЛОТОСОВ', path.dmgColor);
    battle.enemies.forEach(e => { if (e.hp > 0) dealDamage(e, dmg, false); });
  }
  if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
  SFX.skill();
}

function useSkillW() {
  if (!battle || battle.phase !== 'fight' || battle.cdW > 0) return;
  const r = battle.run;
  if (state.path === 'fallen') {
    // Кровавый Пакт: -25% текущего HP, урон x2 на 10 сек
    battle.cdW = 18;
    const sacrifice = Math.floor(r.hp * 0.25);
    r.hp = Math.max(1, r.hp - sacrifice);
    r.bloodPactUntil = performance.now() / 1000 + 10;
    addDmgNumber(battle.player.x, battle.player.y - 50, '💉 КРОВАВЫЙ ПАКТ: -' + sacrifice, '#e05656');
    updateHpBar();
  } else {
    battle.cdW = 15;
    battle.player.invulnUntil = performance.now() / 1000 + 3;
    addDmgNumber(battle.player.x, battle.player.y - 50, '🛡️ СТОЙКА НЕБЕС', '#7ec8ff');
  }
  if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
}

document.getElementById('skill-q').addEventListener('pointerdown', useSkillQ);
document.getElementById('skill-w').addEventListener('pointerdown', useSkillW);
document.addEventListener('keydown', e => {
  if (e.key === 'q' || e.key === 'Q' || e.key === '1') useSkillQ();
  if (e.key === 'w' || e.key === 'W' || e.key === '2') useSkillW();
});

/* ---- Цикл боя ---- */
function battleLoop(now) {
  if (!battle || battle.phase === 'over') return;
  const dt = Math.min(0.05, (now - battle.lastTime) / 1000);
  battle.lastTime = now;

  if (battle.phase === 'fight') updateBattle(dt);
  renderBattle();

  requestAnimationFrame(battleLoop);
}

function updateBattle(dt) {
  const b = battle, r = b.run, p = b.player;
  const nowSec = performance.now() / 1000;

  // Кулдауны
  b.cdQ = Math.max(0, b.cdQ - dt);
  b.cdW = Math.max(0, b.cdW - dt);
  document.getElementById('cd-q').textContent = b.cdQ > 0 ? Math.ceil(b.cdQ) : '';
  document.getElementById('cd-w').textContent = b.cdW > 0 ? Math.ceil(b.cdW) : '';
  document.getElementById('skill-q').classList.toggle('on-cd', b.cdQ > 0);
  document.getElementById('skill-w').classList.toggle('on-cd', b.cdW > 0);

  // Атака игрока (автобой)
  p.atkTimer -= dt;
  const alive = b.enemies.filter(e => e.hp > 0);
  if (p.atkTimer <= 0 && alive.length > 0) {
    p.atkTimer = 1 / r.atkSpeedMult;
    const target = alive.reduce((a, e2) => (e2.x < a.x ? e2 : a), alive[0]);
    const isCrit = Math.random() < r.critChance;
    dealDamage(target, r.dmg() * (isCrit ? 2 : 1), isCrit);
  }

  // Враги
  alive.forEach(e => {
    // Кровотечение (демонический путь)
    if (e.bleedT > 0) {
      e.bleedT -= dt;
      e.bleedTick -= dt;
      if (e.bleedTick <= 0) {
        e.bleedTick = 0.5;
        e.hp -= e.bleedDps * 0.5;
        addParticles(e.x, e.y, '#c0392b', 2);
      }
    }
    const dx = p.x - e.x;
    const dist = Math.abs(dx);
    const reach = e.radius + p.radius + 8;
    if (dist > reach) {
      e.x += Math.sign(dx) * e.speed * dt;
    } else {
      e.atkTimer -= dt;
      if (e.atkTimer <= 0) {
        e.atkTimer = e.atkCd;
        if (nowSec >= p.invulnUntil) {
          r.hp -= e.dmg;
          addDmgNumber(p.x, p.y - p.radius - 8, '-' + e.dmg, '#ff6b6b');
          addParticles(p.x, p.y, '#ff6b6b', 6);
          updateHpBar();
          if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
        } else {
          addDmgNumber(p.x, p.y - p.radius - 8, 'БЛОК', '#7ec8ff');
        }
      }
    }
    // ИИ боссов
    if (ENEMY_TYPES[e.type].isBoss && BOSS_AI[e.type]) BOSS_AI[e.type](e, dt, b);

    e.hitFlash = Math.max(0, e.hitFlash - dt);
  });

  // Телеграфированные удары боссов
  b.telegraphs.forEach(t => {
    t.t -= dt;
    if (t.t <= 0) {
      if (nowSec >= p.invulnUntil) {
        r.hp -= t.dmg;
        addDmgNumber(p.x, p.y - p.radius - 8, '-' + t.dmg, '#ff6b6b');
        addParticles(p.x, p.y, '#ff6b6b', 10);
        updateHpBar();
        if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
      } else {
        addDmgNumber(p.x, p.y - p.radius - 8, 'БЛОК', '#7ec8ff');
      }
    }
  });
  b.telegraphs = b.telegraphs.filter(t => t.t > 0);

  // Смерти врагов
  b.enemies.filter(e => e.hp <= 0).forEach(killEnemy);
  b.enemies = b.enemies.filter(e => e.hp > 0);

  // Частицы и цифры
  b.particles.forEach(pt => { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt; });
  b.particles = b.particles.filter(pt => pt.life > 0);
  b.dmgNumbers.forEach(d => { d.y -= 40 * dt; d.life -= dt; });
  b.dmgNumbers = b.dmgNumbers.filter(d => d.life > 0);

  // Смерть игрока
  if (r.hp <= 0) { endRun(false); return; }

  // Комната зачищена
  if (b.enemies.length === 0) {
    if (b.roomIndex >= b.floor.rooms.length - 1) {
      endRun(true);
    } else {
      // Аура праведного: исцеление 10% при зачистке комнаты
      if (state.path !== 'fallen') {
        r.heal(r.maxHP() * 0.1);
        updateHpBar();
      }
      b.phase = 'upgrade';
      showUpgradeChoice();
    }
  }
}

/* ---- Отрисовка ---- */
function renderBattle() {
  const b = battle, p = b.player, r = b.run;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  // Фон
  const path = currentPath();
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, path.bgTop);
  grad.addColorStop(1, path.bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Декорации: бамбук
  drawBamboo(ctx, 40, h - 20, 180, 0.3);
  drawBamboo(ctx, w - 45, h - 10, 220, 0.25);
  drawBamboo(ctx, w * 0.55, 90, 130, 0.2);
  drawBamboo(ctx, w * 0.75, 130, 100, 0.18);

  const nowSec = performance.now() / 1000;

  // Аура пути вокруг игрока
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.radius + 8 + Math.sin(nowSec * 3) * 3, 0, Math.PI * 2);
  ctx.strokeStyle = currentPath().aura;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Игрок
  const invuln = nowSec < p.invulnUntil;
  if (invuln) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 12, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(126,200,255,.8)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  // Кровавый Пакт активен — багровое свечение
  if (nowSec < r.bloodPactUntil) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 16, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(224,32,32,.8)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  drawPlayer(ctx, p.x, p.y, p.radius, { path: currentPath(), fallen: state.path === 'fallen' });

  // Враги
  b.enemies.forEach(e => {
    // Аура фазы у босса
    if (ENEMY_TYPES[e.type].isBoss && e.phase >= 2) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius + 6 + Math.sin(nowSec * 5) * 3, 0, Math.PI * 2);
      ctx.strokeStyle = e.phase >= 3 ? 'rgba(255,40,40,.8)' : 'rgba(255,128,64,.6)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    drawEnemy(ctx, e.type, e.x, e.y, e.radius, e.hitFlash);
    // полоска HP
    const bw = e.radius * 2;
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(e.x - bw / 2, e.y - e.radius - 14, bw, 5);
    const isBoss = e.type === 'boss' || e.type === 'vampire' || e.type === 'dragon';
    ctx.fillStyle = isBoss ? '#c0392b' : '#8e44ad';
    ctx.fillRect(e.x - bw / 2, e.y - e.radius - 14, bw * Math.max(0, e.hp / e.maxHP), 5);
  });

  // Частицы
  b.particles.forEach(pt => {
    ctx.globalAlpha = Math.min(1, pt.life * 2);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Числа урона
  b.dmgNumbers.forEach(d => {
    ctx.globalAlpha = Math.min(1, d.life * 2);
    ctx.fillStyle = d.color;
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(d.text, d.x, d.y);
  });
  ctx.globalAlpha = 1;

  // Предупреждения о телеграфированных ударах
  b.telegraphs.forEach(t => {
    const blink = Math.sin(nowSec * 12) > 0 ? 1 : 0.5;
    ctx.globalAlpha = blink;
    ctx.fillStyle = '#ff5040';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${t.label} — ${t.t.toFixed(1)}с`, w / 2, 110);
    ctx.globalAlpha = 1;
  });

  // Счётчик добычи забега
  ctx.fillStyle = 'rgba(232,193,90,.9)';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`✨ ${b.runQi}   🔥 ${b.runAsh}`, 12, h - 90);
}

/* ---- Выбор усиления ---- */
function showUpgradeChoice() {
  const overlay = document.getElementById('upgrade-overlay');
  const wrap = document.getElementById('upgrade-cards');
  wrap.innerHTML = '';

  const pool = [...RUN_UPGRADES].sort(() => Math.random() - 0.5).slice(0, 3);
  pool.forEach(upg => {
    const card = document.createElement('button');
    card.className = 'upgrade-card';
    card.innerHTML = `<div class="uc-name">${upg.name}</div><div class="uc-desc">${upg.desc}</div>`;
    card.onclick = () => {
      upg.apply(battle.run);
      updateHpBar();
      overlay.classList.add('hidden');
      battle.roomIndex++;
      spawnRoom(battle.roomIndex);
      battle.phase = 'fight';
      battle.lastTime = performance.now();
    };
    wrap.appendChild(card);
  });
  overlay.classList.remove('hidden');
}

/* ---- Конец забега ---- */
function endRun(victory) {
  battle.phase = 'over';
  const b = battle;
  const path = currentPath();
  battle.showChoiceAfter = !state.path; // первый забег → выбор пути

  const overlay = document.getElementById('result-overlay');
  const title = document.getElementById('result-title');
  const text = document.getElementById('result-text');

  const btnOk = document.getElementById('btn-result-ok');
  const btnAlt = document.getElementById('btn-result-alt');
  btnAlt.style.display = 'none';
  btnOk.textContent = 'Вернуться на базу';
  battle.rebirthOffer = false;

  if (victory) {
    const floorNum = b.floorIndex + 1;
    const offerRebirth = b.floorIndex >= 2; // с победы над драконом и дальше
    SFX.victory();
    const qiBonus = 100 * floorNum;
    const ashBonus = 10 * floorNum;
    const runQi = Math.floor(b.runQi * ECON.rebirthQiMult());
    state.victories++;
    state.qi += runQi + qiBonus;
    state.ash += b.runAsh + ashBonus;
    const unlockedNew = floorNum === state.maxFloor && floorNum < FLOORS.length;
    if (unlockedNew) state.maxFloor++;
    const bossAchv = ['tengu', 'vampire', 'dragon', 'archon'][b.floorIndex];
    if (bossAchv) unlockAchievement(bossAchv);

    if (offerRebirth) {
      battle.rebirthOffer = true;
      btnOk.textContent = '🌀 Переродиться';
      btnAlt.style.display = '';
      title.textContent = '🏆 Цикл завершён!';
      text.textContent =
        `${b.floor.name} очищен. Зеркало Нирваны\nпредлагает раствориться в Дао и начать заново.\n\n` +
        `Перерождение: прогресс сгорит, но\n` +
        `• +15% к урону навсегда (сейчас +${Math.round((ECON.rebirthDmgMult() - 1) * 100)}%)\n` +
        `• +10% к добыче ци навсегда\n` +
        `• можно выбрать другой путь\n\n` +
        `Или останьтесь — фармите этажи дальше.`;
    } else {
      title.textContent = '🏆 Этаж пройден!';
      text.textContent =
        `${b.floor.name} очищен.\n\n` +
        `Добыча: ${runQi} ци + ${qiBonus} бонус\n` +
        `Пепел: ${b.runAsh} + ${ashBonus} бонус\n` +
        (unlockedNew ? `\n🔓 Открыт этаж ${state.maxFloor} — ${FLOORS[state.maxFloor - 1].name}!\n` : '\n') +
        `Зеркало Нирваны довольно вами.`;
    }
  } else {
    state.deaths++;
    SFX.defeat();
    state.ash += b.runAsh + Math.floor(b.kills / 2);
    if (state.deaths >= 5) unlockAchievement('deaths');
    title.textContent = '💀 Вы пали...';
    text.textContent =
      `${path.defeatLine}\n\n` +
      `Собранная ци забега потеряна.\n` +
      `Пепел сохранён: ${b.runAsh + Math.floor(b.kills / 2)}\n` +
      `Наследие выросло: теперь +${Math.round((ECON.legacyMult() - 1) * 100)}% к урону навсегда`;
  }

  saveState();
  overlay.classList.remove('hidden');
}

function doRebirth() {
  state.rebirths++;
  unlockAchievement('reborn');
  state.qi = 0;
  state.ash = 0;
  state.upgrades = { breath: 0, sword: 0, body: 0 };
  state.talismans = { seal: 0, ward: 0, feather: 0, tear: 0 };
  state.maxFloor = 1;
  state.path = null; // снова выбор природы
  saveState();
  applyTheme();
}

document.getElementById('btn-result-ok').onclick = () => {
  document.getElementById('result-overlay').classList.add('hidden');
  const showChoice = battle.showChoiceAfter;
  const rebirth = battle.rebirthOffer;
  battle = null;
  if (rebirth) {
    doRebirth();
    refreshHub();
    showScreen('choice');
  } else {
    refreshHub();
    showScreen(showChoice ? 'choice' : 'hub');
  }
};

document.getElementById('btn-result-alt').onclick = () => {
  document.getElementById('result-overlay').classList.add('hidden');
  battle = null;
  refreshHub();
  showScreen('hub');
};

/* ================= СТАРТ ================= */
function boot() {
  applyLoginRewards();
  applyTheme();
  refreshHub();
  showScreen('hub');

  // Отладочные хуки (только для разработки)
  if (location.hash === '#share') { state.path = 'righteous'; applyTheme(); showShareCard(); }
  if (location.hash === '#sharefallen') { state.path = 'fallen'; applyTheme(); showShareCard(); }
  const dbg = location.hash.match(/^#battle(\d)$/); // #battle1..#battle3
  if (dbg) startRun(Math.min(FLOORS.length, parseInt(dbg[1], 10)) - 1);
  if (location.hash === '#choice') showScreen('choice');
  if (location.hash === '#fallen') { state.path = 'fallen'; applyTheme(); startRun(0); }
  if (location.hash === '#meditate') document.getElementById('btn-meditate').click();
  if (location.hash === '#rebirth') { startRun(2); endRun(true); }
  const dbgBoss = location.hash.match(/^#boss(\d)$/); // #boss1..#boss3
  if (dbgBoss) {
    const fi = Math.min(FLOORS.length, parseInt(dbgBoss[1], 10)) - 1;
    startRun(fi);
    battle.roomIndex = battle.floor.rooms.length - 1;
    spawnRoom(battle.roomIndex);
    battle.enemies.forEach((e, i) => { e.x = 220 + i * 80; e.y = canvas.clientHeight / 2 + (i - 1) * 80; });
  }
}

// Инициализация: берём более свежую копию — облако Telegram или локальную
Cloud.load(cloudState => {
  const local = loadLocal();
  const cloudTime = (cloudState && cloudState.lastSeen) || 0;
  const localTime = (local && local.lastSeen) || 0;
  const best = cloudTime >= localTime ? cloudState : local;
  if (best) state = mergeState(best);
  saveState(); // сразу синхронизируем обе копии
  boot();
});

window.addEventListener('beforeunload', saveState);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveState(); });
