* { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --hot: #ff4b2b;
  --hot2: #ff416c;
  --gold: #ffd34d;
  --cyan: #00c6ff;
  --violet: #7a5cff;
  --glass: rgba(10, 12, 28, .62);
  --line: rgba(255, 255, 255, .14);
}

body {
  background:
    radial-gradient(ellipse at 50% -10%, #3a1d5c 0%, transparent 55%),
    radial-gradient(ellipse at 50% 120%, #4a1410 0%, transparent 50%),
    #06070d;
  font-family: "Rajdhani", "Segoe UI", Arial, sans-serif;
  color: #fff;
  height: 100vh;
  height: 100dvh;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: none;
  overscroll-behavior: none;
}
html { height: 100%; background: #06070d; }

/* Desktop: poori height, phone jaisa portrait frame */
#wrap {
  position: relative;
  height: 100vh;
  height: 100dvh;
  width: min(100vw, calc(100dvh * 0.5625));
  border-radius: 0;
  overflow: hidden;
  box-shadow:
    0 0 0 2px #1c1c2c,
    0 0 0 5px #0b0b14,
    0 20px 60px rgba(255, 75, 43, .28),
    0 0 120px rgba(122, 92, 255, .18);
}

canvas#game { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }

/* Phone / tablet: bilkul full screen, koi border nahi */
@media (max-width: 600px), (pointer: coarse) {
  #wrap { width: 100vw; box-shadow: none; }
}

#vignette {
  position: absolute; inset: 0; pointer-events: none; z-index: 4;
  background: radial-gradient(ellipse at 50% 55%, transparent 55%, rgba(0, 0, 0, .55) 100%);
}

/* ---------- HUD ---------- */
#hud {
  position: absolute; top: calc(10px + env(safe-area-inset-top)); left: 10px; right: 10px;
  display: flex; gap: 6px; z-index: 5;
}
#hud .box {
  flex: 1;
  background: var(--glass);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 5px 6px 4px;
  text-align: center;
  backdrop-filter: blur(6px);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08);
}
#hud .box.speed { flex: 1.25; border-color: rgba(255, 75, 43, .45); }
#hud span {
  display: block; font-size: 10px; font-weight: 700; letter-spacing: 2px; color: var(--gold);
}
#hud b {
  font-family: "Orbitron", "Segoe UI", sans-serif; font-weight: 800;
  font-size: 18px; line-height: 1.2; text-shadow: 0 0 10px rgba(255, 255, 255, .25);
}
#hud small { font-size: 10px; margin-left: 3px; color: #aaa; font-weight: 600; }

/* Fuel + Nitro bars */
#bars {
  position: absolute; top: calc(66px + env(safe-area-inset-top)); left: 10px; right: 10px;
  display: flex; gap: 6px; z-index: 5;
}
.bar {
  position: relative; flex: 1; height: 18px;
  background: rgba(0, 0, 0, .65); border-radius: 10px; overflow: hidden;
  border: 1px solid var(--line);
}
.bar span {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: 11px; letter-spacing: 2px; font-weight: 700; text-shadow: 0 1px 3px #000;
}
#fuelBar, #nitroBar {
  height: 100%; width: 100%; transition: width .1s linear; border-radius: 10px;
  box-shadow: inset 0 -4px 0 rgba(0, 0, 0, .18), inset 0 3px 0 rgba(255, 255, 255, .25);
}
#fuelBar  { background: linear-gradient(90deg, #ff3b3b, #ffd34d, #2ecc71); }
#nitroBar { background: linear-gradient(90deg, var(--cyan), var(--violet), #ff2fd6); }
#fuelWrap.low { animation: blink .4s infinite alternate; border-color: #ff3b3b; }

/* Pillion chip */
#pillion {
  position: absolute; top: calc(92px + env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); z-index: 5;
  display: flex; align-items: center; gap: 8px;
  padding: 5px 14px 5px 8px; border-radius: 30px;
  background: linear-gradient(135deg, rgba(255, 79, 163, .85), rgba(122, 92, 255, .85));
  border: 1px solid rgba(255, 255, 255, .35);
  box-shadow: 0 4px 18px rgba(255, 79, 163, .45);
  animation: pop .35s ease-out;
}
#pillion i { font-style: normal; font-size: 22px; }
#pillion b { display: block; font-size: 12px; letter-spacing: 1.5px; }
#pillion small { font-size: 11px; font-weight: 600; opacity: .9; }
#pillion em { font-style: normal; font-family: "Orbitron", sans-serif; font-size: 11px; }

