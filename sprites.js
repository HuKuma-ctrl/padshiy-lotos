'use strict';

/* =========================================================
   SPRITES.JS — векторная отрисовка персонажей и лотоса.
   Каждая функция рисует спрайт с центром в (x, y),
   масштабируясь от r (радиус сущности).
   ========================================================= */

function spGlow(ctx, color, blur) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}
function spNoGlow(ctx) { ctx.shadowBlur = 0; }

function spRadial(ctx, x, y, r, c1, c2) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  return g;
}

function spEyes(ctx, x, y, dx, r, color, glow) {
  ctx.fillStyle = color;
  spGlow(ctx, glow || color, 8);
  ctx.beginPath(); ctx.arc(x - dx, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + dx, y, r, 0, Math.PI * 2); ctx.fill();
  spNoGlow(ctx);
}

function spHorn(ctx, x, y, len, wid, angle, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(wid, -len * 0.5, 0, -len);
  ctx.quadraticCurveTo(-wid * 0.4, -len * 0.5, 0, 0);
  ctx.fill();
  ctx.restore();
}

/* ---------- ИГРОК: культиватор с мечом ---------- */
function drawPlayer(ctx, x, y, r, opts) {
  const path = opts.path; // { dmgColor, ... }
  const fallen = opts.fallen;
  const robeMain = fallen ? '#4a1520' : '#2c3a5e';
  const robeDark = fallen ? '#2a0a12' : '#1a2440';
  const trim = fallen ? '#e05656' : '#e8c15a';

  // Мантия (трапеция с закруглённым верхом)
  spGlow(ctx, trim, 10);
  ctx.fillStyle = spRadial(ctx, x, y, r * 1.1, robeMain, robeDark);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.55, y - r * 0.35);
  ctx.quadraticCurveTo(x, y - r * 0.75, x + r * 0.55, y - r * 0.35);
  ctx.lineTo(x + r * 0.9, y + r * 0.95);
  ctx.quadraticCurveTo(x, y + r * 1.15, x - r * 0.9, y + r * 0.95);
  ctx.closePath();
  ctx.fill();
  spNoGlow(ctx);

  // Пояс
  ctx.strokeStyle = trim;
  ctx.lineWidth = Math.max(1.5, r * 0.07);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.62, y + r * 0.3);
  ctx.quadraticCurveTo(x, y + r * 0.42, x + r * 0.62, y + r * 0.3);
  ctx.stroke();

  // Голова
  ctx.fillStyle = '#e8c8a0';
  ctx.beginPath(); ctx.arc(x, y - r * 0.55, r * 0.34, 0, Math.PI * 2); ctx.fill();
  // Волосы/пучок
  ctx.fillStyle = fallen ? '#3a0a0a' : '#1a1a2a';
  ctx.beginPath(); ctx.arc(x, y - r * 0.72, r * 0.26, Math.PI, 0); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y - r * 0.95, r * 0.1, 0, Math.PI * 2); ctx.fill();

  // Глаза
  spEyes(ctx, x, y - r * 0.55, r * 0.13, r * 0.045, fallen ? '#ff4040' : '#2a2a3a');

  // Меч в правой руке, клинком вверх
  ctx.save();
  ctx.translate(x + r * 0.75, y + r * 0.15);
  ctx.rotate(-0.35);
  spGlow(ctx, trim, 14);
  const blade = ctx.createLinearGradient(0, -r * 1.5, 0, 0);
  blade.addColorStop(0, '#ffffff');
  blade.addColorStop(1, trim);
  ctx.fillStyle = blade;
  ctx.fillRect(-r * 0.08, -r * 1.4, r * 0.16, r * 1.2);
  ctx.beginPath(); // острие
  ctx.moveTo(-r * 0.08, -r * 1.4);
  ctx.lineTo(0, -r * 1.62);
  ctx.lineTo(r * 0.08, -r * 1.4);
  ctx.fill();
  spNoGlow(ctx);
  ctx.fillStyle = trim; // гарда
  ctx.fillRect(-r * 0.32, -r * 0.2, r * 0.64, r * 0.09);
  ctx.fillStyle = '#3a2a1a'; // рукоять
  ctx.fillRect(-r * 0.06, -r * 0.11, r * 0.12, r * 0.42);
  ctx.restore();
}

