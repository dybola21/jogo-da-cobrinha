/* Motor do jogo da Cobrinha — lógica em passo fixo, render interpolado no canvas. */

import { sfx } from "./audio";

export interface Vec {
  x: number;
  y: number;
}

export type Phase = "menu" | "playing" | "paused" | "dying" | "gameover";
export type DifficultyId = "tranquilo" | "classico" | "turbo";

export interface Difficulty {
  id: DifficultyId;
  label: string;
  base: number; // ms por passo
  min: number; // ms mínimo (velocidade máxima)
  step: number; // aceleração por comida
  mult: number; // multiplicador de pontos
}

export const DIFFICULTIES: Difficulty[] = [
  { id: "tranquilo", label: "Tranquilo", base: 172, min: 96, step: 1.7, mult: 1 },
  { id: "classico", label: "Clássico", base: 128, min: 74, step: 2.1, mult: 2 },
  { id: "turbo", label: "Turbo", base: 90, min: 54, step: 1.7, mult: 3 },
];

export const COLS = 21;
export const ROWS = 21;

const COMBO_WINDOW = 6000;
const BONUS_EVERY = 5;
const BONUS_LIFE = 6500;
const BEST_KEY = "cobrinha:recorde";

export interface Snapshot {
  phase: Phase;
  score: number;
  best: number;
  combo: number;
  foods: number;
  level: number;
  difficulty: DifficultyId;
  newRecord: boolean;
  win: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: 0 | 1; // 0 = bolinha, 1 = confete
  rot: number;
  vr: number;
}

interface Floater {
  x: number;
  y: number;
  text: string;
  life: number;
  max: number;
  color: string;
  big: boolean;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function saveBest(v: number) {
  try {
    localStorage.setItem(BEST_KEY, String(v));
  } catch {
    /* sem storage */
  }
}

export class SnakeGame {
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onSnap: (s: Snapshot) => void;

  private dpr = 1;
  private size = 320;
  private cell = 320 / COLS;

  private diff: Difficulty = DIFFICULTIES[1];
  private phase: Phase = "menu";

  private snake: Vec[] = [];
  private prev: Vec[] = [];
  private dir: Vec = { x: 1, y: 0 };
  private queue: Vec[] = [];
  private grow = 0;

  private food: Vec = { x: 15, y: 10 };
  private bonus: Vec | null = null;
  private bonusLeft = 0;

  private score = 0;
  private best = 0;
  private combo = 0;
  private comboT = 0;
  private eaten = 0;
  private interval = 128;
  private acc = 0;

  private time = 0;
  private shake = 0;
  private flash = 0;
  private deadT = 0;
  private newRecord = false;
  private win = false;

  private particles: Particle[] = [];
  private floaters: Floater[] = [];

  private raf = 0;
  private last = 0;
  private running = false;

  constructor(canvas: HTMLCanvasElement, onSnap: (s: Snapshot) => void) {
    this.cv = canvas;
    const c = canvas.getContext("2d");
    if (!c) throw new Error("Canvas 2D não suportado");
    this.ctx = c;
    this.onSnap = onSnap;
    this.best = loadBest();
    this.resetBoard();
    this.snapshot();
  }

  /* ------------------------------------------------ ciclo de vida */