/* ---------- Overlays ---------- */
.overlay {
  position: absolute; inset: 0; z-index: 10;
  display: flex; flex-direction: column; justify-content: center; align-items: center;
  gap: 12px; text-align: center;
  padding: calc(18px + env(safe-area-inset-top)) 18px calc(18px + env(safe-area-inset-bottom));
  overflow-y: auto;
  background:
    linear-gradient(180deg, rgba(5, 6, 15, .55), rgba(5, 6, 15, .92) 65%);
  backdrop-filter: blur(4px);
}
.hidden { display: none !important; }

.logo .tag { font-size: 11px; letter-spacing: 5px; color: #9aa0c3; font-weight: 600; }
h1 {
  font-family: "Orbitron", "Segoe UI", sans-serif; font-weight: 900;
  font-size: 50px; line-height: .95; letter-spacing: 3px; font-style: italic;
  background: linear-gradient(180deg, #ffffff 30%, #ffb199);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 0 16px rgba(255, 75, 43, .6));
}
h1 em {
  display: block; font-size: 30px; letter-spacing: 4px;
  background: linear-gradient(90deg, var(--hot2), var(--hot), var(--gold));
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
h2 {
  font-family: "Orbitron", "Segoe UI", sans-serif; font-weight: 900;
  font-size: 34px; color: var(--hot); text-shadow: 0 0 18px rgba(255, 75, 43, .8); letter-spacing: 2px;
}

.best {
  color: var(--gold); letter-spacing: 3px; font-weight: 700; font-size: 15px;
  padding: 3px 14px; border-radius: 20px; border: 1px solid rgba(255, 211, 77, .35);
  background: rgba(255, 211, 77, .08);
}
.best b { font-family: "Orbitron", sans-serif; margin-left: 4px; }
.choose { font-size: 12px; letter-spacing: 5px; color: #aab; font-weight: 700; }
#newBest {
  color: var(--gold); font-size: 22px; font-weight: 700; letter-spacing: 2px;
  animation: pulse .7s infinite alternate;
}

/* Panels (pause / game over) */
.panel {
  width: 100%; max-width: 340px;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  padding: 22px 18px;
  background: linear-gradient(160deg, rgba(30, 32, 60, .92), rgba(12, 12, 24, .95));
  border: 1px solid var(--line); border-radius: 20px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, .6), inset 0 1px 0 rgba(255, 255, 255, .08);
  animation: pop .35s ease-out;
}
.results { width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.results div {
  background: rgba(255, 255, 255, .05); border: 1px solid var(--line);
  border-radius: 12px; padding: 8px 4px;
}
.results span { display: block; font-size: 10px; letter-spacing: 2px; color: #9aa0c3; font-weight: 700; }
.results b { font-family: "Orbitron", sans-serif; font-size: 18px; }
.results em { font-style: normal; }

/* Bike select cards */
#bikeSelect { display: flex; gap: 8px; width: 100%; }
.bike-card {
  flex: 1; padding: 8px 6px 10px; border-radius: 14px; color: #fff;
  font-family: inherit;
  background: linear-gradient(180deg, rgba(255, 255, 255, .08), rgba(255, 255, 255, .02));
  border: 2px solid rgba(255, 255, 255, .12);
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  transition: transform .15s, border-color .15s, box-shadow .15s;
}
.bike-card canvas {
  width: 72px; height: 94px;
  background: radial-gradient(circle at 50% 55%, rgba(255, 255, 255, .12), transparent 70%);
  border-radius: 10px;
}
.bike-card:hover { transform: translateY(-3px); }
.bike-card.active {
  border-color: var(--hot); background: linear-gradient(180deg, rgba(255, 75, 43, .25), rgba(255, 75, 43, .05));
  box-shadow: 0 0 18px rgba(255, 75, 43, .45);
}
.bike-card b { font-size: 13px; letter-spacing: 1.5px; }
.stat { width: 100%; display: flex; align-items: center; gap: 4px; font-size: 10px; color: #bbc; font-weight: 600; }
.stat span { width: 40px; text-align: left; }
.stat .track { flex: 1; height: 5px; background: #2a2a3a; border-radius: 3px; overflow: hidden; }
.stat i { display: block; height: 100%; background: linear-gradient(90deg, #ff9f1c, var(--hot)); border-radius: 3px; }

button { cursor: pointer; border: none; outline: none; font-weight: 700; letter-spacing: 2px; font-family: inherit; }
#startBtn, #restartBtn {
  padding: 13px 38px; font-size: 18px; border-radius: 40px; color: #fff;
  font-family: "Orbitron", sans-serif; font-weight: 800;
  background: linear-gradient(135deg, var(--hot2), var(--hot));
  box-shadow: 0 6px 22px rgba(255, 75, 43, .55), inset 0 2px 0 rgba(255, 255, 255, .25);
  transition: transform .15s;
  animation: glow 1.6s ease-in-out infinite alternate;
}
#startBtn:hover, #restartBtn:hover { transform: scale(1.07); }
.ghost {
  padding: 9px 22px; border-radius: 30px; color: #ccd;
  background: transparent; border: 1px solid #555a7a; font-size: 13px;
}
.ghost:hover { border-color: #aab; color: #fff; }

.help { font-size: 13px; color: #ccd; line-height: 1.9; font-weight: 600; }
.tips {
  margin-top: 6px; padding: 8px 10px; border-radius: 12px; text-align: left;
  background: rgba(255, 255, 255, .05); border: 1px solid var(--line);
}
.tips p { color: var(--gold); font-size: 12px; line-height: 1.5; }
kbd {
  font-family: "Orbitron", sans-serif;
  background: #23263f; border: 1px solid #555a7a; border-bottom-width: 3px;
  border-radius: 5px; padding: 1px 6px; font-size: 10px; margin: 0 2px;
}

/* Touch controls (only on touch screens) */
#touch {
  position: absolute; bottom: calc(12px + env(safe-area-inset-bottom)); left: 10px; right: 10px; z-index: 6;
  display: none; justify-content: space-between; gap: 6px;
}
#touch button {
  flex: 1; height: 68px; touch-action: none; font-size: 22px; color: #fff; border-radius: 14px;
  background: rgba(15, 16, 32, .55); border: 1px solid rgba(255, 255, 255, .25);
  backdrop-filter: blur(4px);
}
#touch button.nitro { background: rgba(122, 92, 255, .55); font-size: 16px; }
#touch button:active { background: rgba(255, 75, 43, .65); }
@media (pointer: coarse) { #touch { display: flex; } }

/* Gyro steering: left = BRAKE, right = GAS (bade buttons), beech mein Nitro */
#touch button.pedal { flex: 1.6; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; }
#touch button.pedal small { font-size: 11px; letter-spacing: 2px; margin-top: 4px; font-weight: 700; }
#touch button.brake { background: rgba(255, 59, 59, .35); border-color: rgba(255, 120, 120, .5); }
#touch button.gas { background: rgba(46, 204, 113, .35); border-color: rgba(120, 255, 170, .5); }
#touch button.brake:active { background: rgba(255, 59, 59, .7); }
#touch button.gas:active { background: rgba(46, 204, 113, .7); }
#touch button.steer { display: none; }
/* gyro na ho to purane ◀ ▶ wapas */
#touch.nogyro button.steer { display: block; }
#touch.nogyro button.pedal { flex: 1; }

/* ---------- Home page: 3 modes ---------- */
#modeSelect { display: flex; flex-direction: column; gap: 10px; width: 100%; max-width: 360px; }
.mode-card {
  display: flex; align-items: center; gap: 12px; padding: 14px 14px; border-radius: 16px;
  color: #fff; text-align: left; font-family: inherit; letter-spacing: 1px;
  background: linear-gradient(135deg, rgba(255, 255, 255, .09), rgba(255, 255, 255, .02));
  border: 2px solid rgba(255, 255, 255, .14);
  transition: transform .15s, border-color .15s, box-shadow .15s;
}
.mode-card:hover, .mode-card:active {
  transform: translateY(-2px); border-color: var(--hot);
  box-shadow: 0 0 18px rgba(255, 75, 43, .45);
}
.mode-card i { font-style: normal; font-size: 20px; width: 56px; flex-shrink: 0; text-align: center; letter-spacing: -2px; white-space: nowrap; }
.mode-card div { flex: 1; }
.mode-card b { display: block; font-family: "Orbitron", sans-serif; font-size: 17px; font-weight: 800; letter-spacing: 2px; }
.mode-card small { display: block; font-size: 12px; color: #bbc; font-weight: 600; letter-spacing: .5px; margin-top: 2px; }
.mode-card em { font-style: normal; font-size: 12px; color: var(--gold); font-weight: 700; white-space: nowrap; }
.mode-card[data-mode="racing"] { border-color: rgba(255, 211, 77, .35); }

.mode-chip {
  font-family: "Orbitron", sans-serif; font-size: 13px; font-weight: 800; letter-spacing: 3px;
  color: #fff; padding: 4px 16px; border-radius: 20px;
  background: linear-gradient(135deg, var(--hot2), var(--violet));
}
.ghost.back {
  position: absolute; top: calc(12px + env(safe-area-inset-top)); left: 12px; z-index: 2;
  padding: 7px 14px; font-size: 12px;
}
#installBtn { margin-top: 4px; }

.touch-only { display: none; }
@media (pointer: coarse) { .touch-only { display: block; } }

@media (max-width: 400px) {
  h1 { font-size: 40px; } h1 em { font-size: 24px; }
  .help { font-size: 12px; }
}

@keyframes pulse { from { transform: scale(1); } to { transform: scale(1.12); } }
@keyframes blink { from { opacity: 1; } to { opacity: .35; } }
@keyframes pop { from { transform: scale(.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
#pillion { animation-name: popc; }
@keyframes popc { from { transform: translateX(-50%) scale(.7); opacity: 0; } to { transform: translateX(-50%) scale(1); opacity: 1; } }
@keyframes glow {
  from { box-shadow: 0 6px 22px rgba(255, 75, 43, .45), inset 0 2px 0 rgba(255, 255, 255, .25); }
  to   { box-shadow: 0 6px 34px rgba(255, 75, 43, .85), inset 0 2px 0 rgba(255, 255, 255, .25); }
}

/* Phone par keyboard hints ki zarurat nahi */
@media (pointer: coarse) { .help > p { display: none; } }
/* ================= v5: Settings, Pause button, UX polish ================= */
/* In-game pause button (phone par P key nahi hoti) */
#pauseBtn {
  position: absolute; z-index: 7;
  top: calc(96px + env(safe-area-inset-top)); right: 10px;
  width: 40px; height: 40px; border-radius: 12px;
  font-size: 13px; letter-spacing: -1px; color: #fff;
  background: rgba(10, 12, 28, .62); border: 1px solid var(--line);
  backdrop-filter: blur(6px);
}
#pauseBtn:active { transform: scale(.94); }

/* Gear (settings) button – home / bike select */
.icon-btn {
  position: absolute; top: calc(12px + env(safe-area-inset-top)); right: 12px; z-index: 2;
  width: 40px; height: 40px; border-radius: 12px; font-size: 20px; letter-spacing: 0;
  color: #fff; background: rgba(255, 255, 255, .08); border: 1px solid rgba(255, 255, 255, .22);
  display: flex; align-items: center; justify-content: center;
  transition: transform .2s, background .2s;
}
.icon-btn:hover, .icon-btn:active { transform: rotate(45deg); background: rgba(255, 75, 43, .35); }

/* Pause panel buttons */
#resumeBtn, #setDone {
  padding: 12px 34px; font-size: 16px; border-radius: 40px; color: #fff;
  font-family: "Orbitron", sans-serif; font-weight: 800;
  background: linear-gradient(135deg, var(--hot2), var(--hot));
  box-shadow: 0 6px 22px rgba(255, 75, 43, .5), inset 0 2px 0 rgba(255, 255, 255, .25);
}
.row-btns { display: flex; gap: 8px; }
.row-btns .ghost { font-size: 12px; padding: 9px 16px; }

/* Settings overlay (sabse upar) */
#settingsScreen { z-index: 20; justify-content: flex-start; }
#settingsScreen .panel { margin: auto 0; max-width: 380px; gap: 10px; text-align: left; align-items: stretch; }
#settingsScreen h2 { text-align: center; font-size: 28px; }
.set-group {
  background: rgba(255, 255, 255, .04); border: 1px solid var(--line); border-radius: 14px;
  padding: 10px 12px; display: flex; flex-direction: column; gap: 8px;
}
.set-group.disabled { opacity: .4; pointer-events: none; }
.set-title { font-size: 12px; letter-spacing: 2.5px; font-weight: 700; color: var(--gold); }
.set-note { font-size: 12px; color: #aab; font-weight: 600; }
.set-note.ok { color: #2ecc71; min-height: 14px; }
.set-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 14px; font-weight: 600; }
.set-row span { white-space: nowrap; }
.set-row small { color: var(--cyan); font-family: "Orbitron", sans-serif; font-size: 11px; margin-left: 4px; }
.set-row input[type=range] { flex: 1; max-width: 170px; accent-color: var(--hot); height: 24px; }

/* Segmented control */
.seg { display: flex; background: rgba(0, 0, 0, .35); border-radius: 12px; padding: 4px; gap: 4px; }
.seg button {
  flex: 1; padding: 9px 6px; border-radius: 9px; font-size: 12px; letter-spacing: 1px;
  color: #ccd; background: transparent;
}
.seg button.active { color: #fff; background: linear-gradient(135deg, var(--hot2), var(--hot)); box-shadow: 0 3px 12px rgba(255, 75, 43, .45); }

/* Toggle switch */
.set-row.toggle { cursor: pointer; }
.set-row.toggle input { display: none; }
.set-row.toggle i {
  position: relative; width: 44px; height: 24px; border-radius: 20px; background: #3a3d55; flex-shrink: 0;
  transition: background .2s;
}
.set-row.toggle i::after {
  content: ""; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%;
  background: #fff; transition: transform .2s;
}
.set-row.toggle input:checked + i { background: linear-gradient(135deg, var(--hot2), var(--hot)); }
.set-row.toggle input:checked + i::after { transform: translateX(20px); }

/* Live tilt meter */
.tilt-meter {
  position: relative; height: 26px; border-radius: 14px;
  background: linear-gradient(90deg, rgba(0, 198, 255, .25), rgba(255, 255, 255, .04) 45%, rgba(255, 255, 255, .04) 55%, rgba(255, 75, 43, .25));
  border: 1px solid var(--line);
}
.tilt-meter .mid { position: absolute; left: 50%; top: 4px; bottom: 4px; width: 2px; background: rgba(255, 255, 255, .35); }
.tilt-meter i {
  position: absolute; top: 3px; left: 50%; width: 18px; height: 18px; margin-left: -9px; border-radius: 50%;
  background: #889; box-shadow: 0 0 0 3px rgba(255, 255, 255, .1); transition: left .06s linear;
}
.tilt-meter i.on { background: var(--gold); box-shadow: 0 0 12px var(--gold); }
.tilt-meter em, .tilt-meter b { position: absolute; top: 5px; font-size: 11px; font-style: normal; color: #aab; font-family: "Orbitron", sans-serif; }
.tilt-meter em { left: 8px; } .tilt-meter b { right: 8px; }
.ghost.wide { width: 100%; font-size: 12px; letter-spacing: 1px; }

/* Touch buttons: press feedback + better look */
#touch button { transition: transform .08s, background .12s; box-shadow: 0 6px 18px rgba(0, 0, 0, .35), inset 0 1px 0 rgba(255, 255, 255, .15); }
#touch button:active { transform: scale(.95); }
#touch button.pedal { font-size: 24px; }

/* ================= v6: HUD (mobile racing game style) + camera button ================= */
#hud {
  display: grid; grid-auto-flow: column; grid-template-rows: auto auto;
  grid-template-columns: max-content max-content; justify-content: space-between;
  gap: 6px 8px; right: 58px;
}
#hud .box, #hud .box.speed {
  display: flex; align-items: center; gap: 8px; flex: none;
  padding: 4px 12px 4px 10px; border-radius: 20px; min-width: 112px;
  background: rgba(8, 10, 18, .58); border: 1px solid rgba(255, 255, 255, .16);
  text-align: left;
}
#hud .box.speed { border-color: rgba(0, 198, 255, .45); }
#hud span { font-size: 9px; letter-spacing: 1.5px; min-width: 44px; }
#hud b { font-size: 17px; line-height: 1.25; }
#hud small { margin-left: 0; }
#bars { top: calc(84px + env(safe-area-inset-top)); right: 58px; }
.bar { height: 14px; }
.bar span { font-size: 9.5px; }
#pillion { top: calc(108px + env(safe-area-inset-top)); }
#pauseBtn { top: calc(10px + env(safe-area-inset-top)); width: 42px; height: 42px; }
#camBtn {
  position: absolute; z-index: 7;
  top: calc(60px + env(safe-area-inset-top)); right: 10px;
  width: 42px; height: 42px; border-radius: 12px; font-size: 18px; letter-spacing: 0;
  color: #fff; background: rgba(8, 10, 18, .58); border: 1px solid rgba(255, 255, 255, .16);
  backdrop-filter: blur(6px);
}
#camBtn:active { transform: scale(.94); }
@media (max-width: 360px) {
  #hud .box, #hud .box.speed { min-width: 96px; padding: 3px 9px; }
  #hud b { font-size: 15px; }
}