/* ---------- ВРАГИ ---------- */

function drawSpirit(ctx, x, y, r, flash) {
  // Лесной дух: полупрозрачная волнистая тень
  ctx.globalAlpha = 0.85;
  spGlow(ctx, '#9fd8ff', 14);
  ctx.fillStyle = spRadial(ctx, x, y, r, '#dff4ff', '#5a8ab0');
  ctx.beginPath();
  ctx.arc(x, y - r * 0.25, r * 0.75, Math.PI, 0);
  ctx.lineTo(x + r * 0.75, y + r * 0.35);
  // волнистый низ
  for (let i = 0; i <= 3; i++) {
    const wx = x + r * 0.75 - (i + 0.5) * (r * 1.5 / 4);
    ctx.quadraticCurveTo(wx, y + r * 0.85, x + r * 0.75 - (i + 1) * (r * 1.5 / 4), y + r * 0.35);
  }
  ctx.closePath();
  ctx.fill();
  spNoGlow(ctx);
  ctx.globalAlpha = 1;
  spEyes(ctx, x, y - r * 0.3, r * 0.25, r * 0.1, '#1a3a5a', '#9fd8ff');
}

function drawElite(ctx, x, y, r, flash) {
  // Они: красная рогатая голова
  spGlow(ctx, '#ff6040', 14);
  ctx.fillStyle = spRadial(ctx, x, y, r, '#d05038', '#701c10');
  ctx.beginPath(); ctx.arc(x, y, r * 0.85, 0, Math.PI * 2); ctx.fill();
  spNoGlow(ctx);
  spHorn(ctx, x - r * 0.45, y - r * 0.6, r * 0.65, r * 0.16, -0.25, '#f0e0c0');
  spHorn(ctx, x + r * 0.45, y - r * 0.6, r * 0.65, r * 0.16, 0.25, '#f0e0c0');
  // Клыки
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(x - r * 0.25, y + r * 0.35); ctx.lineTo(x - r * 0.15, y + r * 0.6); ctx.lineTo(x - r * 0.05, y + r * 0.35); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + r * 0.05, y + r * 0.35); ctx.lineTo(x + r * 0.15, y + r * 0.6); ctx.lineTo(x + r * 0.25, y + r * 0.35); ctx.fill();
  spEyes(ctx, x, y - r * 0.15, r * 0.3, r * 0.12, '#ffe040');
}

function drawBoss(ctx, x, y, r, flash) {
  // Тенгу: тёмный дух-воин с маской
  spGlow(ctx, '#c0392b', 20);
  ctx.fillStyle = spRadial(ctx, x, y, r, '#4a1020', '#1a0510');
  ctx.beginPath(); ctx.arc(x, y, r * 0.95, 0, Math.PI * 2); ctx.fill();
  spNoGlow(ctx);
  spHorn(ctx, x - r * 0.55, y - r * 0.7, r * 0.8, r * 0.2, -0.3, '#802030');
  spHorn(ctx, x + r * 0.55, y - r * 0.7, r * 0.8, r * 0.2, 0.3, '#802030');
  // Длинный нос тенгу
  ctx.fillStyle = '#a03040';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.12, y);
  ctx.lineTo(x + r * 0.12, y);
  ctx.lineTo(x, y + r * 0.55);
  ctx.closePath(); ctx.fill();
  spEyes(ctx, x, y - r * 0.25, r * 0.35, r * 0.13, '#ff3020');
}

function drawSkeleton(ctx, x, y, r, flash) {
  // Скелет воина Цинхэ
  spGlow(ctx, '#c0d0e0', 8);
  ctx.fillStyle = spRadial(ctx, x, y - r * 0.35, r * 0.7, '#e8e8f0', '#9898a8');
  ctx.beginPath(); ctx.arc(x, y - r * 0.35, r * 0.55, 0, Math.PI * 2); ctx.fill();
  spNoGlow(ctx);
  // Челюсть
  ctx.fillStyle = '#b8b8c8';
  ctx.fillRect(x - r * 0.3, y + r * 0.1, r * 0.6, r * 0.2);
  // Рёбра
  ctx.strokeStyle = '#9898a8';
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(x, y + r * (0.45 + i * 0.22), r * 0.5, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }
  // Пустые глазницы
  ctx.fillStyle = '#101018';
  ctx.beginPath(); ctx.arc(x - r * 0.22, y - r * 0.4, r * 0.14, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * 0.22, y - r * 0.4, r * 0.14, 0, Math.PI * 2); ctx.fill();
  spEyes(ctx, x, y - r * 0.4, r * 0.22, r * 0.05, '#60c0ff');
}