  boot() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = clamp(now - this.last, 0, 50);
      this.last = now;
      this.update(dt);
      const t =
        this.phase === "playing" || this.phase === "paused"
          ? clamp(this.acc / this.interval, 0, 1)
          : this.phase === "dying"
            ? 1
            : 0;
      this.draw(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  resize(cssSize: number) {
    this.size = Math.max(120, cssSize);
    this.cell = this.size / COLS;
    this.dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    const px = Math.round(this.size * this.dpr);
    this.cv.width = px;
    this.cv.height = px;
    this.cv.style.width = `${this.size}px`;
    this.cv.style.height = `${this.size}px`;
  }

  private snapshot() {
    this.onSnap({
      phase: this.phase,
      score: this.score,
      best: this.best,
      combo: this.combo,
      foods: this.eaten,
      level: 1 + Math.floor(this.eaten / 5),
      difficulty: this.diff.id,
      newRecord: this.newRecord,
      win: this.win,
    });
  }

  /* ------------------------------------------------ controle externo */

  setDifficulty(id: DifficultyId) {
    const d = DIFFICULTIES.find((x) => x.id === id);
    if (!d) return;
    this.diff = d;
    this.interval = d.base;
    this.snapshot();
  }

  start() {
    this.resetBoard();
    this.score = 0;
    this.combo = 0;
    this.comboT = 0;
    this.eaten = 0;
    this.interval = this.diff.base;
    this.newRecord = false;
    this.win = false;
    this.particles = [];
    this.floaters = [];
    this.shake = 0;
    this.flash = 0;
    this.phase = "playing";
    sfx.start();
    this.snapshot();
  }

  togglePause() {
    if (this.phase === "playing") {
      this.phase = "paused";
      sfx.pause();
    } else if (this.phase === "paused") {
      this.phase = "playing";
      sfx.resume();
    } else {
      return;
    }
    this.snapshot();
  }

  toMenu() {
    this.phase = "menu";
    this.resetBoard();
    this.particles = [];
    this.floaters = [];
    this.shake = 0;
    this.snapshot();
  }

  queueDir(x: number, y: number) {
    const lastD = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
    if (x === -lastD.x && y === -lastD.y) return; // sem reversão de 180°
    if (x === lastD.x && y === lastD.y) return; // já é a direção atual
    if (this.queue.length < 3) this.queue.push({ x, y });
  }

  /* ------------------------------------------------ estado interno */

  private resetBoard() {
    const cy = Math.floor(ROWS / 2);
    const cx = Math.floor(COLS / 2);
    this.snake = [
      { x: cx, y: cy },
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy },
    ];
    this.prev = this.snake.map((p) => ({ ...p }));
    this.dir = { x: 1, y: 0 };
    this.queue = [];
    this.grow = 0;
    this.bonus = null;
    this.bonusLeft = 0;
    this.acc = 0;
    this.food = this.freeCell() ?? { x: cx + 5, y: cy };
  }

  private freeCell(): Vec | null {
    const taken = new Set<number>();
    for (const p of this.snake) taken.add(p.y * COLS + p.x);
    taken.add(this.food.y * COLS + this.food.x);
    if (this.bonus) taken.add(this.bonus.y * COLS + this.bonus.x);
    const free: number[] = [];
    for (let i = 0; i < COLS * ROWS; i++) if (!taken.has(i)) free.push(i);
    if (!free.length) return null;
    const idx = free[Math.floor(Math.random() * free.length)];
    return { x: idx % COLS, y: Math.floor(idx / COLS) };
  }

  /* ------------------------------------------------ simulação */

