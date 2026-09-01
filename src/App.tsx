import { useEffect, useRef, useState } from "react";
import { DIFFICULTIES, SnakeGame, type DifficultyId, type Snapshot } from "./game/engine";
import { sfx } from "./game/audio";
import {
  IconApple,
  IconBolt,
  IconChevron,
  IconHome,
  IconPause,
  IconPlay,
  IconRestart,
  IconSound,
  IconStar,
  IconTrophy,
  LogoSnake,
} from "./components/icons";

const INITIAL_SNAP: Snapshot = {
  phase: "menu",
  score: 0,
  best: 0,
  combo: 0,
  foods: 0,
  level: 1,
  difficulty: "classico",
  newRecord: false,
  win: false,
};

const DIFF_INFO: Record<DifficultyId, { speed: number; label: string }> = {
  tranquilo: { speed: 1, label: "Tranquilo" },
  classico: { speed: 2, label: "Clássico" },
  turbo: { speed: 3, label: "Turbo" },
};

const KEY_DIRS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  w: [0, -1],
  s: [0, 1],
  a: [-1, 0],
  d: [1, 0],
  W: [0, -1],
  S: [0, 1],
  A: [-1, 0],
  D: [1, 0],
};

function blurActive() {
  const el = document.activeElement;
  if (el instanceof HTMLElement) el.blur();
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<SnakeGame | null>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const [snap, setSnap] = useState<Snapshot>(INITIAL_SNAP);
  const [muted, setMuted] = useState(sfx.isMuted());
  const [side, setSide] = useState(320);

  const phaseRef = useRef(snap.phase);
  phaseRef.current = snap.phase;

  /* ------------------------- motor ------------------------- */

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const game = new SnakeGame(cv, setSnap);
    gameRef.current = game;
    game.resize(320);
    game.boot();
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const availW = r.width - 24; // padding lateral do palco
      const availH = r.height - 6; // folga vertical
      const s = Math.floor(Math.min(availW, availH)) - 28; // moldura do tabuleiro
      setSide(Math.max(200, Math.min(s, 680)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    gameRef.current?.resize(side);
  }, [side]);

  /* ------------------------- ações ------------------------- */

  const doStart = () => {
    sfx.unlock();
    blurActive();
    gameRef.current?.start();
  };

  const doPrimary = () => {
    const g = gameRef.current;
    if (!g) return;
    const ph = phaseRef.current;
    if (ph === "playing" || ph === "paused") g.togglePause();
    else doStart();
  };

  const doPause = () => gameRef.current?.togglePause();
  const doMenu = () => {
    sfx.click();
    gameRef.current?.toMenu();
  };

  const doDiff = (id: DifficultyId) => {
    sfx.unlock();
    sfx.click();
    gameRef.current?.setDifficulty(id);
  };

  const doSound = () => {
    sfx.unlock();
    setMuted(sfx.toggleMuted());
  };

  const steer = (x: number, y: number) => {
    const g = gameRef.current;
    if (!g) return;
    sfx.unlock();
    if (phaseRef.current === "menu") g.start();
    g.queueDir(x, y);
  };

  /* ------------------------- teclado ------------------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!g) return;
      const ph = phaseRef.current;
      const k = e.key;

      if (k === " " || k === "Enter") {
        e.preventDefault();
        doPrimary();
        return;
      }
      if (k === "r" || k === "R") {
        e.preventDefault();
        doStart();
        return;
      }
      if (k === "m" || k === "M") {
        doSound();
        return;
      }
      if (k === "Escape" && (ph === "playing" || ph === "paused")) {
        g.togglePause();
        return;
      }
      const dv = KEY_DIRS[k];
      if (dv) {
        e.preventDefault();
        steer(dv[0], dv[1]);
      }
    };
    const onVis = () => {
      if (document.hidden && phaseRef.current === "playing") {
        gameRef.current?.togglePause();
      }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------- toque ------------------------- */

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const st = touchRef.current;
    touchRef.current = null;
    if (!st) return;
    const g = gameRef.current;
    if (!g) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - st.x;
    const dy = t.clientY - st.y;
    const ph = phaseRef.current;

    if (Math.hypot(dx, dy) < 16) {
      if (ph === "playing" || ph === "paused") g.togglePause();
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) steer(Math.sign(dx), 0);
    else steer(0, Math.sign(dy));
  };

  /* ------------------------- interface ------------------------- */

  const diffLabel = DIFF_INFO[snap.difficulty].label;
  const playing = snap.phase === "playing";
  const paused = snap.phase === "paused";

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden font-body select-none">
      <div className="page-bg" aria-hidden />
      <div className="page-dots" aria-hidden />
      <div
        className="orb"
        style={{ width: 340, height: 340, left: -90, top: -70, background: "#1e7a4a" }}
        aria-hidden
      />
      <div
        className="orb"
        style={{
          width: 300,
          height: 300,
          right: -80,
          bottom: -90,
          background: "#8a6a12",
          animationDelay: "-4s",
        }}
        aria-hidden
      />
      <div
        className="orb"
        style={{
          width: 240,
          height: 240,
          right: "28%",
          top: -110,
          background: "#14655a",
          animationDelay: "-8s",
        }}
        aria-hidden
      />

      {/* cabeçalho */}
      <header className="relative z-10 flex items-center justify-between gap-3 px-4 pt-3 pb-2 sm:px-6">
        <div className="flex items-center gap-3">
          <LogoSnake size={40} />
          <div>
            <h1 className="font-display title-shadow text-xl leading-none text-[#7ee84c] sm:text-2xl">
              COBRINHA
            </h1>
            <p className="text-[10px] font-bold tracking-[0.2em] text-[#9cc7ae] uppercase">
              Fliperama de bolso
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(playing || paused) && (
            <>
              <button className="icon-btn" onClick={doStart} aria-label="Reiniciar" title="Reiniciar (R)">
                <IconRestart />
              </button>
              <button
                className="icon-btn"
                onClick={doPause}
                aria-label={playing ? "Pausar" : "Continuar"}
                title="Pausar (Espaço)"
              >
                {playing ? <IconPause /> : <IconPlay />}
              </button>
            </>
          )}
          <button className="icon-btn" onClick={doSound} aria-label="Som" title="Som (M)">
            <IconSound muted={muted} />
          </button>
        </div>
      </header>

      {/* HUD */}
      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-wrap items-stretch justify-center gap-2 px-3 pb-2 sm:px-4">
        <div className="hud-panel min-w-[104px] flex-1">
          <div className="hud-label">
            <IconApple size={12} className="text-[#ff5d5d]" /> Pontos
          </div>
          <div className="hud-value text-xl text-[#ffd23f] sm:text-2xl">
            <span className="score-pop" key={snap.score}>
              {snap.score}
            </span>
          </div>
        </div>
        <div className="hud-panel min-w-[104px] flex-1">
          <div className="hud-label">
            <IconTrophy size={12} className="text-[#4dd6c1]" /> Recorde
          </div>
          <div className="hud-value text-xl text-[#4dd6c1] sm:text-2xl">{snap.best}</div>
        </div>
        <div className="hud-panel">
          <div className="hud-label">
            <IconBolt size={12} className="text-[#ffd23f]" /> Combo
          </div>
          <div className="flex h-[26px] items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} className={`pip ${snap.combo >= i ? "on" : ""}`} />
            ))}
          </div>
        </div>
        <div className="hud-panel hidden sm:block">
          <div className="hud-label">
            <IconStar size={12} className="text-[#6fe44e]" /> Modo
          </div>
          <div className="hud-value text-sm leading-[26px] text-[#eaf6e6]">
            {diffLabel} · Nv {snap.level}
          </div>
        </div>
      </div>

      {/* tabuleiro */}
      <main ref={stageRef} className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-3 pb-1">
        <div className="board-frame">
          <div
            className="board-inner scanlines"
            style={{ width: side, height: side }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <canvas ref={canvasRef} className="block" />

            {snap.phase === "menu" && (
              <div className="overlay">
                <div className="panel pop-in w-full max-w-[350px] p-4 text-center sm:p-5">
                  <h2 className="menu-title text-[32px] sm:text-[38px]">COBRINHA</h2>
                  <p className="tagline">Coma as maçãs, cresça e não bata nas paredes!</p>
                  {snap.best > 0 && (
                    <div className="best-line">
                      <IconTrophy size={13} /> Recorde: {snap.best}
                    </div>
                  )}

                  <div className="hud-label mt-3 mb-1.5 justify-center">Dificuldade</div>
                  <div className="flex gap-2">
                    {DIFFICULTIES.map((d) => (
                      <button
                        key={d.id}
                        className={`diff-btn ${snap.difficulty === d.id ? "active" : ""}`}
                        onClick={() => doDiff(d.id)}
                      >
                        <span className="font-display text-[11px]">{d.label}</span>
                        <span className="diff-dots">
                          {[0, 1, 2].map((i) => (
                            <i key={i} className={i < DIFF_INFO[d.id].speed ? "on" : ""} />
                          ))}
                        </span>
                        <span className="text-[10px] font-bold opacity-80">pontos ×{d.mult}</span>
                      </button>
                    ))}
                  </div>

                  <button className="btn-arcade btn-lime mt-4 w-full py-3 text-lg" onClick={doStart}>
                    <IconPlay size={20} /> JOGAR
                  </button>

                  {side >= 330 && (
                    <div className="guide mt-4">
                      <div>
                        <div className="guide-h">Teclado</div>
                        <span className="kbd">←↑↓→</span> ou <span className="kbd">WASD</span> movem ·{" "}
                        <span className="kbd">Espaço</span> pausa · <span className="kbd">R</span>{" "}
                        reinicia
                      </div>
                      <div>
                        <div className="guide-h">Toque</div>
                        Deslize no tabuleiro para guiar a cobra. Um toque rápido pausa ou continua.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {paused && (
              <div className="overlay">
                <div className="panel pop-in w-full max-w-[300px] p-5 text-center">
                  <IconPause size={30} className="mx-auto text-[#ffd23f]" />
                  <h2 className="title-gold mt-1 text-3xl">PAUSADO</h2>
                  <p className="tagline">Respira… a cobra espera.</p>
                  <div className="mt-4 flex flex-col gap-2.5">
                    <button className="btn-arcade btn-lime w-full py-2.5 text-base" onClick={doPause}>
                      <IconPlay size={18} /> CONTINUAR
                    </button>
                    <button className="btn-arcade btn-gold w-full py-2.5 text-base" onClick={doStart}>
                      <IconRestart size={18} /> REINICIAR
                    </button>
                    <button className="btn-arcade btn-ghost w-full py-2.5 text-base" onClick={doMenu}>
                      <IconHome size={18} /> MENU
                    </button>
                  </div>
                </div>
              </div>
            )}

            {snap.phase === "gameover" && (
              <div className="overlay">
                <div className="panel pop-in w-full max-w-[320px] p-5 text-center">
                  {snap.newRecord && (
                    <div className="record-badge">
                      <IconStar size={13} /> NOVO RECORDE!
                    </div>
                  )}
                  <h2 className={`mt-2 text-[27px] sm:text-3xl ${snap.win ? "title-gold" : "title-coral"}`}>
                    {snap.win ? "VOCÊ VENCEU!" : "FIM DE JOGO"}
                  </h2>
                  <div className="mt-2">
                    <div className="hud-label justify-center">Pontuação</div>
                    <div className="hud-value text-5xl text-[#ffd23f]">{snap.score}</div>
                  </div>
                  <div className="mt-2 flex items-center justify-center gap-5 text-[13px] font-extrabold text-[#9cc7ae]">
                    <span className="flex items-center gap-1.5">
                      <IconApple size={15} className="text-[#ff5d5d]" /> {snap.foods} maçãs
                    </span>
                    <span className="flex items-center gap-1.5">
                      <IconTrophy size={15} className="text-[#4dd6c1]" /> recorde {snap.best}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-col gap-2.5">
                    <button className="btn-arcade btn-lime w-full py-3 text-base" onClick={doStart}>
                      <IconRestart size={18} /> JOGAR DE NOVO
                    </button>
                    <button className="btn-arcade btn-ghost w-full py-2.5 text-base" onClick={doMenu}>
                      <IconHome size={18} /> MENU
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* rodapé: dicas ou d-pad */}
      <footer className="relative z-10 pt-1 pb-3">
        <div className="hint-row">
          <span className="kbd">←↑↓→</span>
          <span className="kbd">WASD</span> mover
          <span className="opacity-40">·</span>
          <span className="kbd">Espaço</span> pausar
          <span className="opacity-40">·</span>
          <span className="kbd">R</span> reiniciar
          <span className="opacity-40">·</span>
          <span className="kbd">M</span> som
        </div>
        <div className="dpad-wrap flex justify-center">
          <div className="dpad">
            <div />
            <button
              className="dpad-btn"
              aria-label="Cima"
              onPointerDown={(e) => {
                e.preventDefault();
                steer(0, -1);
              }}
            >
              <IconChevron dir="up" size={22} />
            </button>
            <div />
            <button
              className="dpad-btn"
              aria-label="Esquerda"
              onPointerDown={(e) => {
                e.preventDefault();
                steer(-1, 0);
              }}
            >
              <IconChevron dir="left" size={22} />
            </button>
            <button
              className="dpad-btn dpad-center"
              aria-label="Pausar ou iniciar"
              onPointerDown={(e) => {
                e.preventDefault();
                doPrimary();
              }}
            >
              {playing ? <IconPause size={20} /> : <IconPlay size={20} />}
            </button>
            <button
              className="dpad-btn"
              aria-label="Direita"
              onPointerDown={(e) => {
                e.preventDefault();
                steer(1, 0);
              }}
            >
              <IconChevron dir="right" size={22} />
            </button>
            <div />
            <button
              className="dpad-btn"
              aria-label="Baixo"
              onPointerDown={(e) => {
                e.preventDefault();
                steer(0, 1);
              }}
            >
              <IconChevron dir="down" size={22} />
            </button>
            <div />
          </div>
        </div>
      </footer>
    </div>
  );
}