function drawZombie(ctx, x, y, r, flash) {
  // Цзянши: прыгающий труп с печатью на лбу
  ctx.fillStyle = spRadial(ctx, x, y, r, '#4a6a50', '#24382a');
  ctx.beginPath(); // тело-столб
  ctx.roundRect(x - r * 0.55, y - r * 0.5, r * 1.1, r * 1.4, r * 0.3);
  ctx.fill();
  // Голова
  ctx.fillStyle = '#7a9a80';
  ctx.beginPath(); ctx.arc(x, y - r * 0.65, r * 0.42, 0, Math.PI * 2); ctx.fill();
  // Шапка мандарина
  ctx.fillStyle = '#203050';
  ctx.beginPath(); ctx.arc(x, y - r * 0.85, r * 0.42, Math.PI, 0); ctx.fill();
  // Печать на лбу
  ctx.fillStyle = '#f0e0a0';
  ctx.fillRect(x - r * 0.12, y - r * 0.85, r * 0.24, r * 0.4);
  ctx.strokeStyle = '#c03030';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, y - r * 0.8); ctx.lineTo(x, y - r * 0.55); ctx.stroke();
  spEyes(ctx, x, y - r * 0.6, r * 0.18, r * 0.07, '#d0ff60');
  // Вытянутые руки
  ctx.strokeStyle = '#4a6a50';
  ctx.lineWidth = r * 0.16;
  ctx.beginPath(); ctx.moveTo(x - r * 0.5, y - r * 0.3); ctx.lineTo(x - r * 1.05, y - r * 0.35); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + r * 0.5, y - r * 0.3); ctx.lineTo(x + r * 1.05, y - r * 0.35); ctx.stroke();
}

function drawVampire(ctx, x, y, r, flash) {
  // Предатель секты: бледное лицо, тёмный плащ
  spGlow(ctx, '#8020a0', 16);
  ctx.fillStyle = spRadial(ctx, x, y, r, '#301040', '#100518');
  ctx.beginPath(); // плащ с высоким воротником
  ctx.moveTo(x - r * 0.9, y + r);
  ctx.lineTo(x - r * 0.85, y - r * 0.5);
  ctx.quadraticCurveTo(x - r * 0.5, y - r * 0.95, x, y - r * 0.8);
  ctx.quadraticCurveTo(x + r * 0.5, y - r * 0.95, x + r * 0.85, y - r * 0.5);
  ctx.lineTo(x + r * 0.9, y + r);
  ctx.closePath(); ctx.fill();
  spNoGlow(ctx);
  // Лицо
  ctx.fillStyle = '#e8dce8';
  ctx.beginPath(); ctx.arc(x, y - r * 0.35, r * 0.34, 0, Math.PI * 2); ctx.fill();
  // Клыки
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(x - r * 0.1, y - r * 0.12); ctx.lineTo(x - r * 0.05, y + r * 0.05); ctx.lineTo(x, y - r * 0.12); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x, y - r * 0.12); ctx.lineTo(x + r * 0.05, y + r * 0.05); ctx.lineTo(x + r * 0.1, y - r * 0.12); ctx.fill();
  spEyes(ctx, x, y - r * 0.42, r * 0.14, r * 0.06, '#ff2040');
}