  private update(dt: number) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 0.032);
    this.flash = Math.max(0, this.flash - dt * 0.0045);

    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.0011 * dt;
      p.vx *= Math.exp(-dt * 0.0016);
      p.rot += p.vr * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.particles.length > 320) this.particles.splice(0, this.particles.length - 320);

    for (const f of this.floaters) {
      f.life -= dt;
      f.y -= dt * 0.028;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);

    if (this.phase === "playing") {
      this.acc += dt;
      if (this.acc > this.interval * 2.5) this.acc = this.interval * 0.5;
      while (this.acc >= this.interval && this.phase === "playing") {
        this.acc -= this.interval;
        this.step();
      }
      if (this.combo > 0) {
        this.comboT -= dt;
        if (this.comboT <= 0) {
          this.combo = 0;
          this.snapshot();
        }
      }
      if (this.bonus) {
        this.bonusLeft -= dt;
        if (this.bonusLeft <= 0) {
          this.puff((this.bonus.x + 0.5) * this.cell, (this.bonus.y + 0.5) * this.cell);
          this.bonus = null;
          this.snapshot();
        }
      }
    } else if (this.phase === "dying") {
      this.deadT += dt;
      if (this.deadT > 900) this.endGame();
    }
  }

  private step() {
    const next = this.queue.shift() ?? this.dir;
    if (!(next.x === -this.dir.x && next.y === -this.dir.y)) this.dir = next;

    const head = this.snake[0];
    const nx = head.x + this.dir.x;
    const ny = head.y + this.dir.y;

    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) {
      this.die();
      return;
    }

    const eatingFood = this.food.x === nx && this.food.y === ny;
    const eatingBonus = this.bonus !== null && this.bonus.x === nx && this.bonus.y === ny;
    const willGrow = this.grow > 0 || eatingFood || eatingBonus;
    const lim = willGrow ? this.snake.length : this.snake.length - 1;
    for (let i = 0; i < lim; i++) {
      if (this.snake[i].x === nx && this.snake[i].y === ny) {
        this.die();
        return;
      }
    }

    this.prev = this.snake.map((p) => ({ ...p }));
    this.snake.unshift({ x: nx, y: ny });

    if (eatingFood) this.eatFood();
    else if (eatingBonus) this.eatBonus();

    if (this.grow > 0) this.grow--;
    else this.snake.pop();
  }

  private eatFood() {
    this.eaten++;
    this.combo = this.comboT > 0 ? Math.min(this.combo + 1, 5) : 1;
    this.comboT = COMBO_WINDOW;
    const pts = 10 * this.combo * this.diff.mult;
    this.score += pts;
    this.grow += 1;
    this.flash = 1;
    this.shake = Math.max(this.shake, 3);

    const cx = (this.food.x + 0.5) * this.cell;
    const cy = (this.food.y + 0.5) * this.cell;
    this.burst(cx, cy, ["#ff5d5d", "#ff8a7a", "#6fe44e", "#ffd23f"], 14, 0.22);
    this.floaters.push({
      x: cx,
      y: cy - this.cell * 0.4,
      text: `+${pts}${this.combo > 1 ? ` ×${this.combo}` : ""}`,
      life: 900,
      max: 900,
      color: this.combo > 1 ? "#d97a00" : "#0c7a3d",
      big: this.combo > 1,
    });
    sfx.eat(this.combo);

    const fc = this.freeCell();
    if (!fc) {
      this.winGame();
      return;
    }
    this.food = fc;

    if (this.eaten % BONUS_EVERY === 0 && !this.bonus) {
      const bc = this.freeCell();
      if (bc) {
        this.bonus = bc;
        this.bonusLeft = BONUS_LIFE;
        sfx.bonusSpawn();
      }
    }

    this.interval = Math.max(this.diff.min, this.diff.base - this.eaten * this.diff.step);
    this.snapshot();
  }

  private eatBonus() {
    if (!this.bonus) return;
    const pts = 50 * this.diff.mult;
    this.score += pts;
    this.grow += 2;
    this.flash = 1;
    this.shake = Math.max(this.shake, 5);
    const cx = (this.bonus.x + 0.5) * this.cell;
    const cy = (this.bonus.y + 0.5) * this.cell;
    this.burst(cx, cy, ["#ffd23f", "#ffb020", "#fff3b0", "#ff9f1c"], 22, 0.3);
    this.floaters.push({
      x: cx,
      y: cy - this.cell * 0.5,
      text: `+${pts} BÔNUS!`,
      life: 1100,
      max: 1100,
      color: "#c76e00",
      big: true,
    });
    this.bonus = null;
    sfx.bonus();
    this.snapshot();
  }

  private die() {
    this.phase = "dying";
    this.deadT = 0;
    this.shake = 18;
    sfx.die();
    for (let i = 0; i < this.snake.length; i += 2) {
      const p = this.snake[i];
      this.burst((p.x + 0.5) * this.cell, (p.y + 0.5) * this.cell, ["#6fe44e", "#149a45", "#b8ffc4"], 6, 0.26);
    }
    this.snapshot();
  }

  private endGame() {
    this.phase = "gameover";
    this.newRecord = this.score > this.best && this.score > 0;
    if (this.newRecord) {
      this.best = this.score;
      saveBest(this.best);
      sfx.record();
      this.confetti(90);
    }
    this.snapshot();
  }

  private winGame() {
    this.phase = "gameover";
    this.win = true;
    this.newRecord = this.score > this.best && this.score > 0;
    if (this.newRecord) {
      this.best = this.score;
      saveBest(this.best);
    }
    sfx.record();
    this.confetti(120);
    this.snapshot();
  }

  /* ------------------------------------------------ efeitos */

  private burst(x: number, y: number, colors: string[], n: number, speed: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = rand(speed * 0.35, speed);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 0.06,
        life: rand(380, 750),
        max: 750,
        size: rand(this.cell * 0.08, this.cell * 0.18),
        color: colors[Math.floor(Math.random() * colors.length)],
        kind: 0,
        rot: 0,
        vr: 0,
      });
    }
  }

  private puff(x: number, y: number) {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * 0.06,
        vy: Math.sin(a) * 0.06,
        life: rand(280, 480),
        max: 480,
        size: rand(this.cell * 0.07, this.cell * 0.13),
        color: "rgba(120,130,110,0.7)",
        kind: 0,
        rot: 0,
        vr: 0,
      });
    }
  }

  private confetti(n: number) {
    const colors = ["#ffd23f", "#6fe44e", "#ff5d5d", "#4dd6c1", "#ffffff", "#ff9f1c"];
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: rand(0, this.size),
        y: rand(-this.size * 0.3, 0),
        vx: rand(-0.06, 0.06),
        vy: rand(0.08, 0.22),
        life: rand(1200, 2200),
        max: 2200,
        size: rand(this.cell * 0.14, this.cell * 0.26),
        color: colors[Math.floor(Math.random() * colors.length)],
        kind: 1,
        rot: Math.random() * Math.PI,
        vr: rand(-0.012, 0.012),
      });
    }
  }

  /* ------------------------------------------------ desenho */

  private roundRectPath(x: number, y: number, w: number, h: number, r: number) {
    const c = this.ctx;
    const rr = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }

  private draw(t: number) {
    const c = this.ctx;
    const s = this.size;
    const cell = this.cell;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, s, s);

    let ox = 0;
    let oy = 0;
    if (this.shake > 0.2) {
      ox = rand(-1, 1) * this.shake * 0.5;
      oy = rand(-1, 1) * this.shake * 0.5;
    }
    c.save();
    c.translate(ox, oy);

    // tabuleiro claro
    this.roundRectPath(0, 0, s, s, cell * 0.55);
    c.fillStyle = "#eef6e1";
    c.fill();
    c.save();
    this.roundRectPath(0, 0, s, s, cell * 0.55);
    c.clip();

    // xadrez suave
    c.fillStyle = "rgba(31,111,64,0.06)";
    for (let y = 0; y < ROWS; y++) {
      for (let x = (y % 2); x < COLS; x += 2) {
        c.fillRect(x * cell, y * cell, cell, cell);
      }
    }

    this.drawFood();
    if (this.bonus) this.drawBonus();
    this.drawSnake(t);
    this.drawParticles();
    this.drawFloaters();

    if (this.flash > 0) {
      c.fillStyle = `rgba(255,214,90,${(this.flash * 0.13).toFixed(3)})`;
      c.fillRect(0, 0, s, s);
    }
    c.restore();

    // borda interna
    this.roundRectPath(1.5, 1.5, s - 3, s - 3, cell * 0.55);
    c.strokeStyle = "rgba(10,70,40,0.22)";
    c.lineWidth = 3;
    c.stroke();

    c.restore();
  }

  private tracePath(pts: Vec[]) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
  }

  private drawSnake(t: number) {
    const c = this.ctx;
    const cell = this.cell;
    const pts: Vec[] = this.snake.map((p, i) => {
      const q = this.prev[i] ?? this.prev[this.prev.length - 1] ?? p;
      return {
        x: (q.x + (p.x - q.x) * t + 0.5) * cell,
        y: (q.y + (p.y - q.y) * t + 0.5) * cell,
      };
    });
    if (this.phase === "menu") {
      for (let i = 0; i < pts.length; i++) {
        pts[i].y += Math.sin(this.time / 460 + i * 0.9) * cell * 0.07;
      }
    }

    c.save();
    if (this.phase === "dying") {
      c.globalAlpha = clamp(1 - this.deadT / 900, 0.25, 1);
    }

    const w = cell * 0.72;
    c.lineJoin = "round";
    c.lineCap = "round";

    // sombra projetada
    c.save();
    c.translate(cell * 0.07, cell * 0.12);
    this.tracePath(pts);
    c.strokeStyle = "rgba(18,64,38,0.15)";
    c.lineWidth = w + cell * 0.06;
    c.stroke();
    c.restore();

    // contorno
    this.tracePath(pts);
    c.strokeStyle = "#0a5c2f";
    c.lineWidth = w + cell * 0.14;
    c.stroke();

    // corpo em degradê da cabeça à cauda
    const head = pts[0];
    const tail = pts[pts.length - 1];
    const grad = c.createLinearGradient(head.x, head.y, tail.x, tail.y);
    grad.addColorStop(0, "#66e85f");
    grad.addColorStop(0.55, "#2fbf4b");
    grad.addColorStop(1, "#128a40");
    this.tracePath(pts);
    c.strokeStyle = grad;
    c.lineWidth = w;
    c.stroke();

    // brilho superior
    this.tracePath(pts);
    c.strokeStyle = "rgba(255,255,255,0.16)";
    c.lineWidth = w * 0.42;
    c.stroke();

    // pintas no corpo
    c.fillStyle = "rgba(7,60,30,0.18)";
    for (let i = 2; i < pts.length - 1; i += 2) {
      c.beginPath();
      c.arc(pts[i].x, pts[i].y, cell * 0.09, 0, Math.PI * 2);
      c.fill();
    }

    // cabeça
    const d = this.dir;
    c.beginPath();
    c.arc(head.x, head.y, cell * 0.46, 0, Math.PI * 2);
    c.fillStyle = "#57e05c";
    c.fill();
    c.strokeStyle = "#0a5c2f";
    c.lineWidth = cell * 0.09;
    c.stroke();

    // língua (flick periódico)
    if (this.phase === "playing" && this.time % 1900 < 240) {
      const tx = head.x + d.x * cell * 0.46;
      const ty = head.y + d.y * cell * 0.46;
      const mx = head.x + d.x * cell * 0.82;
      const my = head.y + d.y * cell * 0.82;
      const px = -d.y * cell * 0.12;
      const py = d.x * cell * 0.12;
      c.strokeStyle = "#ff4d5e";
      c.lineWidth = cell * 0.07;
      c.beginPath();
      c.moveTo(tx, ty);
      c.lineTo(mx, my);
      c.moveTo(mx, my);
      c.lineTo(mx + px + d.x * cell * 0.1, my + py + d.y * cell * 0.1);
      c.moveTo(mx, my);
      c.lineTo(mx - px + d.x * cell * 0.1, my - py + d.y * cell * 0.1);
      c.stroke();
    }

    // olhos
    const ex = -d.y;
    const ey = d.x;
    const bx = head.x + d.x * cell * 0.13;
    const by = head.y + d.y * cell * 0.13;
    const blink = this.time % 3400 < 130;
    for (const sgn of [1, -1]) {
      const cxp = bx + ex * sgn * cell * 0.2;
      const cyp = by + ey * sgn * cell * 0.2;
      if (blink || this.phase === "dying") {
        c.strokeStyle = "#0a5c2f";
        c.lineWidth = cell * 0.07;
        c.beginPath();
        c.moveTo(cxp - ex * cell * 0.11 - d.x * cell * 0.05, cyp - ey * cell * 0.11 - d.y * cell * 0.05);
        c.lineTo(cxp + ex * cell * 0.11 + d.x * cell * 0.05, cyp + ey * cell * 0.11 + d.y * cell * 0.05);
        if (this.phase === "dying") {
          c.moveTo(cxp - ex * cell * 0.11 + d.x * cell * 0.05, cyp - ey * cell * 0.11 + d.y * cell * 0.05);
          c.lineTo(cxp + ex * cell * 0.11 - d.x * cell * 0.05, cyp + ey * cell * 0.11 - d.y * cell * 0.05);
        }
        c.stroke();
      } else {
        c.beginPath();
        c.arc(cxp, cyp, cell * 0.14, 0, Math.PI * 2);
        c.fillStyle = "#ffffff";
        c.fill();
        c.strokeStyle = "#0a5c2f";
        c.lineWidth = cell * 0.03;
        c.stroke();
        c.beginPath();
        c.arc(cxp + d.x * cell * 0.055, cyp + d.y * cell * 0.055, cell * 0.07, 0, Math.PI * 2);
        c.fillStyle = "#10301c";
        c.fill();
      }
    }
    c.restore();
  }

  private drawFood() {
    const c = this.ctx;
    const cell = this.cell;
    const x = (this.food.x + 0.5) * cell;
    const y = (this.food.y + 0.5) * cell;
    const pulse = 1 + 0.07 * Math.sin(this.time / 170);
    const r = cell * 0.34 * pulse;

    // sombra
    c.beginPath();
    c.ellipse(x, y + r * 0.95, r * 0.85, r * 0.3, 0, 0, Math.PI * 2);
    c.fillStyle = "rgba(20,60,35,0.16)";
    c.fill();

    // corpo da maçã
    const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r * 1.15);
    g.addColorStop(0, "#ff9a85");
    g.addColorStop(0.55, "#ff5d5d");
    g.addColorStop(1, "#d92440");
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = "rgba(120,10,30,0.4)";
    c.lineWidth = cell * 0.045;
    c.stroke();

    // cabinho e folha
    c.strokeStyle = "#7a4a21";
    c.lineWidth = cell * 0.07;
    c.beginPath();
    c.moveTo(x, y - r * 0.85);
    c.quadraticCurveTo(x + r * 0.15, y - r * 1.3, x + r * 0.3, y - r * 1.4);
    c.stroke();
    c.save();
    c.translate(x + r * 0.55, y - r * 1.15);
    c.rotate(-0.5 + Math.sin(this.time / 300) * 0.08);
    c.beginPath();
    c.ellipse(0, 0, r * 0.42, r * 0.2, 0, 0, Math.PI * 2);
    c.fillStyle = "#2fae4f";
    c.fill();
    c.restore();

    // brilho
    c.beginPath();
    c.arc(x - r * 0.38, y - r * 0.42, r * 0.26, 0, Math.PI * 2);
    c.fillStyle = "rgba(255,255,255,0.75)";
    c.fill();
  }

  private drawBonus() {
    if (!this.bonus) return;
    const c = this.ctx;
    const cell = this.cell;
    const x = (this.bonus.x + 0.5) * cell;
    const y = (this.bonus.y + 0.5) * cell;
    const f = clamp(this.bonusLeft / BONUS_LIFE, 0, 1);
    const blink = f < 0.25 ? 0.55 + 0.45 * Math.sin(this.time / 70) : 1;

    c.save();
    c.globalAlpha = blink;

    // anel de tempo
    c.beginPath();
    c.arc(x, y, cell * 0.56, 0, Math.PI * 2);
    c.strokeStyle = "rgba(224,137,0,0.2)";
    c.lineWidth = cell * 0.09;
    c.stroke();
    c.beginPath();
    c.arc(x, y, cell * 0.56, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f);
    c.strokeStyle = "#e08900";
    c.stroke();

    // estrela girando
    const rot = this.time / 420;
    const R = cell * 0.36;
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.shadowColor = "rgba(255,190,40,0.85)";
    c.shadowBlur = cell * 0.45;
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? R : R * 0.46;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.fillStyle = "#ffd23f";
    c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = "#e08900";
    c.lineWidth = cell * 0.05;
    c.stroke();
    c.restore();
    c.restore();
  }

  private drawParticles() {
    const c = this.ctx;
    for (const p of this.particles) {
      const a = clamp(p.life / p.max, 0, 1);
      c.globalAlpha = a;
      if (p.kind === 0) {
        c.beginPath();
        c.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
        c.fillStyle = p.color;
        c.fill();
      } else {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        c.fillStyle = p.color;
        c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        c.restore();
      }
    }
    c.globalAlpha = 1;
  }

  private drawFloaters() {
    const c = this.ctx;
    const cell = this.cell;
    c.textAlign = "center";
    c.textBaseline = "middle";
    for (const f of this.floaters) {
      const a = clamp(f.life / f.max, 0, 1);
      c.globalAlpha = Math.min(1, a * 1.6);
      c.font = `${cell * (f.big ? 0.6 : 0.48)}px Bungee, sans-serif`;
      c.lineWidth = cell * 0.16;
      c.lineJoin = "round";
      c.strokeStyle = "rgba(255,255,255,0.92)";
      c.strokeText(f.text, f.x, f.y);
      c.fillStyle = f.color;
      c.fillText(f.text, f.x, f.y);
    }
    c.globalAlpha = 1;
  }
}