function drawImp(ctx, x, y, r, flash) {
  // Бес Бездны
  spGlow(ctx, '#ff5030', 12);
  ctx.fillStyle = spRadial(ctx, x, y, r, '#c04028', '#581208');
  ctx.beginPath(); ctx.arc(x, y, r * 0.7, 0, Math.PI * 2); ctx.fill();
  spNoGlow(ctx);
  spHorn(ctx, x - r * 0.35, y - r * 0.5, r * 0.55, r * 0.13, -0.3, '#ffd0a0');
  spHorn(ctx, x + r * 0.35, y - r * 0.5, r * 0.55, r * 0.13, 0.3, '#ffd0a0');
  // Хвост
  ctx.strokeStyle = '#c04028';
  ctx.lineWidth = r * 0.12;
  ctx.beginPath();
  ctx.moveTo(x + r * 0.5, y + r * 0.4);
  ctx.quadraticCurveTo(x + r * 1.1, y + r * 0.5, x + r * 1.0, y - r * 0.1);
  ctx.stroke();
  ctx.fillStyle = '#802010';
  ctx.beginPath(); ctx.arc(x + r * 1.0, y - r * 0.1, r * 0.12, 0, Math.PI * 2); ctx.fill();
  // Зубастая ухмылка
  ctx.strokeStyle = '#ffd0a0';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y + r * 0.15, r * 0.3, 0.2, Math.PI - 0.2); ctx.stroke();
  spEyes(ctx, x, y - r * 0.15, r * 0.25, r * 0.1, '#ffe040');
}

function drawDemon(ctx, x, y, r, flash) {
  // Демон-надзиратель с крыльями
  spGlow(ctx, '#a040ff', 18);
  ctx.fillStyle = '#40105a'; // крылья
  ctx.beginPath();
  ctx.moveTo(x - r * 0.4, y - r * 0.2);
  ctx.quadraticCurveTo(x - r * 1.5, y - r * 0.9, x - r * 1.3, y + r * 0.2);
  ctx.quadraticCurveTo(x - r * 0.9, y, x - r * 0.4, y + r * 0.3);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + r * 0.4, y - r * 0.2);
  ctx.quadraticCurveTo(x + r * 1.5, y - r * 0.9, x + r * 1.3, y + r * 0.2);
  ctx.quadraticCurveTo(x + r * 0.9, y, x + r * 0.4, y + r * 0.3);
  ctx.fill();
  // Тело
  ctx.fillStyle = spRadial(ctx, x, y, r, '#6a28a0', '#2a0a40');
  ctx.beginPath(); ctx.arc(x, y, r * 0.75, 0, Math.PI * 2); ctx.fill();
  spNoGlow(ctx);
  spHorn(ctx, x - r * 0.4, y - r * 0.55, r * 0.7, r * 0.16, -0.35, '#c080ff');
  spHorn(ctx, x + r * 0.4, y - r * 0.55, r * 0.7, r * 0.16, 0.35, '#c080ff');
  spEyes(ctx, x, y - r * 0.2, r * 0.28, r * 0.11, '#ff40ff');
}

function drawDragon(ctx, x, y, r, flash) {
  // Дракон Бездны: змеевидное тело, гребень, светящаяся пасть
  spGlow(ctx, '#40ff80', 20);
  // Тело-волна
  ctx.strokeStyle = spRadial(ctx, x, y, r, '#2a8a50', '#0a3020');
  ctx.lineWidth = r * 0.55;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + r * 0.9, y + r * 0.7);
  ctx.quadraticCurveTo(x + r * 1.3, y - r * 0.3, x + r * 0.5, y - r * 0.2);
  ctx.quadraticCurveTo(x - r * 0.3, y - r * 0.1, x - r * 0.3, y - r * 0.35);
  ctx.stroke();
  // Голова
  ctx.fillStyle = spRadial(ctx, x - r * 0.3, y - r * 0.4, r * 0.6, '#3aaa60', '#0a3020');
  ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.4, r * 0.5, 0, Math.PI * 2); ctx.fill();
  spNoGlow(ctx);
  // Рога
  spHorn(ctx, x - r * 0.55, y - r * 0.75, r * 0.6, r * 0.14, -0.5, '#d0ffd0');
  spHorn(ctx, x - r * 0.1, y - r * 0.8, r * 0.55, r * 0.13, 0.1, '#d0ffd0');
  // Пасть
  ctx.fillStyle = '#051008';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.75, y - r * 0.25);
  ctx.quadraticCurveTo(x - r * 0.3, y + r * 0.1, x + r * 0.15, y - r * 0.25);
  ctx.closePath(); ctx.fill();
  spGlow(ctx, '#40ff80', 10);
  ctx.strokeStyle = '#40ff80';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.75, y - r * 0.25);
  ctx.quadraticCurveTo(x - r * 0.3, y + r * 0.1, x + r * 0.15, y - r * 0.25);
  ctx.stroke();
  spNoGlow(ctx);
  spEyes(ctx, x - r * 0.3, y - r * 0.55, r * 0.22, r * 0.09, '#e0ff40');
}

const ENEMY_DRAW = {
  spirit: drawSpirit,
  elite: drawElite,
  boss: drawBoss,
  skeleton: drawSkeleton,
  zombie: drawZombie,
  vampire: drawVampire,
  imp: drawImp,
  demon: drawDemon,
  dragon: drawDragon,
};

function drawEnemy(ctx, type, x, y, r, flash) {
  const fn = ENEMY_DRAW[type] || drawSpirit;
  ctx.save();
  if (flash > 0) {
    ctx.translate(x, y);
    ctx.scale(1 + flash * 0.6, 1 - flash * 0.4); // сплющивание при ударе
    ctx.translate(-x, -y);
  }
  fn(ctx, x, y, r, flash);
  if (flash > 0) {
    ctx.globalAlpha = Math.min(1, flash * 4);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/* ---------- ЛОТОС (кликер) ---------- */
function drawLotus(ctx, cx, cy, R, t) {
  const breathe = 1 + Math.sin(t * 1.5) * 0.03;
  const r = R * breathe;

  // Свечение
  const halo = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.6);
  halo.addColorStop(0, 'rgba(232,193,90,.30)');
  halo.addColorStop(1, 'rgba(232,193,90,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.6, 0, Math.PI * 2); ctx.fill();

  function petal(angle, len, wid, c1, c2) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const g = ctx.createLinearGradient(0, 0, 0, -len);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(wid, -len * 0.45, 0, -len);
    ctx.quadraticCurveTo(-wid, -len * 0.45, 0, 0);
    ctx.fill();
    ctx.restore();
  }

  // Задние лепестки (тёмные)
  const n1 = 8;
  for (let i = 0; i < n1; i++) {
    const a = (i / n1) * Math.PI * 2 + Math.sin(t * 0.8) * 0.02;
    petal(a, r * 1.05, r * 0.34, '#a03a60', '#e0688a');
  }
  // Средние
  const n2 = 6;
  for (let i = 0; i < n2; i++) {
    const a = (i / n2) * Math.PI * 2 + Math.PI / n2 - Math.sin(t * 0.8) * 0.03;
    petal(a, r * 0.8, r * 0.3, '#d05a80', '#ff9ab0');
  }
  // Внутренние
  const n3 = 5;
  for (let i = 0; i < n3; i++) {
    const a = (i / n3) * Math.PI * 2 + Math.PI / n3;
    petal(a, r * 0.55, r * 0.24, '#ff9ab0', '#ffd0dc');
  }
  // Сердцевина
  spGlow(ctx, '#ffe090', 16);
  ctx.fillStyle = spRadial(ctx, cx, cy, r * 0.25, '#fff0b0', '#e8a030');
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2); ctx.fill();
  spNoGlow(ctx);
  // Тычинки
  ctx.fillStyle = '#fff0b0';
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r * 0.15, cy + Math.sin(a) * r * 0.15, r * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ---------- Декорации: бамбук ---------- */
function drawBamboo(ctx, x, y, h, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#2a5a3a';
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#1a3a26';
  for (let i = 1; i < h / 28; i++) {
    ctx.beginPath(); ctx.moveTo(x - 4, y - i * 28); ctx.lineTo(x + 4, y - i * 28); ctx.stroke();
  }
  ctx.fillStyle = '#3a7a4a';
  for (let i = 0; i < 3; i++) {
    const ly = y - h * (0.5 + i * 0.2);
    const side = i % 2 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(x, ly);
    ctx.quadraticCurveTo(x + side * 22, ly - 10, x + side * 34, ly - 4);
    ctx.quadraticCurveTo(x + side * 20, ly + 4, x, ly);
    ctx.fill();
  }
  ctx.restore();
}
