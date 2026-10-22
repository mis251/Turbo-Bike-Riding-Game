// ================== TURBO BIKE RUSH v4 ==================
// Features: 3 bikes, two-way traffic, fuel system, nitro, near-miss bonus
// v3: 3 modes (One Way / Two Way / Racing), phone tilt (gyro) steering,
//     auto full screen, auto pause, PWA install
// v4: 3D road view (bike ke peeche se camera), road par mod (curves) + chadhaai-utaar (hills)
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width;
let H = canvas.height;          // screen ke hisaab se badlega (full screen)
let treeSpan = 800;
// touch phone par neeche buttons hote hain, isliye bike thodi upar
const playerY = () => H - (matchMedia("(pointer: coarse)").matches ? 210 : 170);
const wrapEl = document.getElementById("wrap");

// Canvas ko phone ki screen ke ratio par set karo — game stretch nahi hoga
function resizeGame() {
  const r = wrapEl.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const newH = Math.round(Math.max(600, Math.min(1200, W * r.height / r.width)));
  if (newH === H && canvas.height === newH) return;
  H = newH;
  canvas.height = H;
  if (typeof player !== "undefined" && player) player.y = playerY();
  if (typeof trees !== "undefined") buildTrees();
}
addEventListener("resize", resizeGame);
addEventListener("orientationchange", () => setTimeout(resizeGame, 300));
document.addEventListener("fullscreenchange", () => setTimeout(resizeGame, 100));
const TAU = Math.PI * 2;

// Road: lane 0,1 = oncoming (saamne se), lane 2,3 = same direction
const ROAD_L = 60, ROAD_R = 420, LANES = 4;
const LANE_W = (ROAD_R - ROAD_L) / LANES;
const laneX = i => ROAD_L + LANE_W * i + LANE_W / 2;
const isOncoming = lane => mode === "twoway" && lane < 2;   // One Way / Racing: sab same direction

// ================== MODES ==================
const MODES = {
  oneway: { name: "ONE WAY" },
  twoway: { name: "TWO WAY" },
  racing: { name: "RACING" },
};
let mode = "twoway";
const RACE_DIST = 4000;          // Racing mode: 4 km
const RIVAL_NAMES = ["RAJU", "VICKY", "SONU"];
const bestKey = m => (m === "twoway" ? "bikeBest" : "bikeBest_" + m);   // purana Two Way best same rahega

// ================== BIKES ==================
const BIKES = [
  { name: "RED NINJA",   color: "#e63946", accent: "#ffffff", suit: "#1d3557", helmet: "#f1faee",
    top: 900,  accel: 400, handling: 1.0,  tank: 100, eff: 1.0,
    stats: { speed: 70, grip: 70, tank: 65 } },
  { name: "BLUE STORM",  color: "#1e88e5", accent: "#ffd34d", suit: "#222222", helmet: "#ffd34d",
    top: 1020, accel: 470, handling: 0.88, tank: 80,  eff: 1.2,
    stats: { speed: 95, grip: 55, tank: 45 } },
  { name: "GREEN BEAST", color: "#2ecc71", accent: "#111111", suit: "#3d2b1f", helmet: "#111111",
    top: 820,  accel: 360, handling: 1.15, tank: 135, eff: 0.85,
    stats: { speed: 55, grip: 90, tank: 95 } },
];

// ================== UI ==================
const $ = id => document.getElementById(id);
const ui = {
  score: $("score"), speed: $("speed"), coins: $("coins"), level: $("level"),
  nitro: $("nitroBar"), fuel: $("fuelBar"), fuelWrap: $("fuelWrap"),
  start: $("startScreen"), over: $("overScreen"), pause: $("pauseScreen"),
  overTitle: $("overTitle"), finalScore: $("finalScore"), finalDist: $("finalDist"),
  bestStart: $("bestStart"), bestOver: $("bestOver"), newBest: $("newBest"),
  pillion: $("pillion"), pillionDist: $("pillionDist"), finalLifts: $("finalLifts"),
  home: $("homeScreen"), levelLabel: $("levelLabel"), modeName: $("modeName"),
  tipOncoming: $("tipOncoming"), tipRace: $("tipRace"), touch: $("touch"),
};

// Lift maangne wali passengers ke looks (random)
const RIDERS = [
  { dress: "#ff4fa3", hair: "#2b1a12", dupatta: "#ffe066", skin: "#f1c27d" },
  { dress: "#9b5de5", hair: "#120c08", dupatta: "#ff9ecf", skin: "#e0ac69" },
  { dress: "#ffbe0b", hair: "#4a2c17", dupatta: "#ff5d8f", skin: "#f1c27d" },
  { dress: "#00bbf9", hair: "#1a0f0a", dupatta: "#fff3b0", skin: "#c68642" },
];

let best = 0, selected = 0;
const loadBest = m => { try { return +localStorage.getItem(bestKey(m)) || 0; } catch (e) { return 0; } };
try {
  best = loadBest(mode);
  selected = +localStorage.getItem("bikeSel") || 0;
} catch (e) {}
if (!BIKES[selected]) selected = 0;
ui.bestStart.textContent = best;

function renderBikeSelect() {
  const el = $("bikeSelect");
  el.innerHTML = "";
  BIKES.forEach((b, i) => {
    const card = document.createElement("button");
    card.className = "bike-card" + (i === selected ? " active" : "");
    const stat = (label, v) =>
      `<div class="stat"><span>${label}</span><div class="track"><i style="width:${v}%"></i></div></div>`;
    card.innerHTML = `<canvas width="72" height="94"></canvas><b>${b.name}</b>` +
      stat("SPEED", b.stats.speed) + stat("GRIP", b.stats.grip) + stat("TANK", b.stats.tank);
    card.onclick = () => {
      selected = i;
      try { localStorage.setItem("bikeSel", i); } catch (e) {}
      renderBikeSelect();
    };
    el.appendChild(card);
    const g = card.querySelector("canvas").getContext("2d");
    g.save(); g.translate(36, 90); g.scale(1.02, 1.02);
    drawBikeRear(g, b, { tilt: 0, wheel: 0 });
    g.restore();
  });
}

// ================== INPUT ==================
const keys = {};
addEventListener("keydown", e => {
  keys[e.code] = true;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
  if (e.code === "KeyP" && (state === "play" || state === "pause")) togglePause();
  if (e.code === "KeyM") toggleMute();
  if (e.code === "Enter" && (state === "menu" || state === "over") && ui.home.classList.contains("hidden")) startGame();
});
addEventListener("keyup", e => (keys[e.code] = false));

document.querySelectorAll("#touch button").forEach(b => {
  const k = b.dataset.key;
  b.addEventListener("pointerdown", e => { e.preventDefault(); keys[k] = true; });
  ["pointerup", "pointerleave", "pointercancel"].forEach(ev =>
    b.addEventListener(ev, () => (keys[k] = false)));
});

// ---------- GYRO STEERING (phone tilt) ----------
// Phone ko left/right jhukao = bike left/right. Buttons sirf Brake / Nitro / Gas.
// Agar phone mein gyro sensor nahi hai ya permission nahi mili, to ◀ ▶ buttons wapas aa jayenge.
let tiltSteer = 0, gyroOn = false, gyroAsked = false;
const TILT_DEAD = 3, TILT_FULL = 22;      // degrees: 3° tak kuch nahi, 22° par full steer
function onTilt(e) {
  if (e.gamma == null) return;
  gyroOn = true;
  ui.touch.classList.remove("nogyro");
  let g = e.gamma;                          // portrait: left/right tilt
  const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
  if (ang === 90) g = e.beta; else if (ang === -90 || ang === 270) g = -e.beta; else if (ang === 180) g = -e.gamma;
  const a = Math.min(1, Math.max(0, (Math.abs(g) - TILT_DEAD) / (TILT_FULL - TILT_DEAD)));
  tiltSteer = Math.sign(g) * a;
}
function enableGyro() {
  if (gyroAsked) return;
  gyroAsked = true;
  const D = window.DeviceOrientationEvent;
  if (!D) return;
  if (typeof D.requestPermission === "function") {        // iPhone: permission maangna padta hai
    D.requestPermission()
      .then(s => { if (s === "granted") addEventListener("deviceorientation", onTilt); })
      .catch(() => {});
  } else {
    addEventListener("deviceorientation", onTilt);
  }
}

const left = () => keys.ArrowLeft || keys.KeyA;
const right = () => keys.ArrowRight || keys.KeyD;
const gas = () => keys.ArrowUp || keys.KeyW;
const brake = () => keys.ArrowDown || keys.KeyS;
const nitroKey = () => keys.Space || keys.ShiftLeft || keys.ShiftRight;

// ================== SOUND ==================
let audio, engineOsc, engineGain, muted = false;
function initAudio() {
  if (audio) return;
  audio = new (window.AudioContext || window.webkitAudioContext)();
  engineOsc = audio.createOscillator();
  engineGain = audio.createGain();
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass"; filter.frequency.value = 900;
  engineOsc.type = "sawtooth";
  engineOsc.connect(filter).connect(engineGain).connect(audio.destination);
  engineGain.gain.value = 0;
  engineOsc.start();
}
function beep(freq, dur, type = "square", vol = 0.08) {
  if (!audio || muted) return;
  const o = audio.createOscillator(), g = audio.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
  o.connect(g).connect(audio.destination);
  o.start(); o.stop(audio.currentTime + dur);
}
function crashSound() {
  if (!audio || muted) return;
  const len = audio.sampleRate * 0.6;
  const buf = audio.createBuffer(1, len, audio.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = audio.createBufferSource(), g = audio.createGain();
  g.gain.value = 0.4; src.buffer = buf;
  src.connect(g).connect(audio.destination); src.start();
}
function toggleMute() { muted = !muted; if (engineGain) engineGain.gain.value = 0; }

// ================== GAME STATE ==================
let state = "menu";
let bike, player, traffic, pickups, particles, trees, texts;
let speed, distance, coins, bonus, nitro, fuel, level, roadOffset, wheelAnim;
let spawnTimer, coinTimer, nitroTimer, fuelTimer, lowFuelBeep, shake, boosting, braking;
let girlTimer, pillion, lifts, animT = 0;
let rivals = [], raceCount = 0, finishCount = 0, place = 0;   // Racing mode
const LIFT_DIST = 700;   // kitne meter baad passenger utregi

const CAR_COLORS = ["#e63946", "#457b9d", "#f4a261", "#2a9d8f", "#9b5de5", "#f1fa3c", "#ffffff", "#8d99ae"];

function buildTrees() {
  trees = [];
  const n = Math.ceil((H + 160) / 80);
  treeSpan = n * 80;
  for (let i = 0; i < n; i++) {
    trees.push({ side: 0, y: i * 80 - 80, s: 0.7 + Math.random() * 0.5 });
    trees.push({ side: 1, y: i * 80 - 40, s: 0.7 + Math.random() * 0.5 });
  }
}

function reset() {
  bike = BIKES[selected];
  player = { x: laneX(2), y: playerY(), vx: 0, w: 32, h: 86, tilt: 0 };
  traffic = []; pickups = []; particles = []; texts = [];
  buildTrees();
  speed = 300; distance = 0; coins = 0; bonus = 0; level = 1;
  nitro = 50; fuel = bike.tank;
  roadOffset = 0; wheelAnim = 0; shake = 0; boosting = false; braking = false;
  spawnTimer = 0.5; coinTimer = 2; nitroTimer = 8; fuelTimer = 6; lowFuelBeep = 0;
  girlTimer = 14 + Math.random() * 10;   // pehli lift jaldi, phir rare
  pillion = null; lifts = 0;
  if (ui.pillion) ui.pillion.classList.add("hidden");

  // Racing: 3 auto bikes ke saath start grid + 3-2-1 countdown
  rivals = []; finishCount = 0; place = 0; raceCount = 0;
  if (mode === "racing") {
    speed = 0;
    raceCount = 3.6;
    const others = BIKES.filter((_, i) => i !== selected);
    others.push({ name: "YELLOW FLASH", color: "#ffbe0b", accent: "#111111", suit: "#2d1b4e", helmet: "#111111",
                  top: 950, accel: 420 });
    [0, 1, 3].forEach((lane, i) => {
      const rb = others[i];
      rivals.push({
        name: RIVAL_NAMES[i], bike: rb, lane, x: laneX(lane), dist: 0, speed: 150,
        top: rb.top, accel: rb.accel, skill: 0.9 + Math.random() * 0.1,
        boost: 0, boostCd: 4 + Math.random() * 6, laneCd: 0, bumpCd: 0, tilt: 0, finished: false,
      });
    });
  }
}

// ---------- Racing: auto bikes (AI) ----------
const rivalY = r => player.y - (r.dist - distance) * 10;
const laneBusy = (l, y, self) =>
  traffic.some(c => c.lane === l && Math.abs(c.y - y) < 190) ||
  rivals.some(o => o !== self && o.lane === l && Math.abs(rivalY(o) - y) < 110);

function updateRivals(dt) {
  for (const r of rivals) {
    r.bumpCd -= dt; r.laneCd -= dt; r.boostCd -= dt;
    if (r.finished) { r.dist += r.speed * dt / 10; continue; }
    const ry = rivalY(r);

    // speed target (rubber band: zyada aage ho to thoda dheere, peeche ho to thoda tez)
    let aim = r.top * r.skill + level * 20;
    const gap = r.dist - distance;
    if (gap > 250) aim *= 0.9; else if (gap < -250) aim *= 1.1;
    if (r.boostCd <= 0 && r.boost <= 0) { r.boost = 1.4; r.boostCd = 7 + Math.random() * 8; }
    if (r.boost > 0) { aim += 380; r.boost -= dt; }

    // aage gaadi hai to lane badlo, warna dheere ho jao
    const blocker = traffic.find(c => c.lane === r.lane && c.y < ry && ry - c.y < 240);
    if (blocker) {
      const opts = [r.lane - 1, r.lane + 1].filter(l => l >= 0 && l < LANES && !laneBusy(l, ry, r));
      if (opts.length && r.laneCd <= 0) { r.lane = opts[Math.floor(Math.random() * opts.length)]; r.laneCd = 0.7; }
      else aim = Math.min(aim, blocker.speed * 0.95);
    }

    const diff = aim - r.speed;
    r.speed += Math.sign(diff) * Math.min(Math.abs(diff), (diff > 0 ? r.accel : 700) * dt);
    const tx = laneX(r.lane);
    r.tilt = (tx - r.x) / 90;
    r.x += (tx - r.x) * Math.min(1, 4 * dt);
    r.dist += r.speed * dt / 10;

    // agar phir bhi gaadi se takra gayi to bas slow ho jayegi (AI crash nahi hoti)
    for (const c of traffic) {
      if (Math.abs(c.x - r.x) < (c.w + 30) / 2 && Math.abs(c.y - ry) < (c.h + 80) / 2) r.speed = Math.min(r.speed, c.speed * 0.8);
    }

    // player se takkar = dono ko jhatka (game over nahi)
    if (r.bumpCd <= 0 && Math.abs(r.x - player.x) < 30 && Math.abs(ry - player.y) < 72) {
      const s = Math.sign(player.x - r.x) || 1;
      player.vx = s * 260; r.x -= s * 8;
      if (ry < player.y) speed = Math.max(150, speed - 160); else r.speed *= 0.85;
      shake = Math.max(shake, 5); r.bumpCd = 0.5;
      beep(160, 0.12, "square", 0.08);
    }

    if (r.dist >= RACE_DIST) { r.finished = true; r.place = ++finishCount; }
  }
}

const racePos = () => 1 + rivals.filter(r => r.finished || r.dist > distance).length;
const ordinal = n => n + (n === 1 ? "ST" : n === 2 ? "ND" : n === 3 ? "RD" : "TH");

// Mobile par full screen (browser bar chhup jayega)
const isTouch = matchMedia("(pointer: coarse)").matches;
function goFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (req && !(document.fullscreenElement || document.webkitFullscreenElement)) {
    try {
      const p = req.call(el, { navigationUI: "hide" });
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  }
  try { screen.orientation && screen.orientation.lock && screen.orientation.lock("portrait").catch(() => {}); } catch (e) {}
}
let fsManualOff = false;           // user ne khud ⛶ se band kiya to dobara zabardasti nahi
function toggleFullscreen() {
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    fsManualOff = true;
    (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  } else { fsManualOff = false; goFullscreen(); }
}
// AUTO FULL SCREEN: phone par screen ko kahin bhi pehli baar touch karte hi full screen
// (browser bina touch ke full screen allow nahi karta, isliye pehla touch zaroori hai)
if (isTouch) {
  document.addEventListener("pointerdown", e => {
    if (!gyroAsked) enableGyro();
    if (fsManualOff) return;
    if (!(document.fullscreenElement || document.webkitFullscreenElement)) goFullscreen();
  }, true);
}
const fsBtn = document.getElementById("fsBtn");
if (fsBtn) fsBtn.onclick = toggleFullscreen;
addEventListener("keydown", e => { if (e.code === "KeyF") toggleFullscreen(); });

function startGame() {
  if (isTouch) {
    if (!fsManualOff) goFullscreen();
    enableGyro();
    // 1.5 sec mein gyro ka data nahi aaya to ◀ ▶ buttons dikha do
    setTimeout(() => { if (!gyroOn) ui.touch.classList.add("nogyro"); }, 1500);
  }
  initAudio();
  if (audio.state === "suspended") audio.resume();
  reset();
  state = "play";
  ui.start.classList.add("hidden");
  ui.over.classList.add("hidden");
  ui.pause.classList.add("hidden");
  last = performance.now();
}
$("startBtn").onclick = startGame;
$("restartBtn").onclick = startGame;
$("menuBtn").onclick = () => {
  state = "menu";
  ui.over.classList.add("hidden");
  ui.start.classList.remove("hidden");
  renderBikeSelect();
};

// ================== PAGES (Home → Mode → Bike select) ==================
// Har mode ka apna link: #oneway  #twoway  #racing  (khali = Home page)
function updateModeBests() {
  Object.keys(MODES).forEach(m => { const el = $("best_" + m); if (el) el.textContent = "🏆 " + loadBest(m); });
}
function route() {
  if (state === "play" || state === "pause") return;
  const h = location.hash.replace("#", "");
  state = "menu";
  ui.over.classList.add("hidden");
  ui.pause.classList.add("hidden");
  if (!MODES[h]) {                              // Home page
    ui.start.classList.add("hidden");
    ui.home.classList.remove("hidden");
    updateModeBests();
    return;
  }
  mode = h;
  try { localStorage.setItem("bikeMode", mode); } catch (e) {}
  best = loadBest(mode);
  ui.bestStart.textContent = best;
  ui.modeName.textContent = MODES[mode].name;
  ui.tipOncoming.classList.toggle("hidden", mode !== "twoway");
  ui.tipRace.classList.toggle("hidden", mode !== "racing");
  ui.levelLabel.textContent = mode === "racing" ? "POSITION" : "LEVEL";
  reset();
  ui.home.classList.add("hidden");
  ui.start.classList.remove("hidden");
  renderBikeSelect();
}
addEventListener("hashchange", route);
document.querySelectorAll(".mode-card").forEach(b => {
  b.onclick = () => {
    if (location.hash === "#" + b.dataset.mode) route();
    else location.hash = b.dataset.mode;
  };
});
$("backBtn").onclick = () => {
  history.pushState("", document.title, location.pathname + location.search);
  route();
};

// AUTO PAUSE: call aaye / app badlo / tab badlo to game apne aap ruk jayega
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state === "play") togglePause();
});
// Phone par P key nahi hoti: Pause screen par tap karke resume
ui.pause.addEventListener("click", () => { if (state === "pause") togglePause(); });

function togglePause() {
  if (state === "play") {
    state = "pause"; ui.pause.classList.remove("hidden");
    if (engineGain) engineGain.gain.value = 0;
  } else if (state === "pause") {
    state = "play"; ui.pause.classList.add("hidden"); last = performance.now();
  }
}

let overReason = "";
function gameOver(reason) {
  state = "over";
  overReason = reason;
  if (engineGain) engineGain.gain.value = 0;
  if (reason === "crash") {
    crashSound();
    shake = 18;
    for (let i = 0; i < 60; i++) spawnParticle(player.x, player.y, true);
  } else if (reason === "finish") {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.18, "triangle", 0.1), i * 130));
  } else {
    beep(300, 0.3, "triangle"); setTimeout(() => beep(200, 0.5, "triangle"), 250);
  }
  const score = Math.floor(getScore());
  const isBest = score > best;
  if (isBest) { best = score; try { localStorage.setItem(bestKey(mode), best); } catch (e) {} }
  setTimeout(() => {
    ui.overTitle.textContent = reason === "crash" ? "CRASHED!" :
      reason === "finish" ? (place === 1 ? "🏆 1ST PLACE!" : "FINISHED " + ordinal(place)) : "OUT OF FUEL!";
    ui.finalScore.textContent = score;
    ui.finalDist.textContent = Math.floor(distance);
    ui.finalLifts.textContent = lifts;
    ui.pillion.classList.add("hidden");
    ui.bestOver.textContent = best;
    ui.bestStart.textContent = best;
    ui.newBest.classList.toggle("hidden", !isBest);
    ui.over.classList.remove("hidden");
  }, reason === "crash" ? 900 : 400);
}

const getScore = () => distance + coins * 50 + bonus;

// ================== SPAWNING ==================
function spawnCar() {
  const lane = Math.floor(Math.random() * LANES);
  if (traffic.some(c => c.lane === lane && c.y < 160 && c.y > -400)) return;
  if (rivals.some(r => r.lane === lane && rivalY(r) < 160 && rivalY(r) > -400)) return;   // auto bike ke upar gaadi nahi
  const oncoming = isOncoming(lane);
  const truck = Math.random() < 0.2;
  traffic.push({
    lane, x: laneX(lane), y: -170, oncoming,
    w: truck ? 50 : 44, h: truck ? 130 : 80,
    speed: oncoming ? 250 + Math.random() * 200 : (truck ? 180 : 220) + Math.random() * 170,
    color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    truck, passed: false,
    swerve: !oncoming && level > 3 && Math.random() < 0.2,
    swerveT: 0,
  });
}

function spawnPickup(type) {
  const lane = Math.floor(Math.random() * LANES);
  if (type === "coin") {
    for (let i = 0; i < 5; i++) pickups.push({ type, x: laneX(lane), y: -40 - i * 50, r: 11, t: Math.random() * 6 });
  } else if (type === "girl") {
    // apni side (lane 2/3) mein khadi hogi, jahan gaadi paas na ho
    const sideLanes = mode === "twoway" ? [2, 3] : [0, 1, 2, 3];
    const free = sideLanes.filter(l => !traffic.some(c => c.lane === l && c.y < 200 && c.y > -350));
    if (!free.length) return false;
    const l = free[Math.floor(Math.random() * free.length)];
    pickups.push({ type, x: laneX(l), y: -60, r: 20, t: 0,
                   look: RIDERS[Math.floor(Math.random() * RIDERS.length)] });
  } else {
    pickups.push({ type, x: laneX(lane), y: -40, r: 15, t: 0 });
  }
}

function spawnParticle(x, y, crash = false) {
  particles.push({
    x, y,
    vx: (Math.random() - 0.5) * (crash ? 600 : 40),
    vy: crash ? (Math.random() - 0.5) * 600 : 80 + Math.random() * 120,
    life: crash ? 1 : 0.5, max: crash ? 1 : 0.5,
    size: crash ? 3 + Math.random() * 5 : 3 + Math.random() * 4,
    color: crash ? ["#ff4b2b", "#ffd34d", "#ffffff", "#ff9f1c"][Math.floor(Math.random() * 4)]
                 : boosting ? "#7a5cff" : "rgba(180,180,180,1)",
  });
}

function floatText(x, y, text, color) {
  texts.push({ x, y, text, color, life: 1 });
}

// ================== UPDATE ==================
function update(dt) {
  // Racing: 3-2-1-GO countdown, tab tak sab ruka rahega
  if (raceCount > 0) {
    const before = Math.ceil(raceCount - 0.6);
    raceCount -= dt;
    const after = Math.ceil(raceCount - 0.6);
    if (after !== before) beep(after > 0 ? 440 : 880, after > 0 ? 0.15 : 0.35, "square", 0.09);
    updateHUD();
    return;
  }

  const topSpeed = bike.top + level * 20;
  let maxSpeed = topSpeed;
  const hasFuel = fuel > 0;
  boosting = hasFuel && nitroKey() && nitro > 0;
  braking = brake();

  if (boosting) { maxSpeed += 450; speed += 900 * dt; nitro = Math.max(0, nitro - 30 * dt); }

  if (hasFuel) {
    if (gas()) speed += bike.accel * dt; else speed -= 120 * dt;
    if (braking) speed -= 750 * dt;
    speed = Math.max(150, Math.min(speed, maxSpeed));
    if (!boosting && speed > topSpeed) speed -= 500 * dt;

    // Fuel consumption — speed aur nitro ke hisaab se
    fuel -= speed * dt * 0.0042 * bike.eff * (boosting ? 1.7 : 1) * (mode === "racing" ? 0.6 : 1);
    if (fuel < 0) fuel = 0;

    // Low fuel warning beep
    if (fuel / bike.tank < 0.25) {
      lowFuelBeep -= dt;
      if (lowFuelBeep <= 0) { beep(880, 0.08, "square", 0.05); lowFuelBeep = 1; }
    }
  } else {
    // Out of fuel: bike dheere dheere ruk jayegi
    speed -= (braking ? 600 : 260) * dt;
    if (speed <= 15) { speed = 0; gameOver("fuel"); return; }
  }

  // Steering (keyboard / buttons, warna phone tilt)
  let steer = (right() ? 1 : 0) - (left() ? 1 : 0);
  if (!steer && gyroOn && isTouch) steer = tiltSteer;
  const target = steer * (320 + speed * 0.15) * bike.handling;
  player.vx += (target - player.vx) * Math.min(1, 10 * bike.handling * dt);
  player.x += player.vx * dt;
  player.tilt = player.vx / 600;
  const minX = ROAD_L + player.w / 2 + 4, maxX = ROAD_R - player.w / 2 - 4;
  if (player.x < minX || player.x > maxX) {
    player.x = Math.max(minX, Math.min(player.x, maxX));
    speed -= 300 * dt;
    shake = Math.max(shake, 2);
  }

  // Progress
  distance += speed * dt / 10;
  level = 1 + Math.floor(distance / 1000);
  roadOffset = (roadOffset + speed * dt) % 80;
  trackS += speed * dt;                                   // 3D road aage badhe
  bgX -= trackCurve(trackS) * speed * dt * 900;           // mod par aasmaan/pahaad side mein khiske
  wheelAnim = (wheelAnim + speed * dt * 0.1) % 60;

  for (const t of trees) {
    t.y += speed * dt;
    if (t.y > H + 60) { t.y -= treeSpan; t.s = 0.7 + Math.random() * 0.5; }
  }

  // Spawn traffic
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnCar();
    if (level > 3 && Math.random() < 0.35) spawnCar();
    spawnTimer = Math.max(0.32, 1.1 - level * 0.08) * (500 / Math.max(speed, 300)) * (mode === "racing" ? 1.5 : 1);
  }

  // Spawn pickups
  coinTimer -= dt;
  if (coinTimer <= 0) { spawnPickup("coin"); coinTimer = 2.5 + Math.random() * 2; }
  nitroTimer -= dt;
  if (nitroTimer <= 0) { spawnPickup("nitro"); nitroTimer = 9 + Math.random() * 6; }
  fuelTimer -= dt;
  if (fuelTimer <= 0) {
    spawnPickup("fuel");
    // fuel kam ho to can jaldi aayega, lekin level badhne par kam milega
    const low = fuel / bike.tank < 0.35;
    fuelTimer = (low ? 3 : 7 + Math.random() * 4) + level * 0.3;
  }

  // Lift maangne wali — rare (fuel se bhi kam)
  if (!pillion && !pickups.some(p => p.type === "girl")) {
    girlTimer -= dt;
    if (girlTimer <= 0) {
      girlTimer = spawnPickup("girl") === false ? 1 : 30 + Math.random() * 25;
    }
  }

  // Pillion ride progress
  if (pillion) {
    pillion.left -= speed * dt / 10;
    if (pillion.left <= 0) {
      bonus += 300;
      floatText(player.x, player.y - 70, "THANK YOU! +300", "#ff79c6");
      beep(660, 0.1, "sine", 0.1); setTimeout(() => beep(990, 0.18, "sine", 0.1), 120);
      pillion = null;
      ui.pillion.classList.add("hidden");
    } else {
      ui.pillionDist.textContent = Math.ceil(pillion.left);
    }
  }

  // Traffic movement
  for (const c of traffic) {
    c.y += (c.oncoming ? speed + c.speed : speed - c.speed) * dt;
    if (c.swerve) {
      c.swerveT += dt;
      if (c.swerveT > 1 && c.y > 50 && c.y < H / 2) {
        if (mode === "twoway") c.lane = c.lane === 2 ? 3 : 2;
        else c.lane = c.lane === 0 ? 1 : c.lane === LANES - 1 ? LANES - 2 : c.lane + (Math.random() < 0.5 ? -1 : 1);
        c.swerve = false;
      }
    }
    c.x += (laneX(c.lane) - c.x) * Math.min(1, 3 * dt);

    // Near-miss bonus
    if (!c.passed && c.y - c.h / 2 > player.y + player.h / 2) {
      c.passed = true;
      if (Math.abs(c.x - player.x) < (c.w + player.w) / 2 + 24) {
        const pts = c.oncoming ? 60 : 25;
        bonus += pts;
        floatText(player.x, player.y - 50, "NEAR MISS +" + pts, c.oncoming ? "#ff4b2b" : "#ffd34d");
        beep(700, 0.06, "triangle");
      }
    }
  }
  traffic = traffic.filter(c => c.y < H + 220 && c.y > -500);

  // Pickups
  for (const p of pickups) { p.y += speed * dt; p.t += dt * 6; }
  pickups = pickups.filter(p => {
    if (Math.abs(p.x - player.x) < p.r + player.w / 2 && Math.abs(p.y - player.y) < p.r + player.h / 2) {
      if (p.type === "girl") {
        if (pillion) return p.y < H + 60;      // seat already full
        pillion = { ...p.look, left: LIFT_DIST };
        lifts++; bonus += 100;
        floatText(p.x, p.y - 30, "LIFT DE DI! +100", "#ff79c6");
        beep(523, 0.1, "triangle", 0.1);
        setTimeout(() => beep(659, 0.1, "triangle", 0.1), 100);
        setTimeout(() => beep(784, 0.18, "triangle", 0.1), 200);
        ui.pillion.classList.remove("hidden");
        ui.pillionDist.textContent = LIFT_DIST;
        return false;
      }
      if (p.type === "coin") {
        const add = pillion ? 2 : 1;
        coins += add; beep(1200, 0.08); beep(1600, 0.1);
        if (add > 1) floatText(p.x, p.y, "x2", "#ff79c6");
      }
      else if (p.type === "nitro") {
        nitro = Math.min(100, nitro + 35); beep(400, 0.25, "sawtooth");
        floatText(p.x, p.y, "+NITRO", "#00c6ff");
      } else {
        const add = bike.tank * 0.35;
        fuel = Math.min(bike.tank, fuel + add);
        beep(500, 0.1, "sine", 0.12); beep(750, 0.15, "sine", 0.12);
        floatText(p.x, p.y, "+FUEL", "#2ecc71");
      }
      return false;
    }
    return p.y < H + 60;
  });

  // Collision = OUT
  for (const c of traffic) {
    if (Math.abs(c.x - player.x) < (c.w + player.w) / 2 - 6 &&
        Math.abs(c.y - player.y) < (c.h + player.h) / 2 - 8) {
      gameOver("crash");
      return;
    }
  }

  // Racing: auto bikes + finish line
  if (mode === "racing") {
    updateRivals(dt);
    if (distance >= RACE_DIST) {
      place = finishCount + 1;
      bonus += [1000, 500, 250, 0][place - 1] || 0;
      updateHUD();
      gameOver("finish");
      return;
    }
  }

  if (hasFuel && Math.random() < (boosting ? 1 : 0.4))
    spawnParticle(player.x + 16 + (Math.random() - 0.5) * 4, player.y + 45);
  updateParticles(dt);

  if (engineGain && !muted) {
    engineGain.gain.value = hasFuel ? 0.035 : 0.015;
    engineOsc.frequency.value = 55 + speed * 0.13 + (boosting ? 40 : 0);
  }

  shake *= 0.9;
  updateHUD();
}

function updateParticles(dt) {
  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
  particles = particles.filter(p => p.life > 0);
  for (const t of texts) { t.y -= 50 * dt; t.life -= dt; }
  texts = texts.filter(t => t.life > 0);
}

function updateHUD() {
  ui.score.textContent = Math.floor(getScore());
  ui.speed.textContent = Math.floor(speed / 5);
  ui.coins.textContent = coins;
  ui.level.textContent = mode === "racing" ? racePos() + "/" + (rivals.length + 1) : level;
  ui.nitro.style.width = nitro + "%";
  const fp = fuel / bike.tank * 100;
  ui.fuel.style.width = fp + "%";
  ui.fuelWrap.classList.toggle("low", fp < 25);
}

// ================== DRAW HELPERS ==================
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = v => Math.max(0, Math.min(255, v + amt));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

// ================== 3D ROAD VIEW (bike ke peeche se camera) ==================
// Game ka logic (lanes, traffic, collision) waisa hi hai — sirf dikhne ka tareeka badla hai.
// Har cheez ko "kitni door aage hai (d)" aur "road ke center se kitni side (lat)" se screen par project karte hain.
const CAM_BACK = 330;                 // camera bike se kitna peeche (game px)
const SEG = 30, NSEG = 140;           // road ke tukde, aage ~4k px tak
const D0 = -CAM_BACK + 60;
const ROAD_HW = 180;                  // road ki aadhi chaudai (game px)
const segD = new Float32Array(NSEG + 1), segX = new Float32Array(NSEG + 1), segY = new Float32Array(NSEG + 1);
const segSc = new Float32Array(NSEG + 1), segEl = new Float32Array(NSEG + 1), segClip = new Float32Array(NSEG + 1);
let horizonY = 0, camH = 1, FOCAL = 1, camX = 0, trackS = 0, bgX = 0, segStart = D0;
const FOG = "#5a2d63";

function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

// Road ke mod (curves): har 2600 px ka ek hissa — seedha / halka mod / tez mod
const TRACK_SEC = 2600;
function trackCurve(s) {
  const i = Math.floor(s / TRACK_SEC), t = s / TRACK_SEC - i;
  if (i < 1) return 0;
  const opts = [0, 0.7, -0.7, 1.2, -1.2, 0, 1.6, -1.6];
  const c = opts[Math.floor(hash(i + 7) * opts.length)];
  return c * 1.7e-4 * (mode === "racing" ? 1.35 : 1) * Math.sin(Math.PI * t);
}
// Chadhaai / utaar (hills)
function trackHill(s) {
  const a = mode === "racing" ? 1.3 : 1;
  return a * (230 * Math.sin(s / 1400) + 80 * Math.sin(s / 560 + 1.7));
}

const _mix = new Map();
function mixC(a, b, t) {
  t = Math.round(Math.max(0, Math.min(1, t)) * 20) / 20;
  const k = a + b + t;
  let v = _mix.get(k);
  if (!v) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = sh => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
    v = `rgb(${ch(16)},${ch(8)},${ch(0)})`;
    _mix.set(k, v);
  }
  return v;
}

function setupView() {
  horizonY = Math.round(H * 0.33);
  const groundY = H - (isTouch ? 228 : 150);        // bike ka pahiya screen par kahan
  FOCAL = 238 * CAM_BACK / ROAD_HW;                 // bike ke paas road ~poori screen chaudi
  camH = (groundY - horizonY) * CAM_BACK / FOCAL;
}

function buildSegments() {
  segStart = D0 - (trackS % SEG);                   // tukde zameen ke saath chalte hain (smooth)
  let x = 0, dx = 0;
  for (let i = 0; i <= NSEG; i++) {
    const d = segStart + i * SEG;
    segD[i] = d;
    dx += trackCurve(trackS + d) * SEG;
    x += dx * SEG;
    segX[i] = x;
  }
  const f0 = (0 - segStart) / SEG, i0 = Math.floor(f0);
  const x0 = segX[i0] + (segX[i0 + 1] - segX[i0]) * (f0 - i0);
  const h0 = trackHill(trackS);
  let maxy = Infinity;
  for (let i = 0; i <= NSEG; i++) {
    const d = segD[i], sc = FOCAL / (d + CAM_BACK);
    segX[i] -= x0;
    segEl[i] = (trackHill(trackS + d) - h0) * Math.min(1, Math.max(0, d) / 1100);
    segSc[i] = sc;
    segY[i] = horizonY + (camH - segEl[i]) * sc;
    segClip[i] = maxy;                              // isse paas wali road ka sabse upar ka point
    if (segY[i] < maxy) maxy = segY[i];
  }
}

// d = bike se kitna aage (game px), lat = road center se side (game px)
function project(d, lat) {
  const f = (d - segStart) / SEG;
  if (f < 0 || f >= NSEG) return null;
  const i = Math.floor(f), t = f - i;
  const sc = FOCAL / (d + CAM_BACK);
  const X = segX[i] + (segX[i + 1] - segX[i]) * t;
  const el = segEl[i] + (segEl[i + 1] - segEl[i]) * t;
  return { x: W / 2 + (lat + X - camX) * sc, y: horizonY + (camH - el) * sc, sc, clip: segClip[i] };
}

// ---------- Aasmaan: sunset, taare, pahaad, city ----------
const STARS = Array.from({ length: 70 }, (_, i) => [hash(i * 3 + 1), hash(i * 3 + 2), 0.3 + hash(i * 3 + 3) * 0.7]);
const BUILDINGS = Array.from({ length: 34 }, (_, i) => ({ w: 16 + hash(i + 50) * 26, h: 18 + hash(i + 90) * 62, s: i }));
const CITY_W = BUILDINGS.reduce((a, b) => a + b.w + 3, 0);

function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, horizonY);
  g.addColorStop(0, "#090620"); g.addColorStop(0.45, "#25124a"); g.addColorStop(0.8, "#7a2d6b"); g.addColorStop(1, "#ff8a5c");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, horizonY + 2);

  ctx.fillStyle = "#fff";
  for (const [sx, sy, a] of STARS) {
    ctx.globalAlpha = a * (0.55 + 0.45 * Math.sin(animT * 2 + sx * 30));
    const x = ((sx * W * 3 + bgX * 0.05) % W + W) % W;
    ctx.fillRect(x, sy * horizonY * 0.6, 1.6, 1.6);
  }
  ctx.globalAlpha = 1;

  // synthwave suraj
  const sunX = W / 2 + ((bgX * 0.12) % (W * 1.4) + W * 1.4) % (W * 1.4) - W * 0.7;
  const sr = Math.min(80, W * 0.17), sy = horizonY - sr * 0.45;
  const sg = ctx.createLinearGradient(0, sy - sr, 0, sy + sr);
  sg.addColorStop(0, "#ffe66d"); sg.addColorStop(0.55, "#ff8f5a"); sg.addColorStop(1, "#ff3d81");
  ctx.save();
  ctx.shadowColor = "#ff6b6b"; ctx.shadowBlur = 40;
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sunX, sy, sr, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#7a2d6b";
  for (let k = 0; k < 6; k++) ctx.fillRect(sunX - sr, sy + sr * 0.1 + k * sr * 0.16, sr * 2, 2 + k * 0.9);

  mountains(bgX * 0.25, "#3b1c55", horizonY * 0.26, 1.3);
  mountains(bgX * 0.45, "#2a1440", horizonY * 0.16, 4.1);
  city(bgX * 0.7);
}
function mountains(off, col, amp, seed) {
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(0, horizonY + 2);
  for (let x = 0; x <= W + 20; x += 16) {
    const u = x - off;
    const y = horizonY - amp * (0.55 + 0.45 * Math.sin(u * 0.011 + seed)) * (0.65 + 0.35 * Math.sin(u * 0.029 + seed * 2.3));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, horizonY + 2); ctx.closePath(); ctx.fill();
}
function city(off) {
  let x = ((off % CITY_W) + CITY_W) % CITY_W - CITY_W;
  while (x < W) {
    for (const b of BUILDINGS) {
      if (x + b.w > 0 && x < W) {
        const top = horizonY - b.h * (H / 900);
        ctx.fillStyle = "#170b2a"; ctx.fillRect(x, top, b.w, horizonY - top + 1);
        ctx.fillStyle = "rgba(255,210,120,.55)";
        for (let wy = top + 5; wy < horizonY - 4; wy += 7)
          for (let wx = x + 3; wx < x + b.w - 3; wx += 6)
            if (hash(b.s * 31 + wx * 0.7 + wy * 1.3) > 0.62) ctx.fillRect(wx, wy, 2, 3);
      }
      x += b.w + 3;
    }
  }
}

// ---------- Road (zameen + road + kerb + lines) ----------
function quad(x1, y1, w1, x2, y2, w2, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x1 - w1, y1); ctx.lineTo(x1 + w1, y1);
  ctx.lineTo(x2 + w2, y2); ctx.lineTo(x2 - w2, y2);
  ctx.closePath(); ctx.fill();
}
function drawRoad() {
  ctx.fillStyle = mixC("#1d6630", FOG, 0.75);
  ctx.fillRect(0, horizonY, W, H - horizonY + 2);
  const lines = mode === "twoway" ? [-90, 90] : [-90, 0, 90];
  for (let i = NSEG - 1; i >= 0; i--) {
    const yN = segY[i], yF = segY[i + 1] - 0.6;
    if (yF >= yN || yF > H) continue;              // hill ke peeche chhupa hissa
    const sN = segSc[i], sF = segSc[i + 1];
    const cN = W / 2 + (segX[i] - camX) * sN, cF = W / 2 + (segX[i + 1] - camX) * sF;
    const n = Math.floor((trackS + segD[i]) / SEG + 0.5);
    const alt = Math.floor(n / 3) % 2 === 0, dash = Math.floor(n / 3) % 2 === 0;
    const fog = Math.min(0.88, Math.max(0, (segD[i] - 1500) / 2600));

    ctx.fillStyle = mixC(alt ? "#1f6b2e" : "#27803d", FOG, fog);
    ctx.fillRect(0, yF, W, yN - yF + 1);
    quad(cN, yN, (ROAD_HW + 16) * sN, cF, yF, (ROAD_HW + 16) * sF, mixC(alt ? "#e63946" : "#f1f1f1", FOG, fog));
    quad(cN, yN, ROAD_HW * sN, cF, yF, ROAD_HW * sF, mixC(alt ? "#3b3b3f" : "#35353a", FOG, fog));

    // road ke kinare safed line
    const edge = mixC("#e8e8e8", FOG, fog);
    quad(cN - (ROAD_HW - 5) * sN, yN, 2 * sN, cF - (ROAD_HW - 5) * sF, yF, 2 * sF, edge);
    quad(cN + (ROAD_HW - 5) * sN, yN, 2 * sN, cF + (ROAD_HW - 5) * sF, yF, 2 * sF, edge);
    // lane dashes
    if (dash) {
      const lc = mixC("#f4f4f4", FOG, fog);
      for (const L of lines) quad(cN + L * sN, yN, 2.2 * sN, cF + L * sF, yF, 2.2 * sF, lc);
    }
    // Two Way: beech mein double peeli line
    if (mode === "twoway") {
      const yc = mixC("#ffcc00", FOG, fog);
      quad(cN - 4.5 * sN, yN, 1.7 * sN, cF - 4.5 * sF, yF, 1.7 * sF, yc);
      quad(cN + 4.5 * sN, yN, 1.7 * sN, cF + 4.5 * sF, yF, 1.7 * sF, yc);
    }
  }
}

// Racing: start / finish ki checkered patti road par
function checkerDecal(d) {
  const a = project(d, 0), b = project(d + 26, 0);
  if (!a || !b || b.y >= a.y) return;
  const cols = 12, step = (ROAD_HW * 2) / cols;
  for (let row = 0; row < 2; row++) {
    const d1 = d + row * 13, d2 = d1 + 13;
    for (let k = 0; k < cols; k++) {
      const l1 = -ROAD_HW + k * step, l2 = l1 + step;
      const p1 = project(d1, l1), p2 = project(d1, l2), p3 = project(d2, l2), p4 = project(d2, l1);
      if (!p1 || !p2 || !p3 || !p4) continue;
      ctx.fillStyle = (k + row) % 2 ? "#111" : "#f5f5f5";
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y);
      ctx.closePath(); ctx.fill();
    }
  }
}

// ---------- Sprites (gaadiyan, bike, pickups, ped, lamp) ----------
function drawCarView(c) {
  const w = c.w, hw = w / 2, front = c.oncoming, col = c.color.length === 7 ? c.color : "#888888";
  ctx.fillStyle = "rgba(0,0,0,.45)";
  ctx.beginPath(); ctx.ellipse(0, 0, hw + 4, 5, 0, 0, TAU); ctx.fill();
  if (front) {                               // saamne wali gaadi ki headlight road par
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const bg = ctx.createLinearGradient(0, 0, 0, 70);
    bg.addColorStop(0, "rgba(255,250,200,.35)"); bg.addColorStop(1, "rgba(255,250,200,0)");
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.moveTo(-hw + 4, -2); ctx.lineTo(hw - 4, -2); ctx.lineTo(hw + 34, 70); ctx.lineTo(-hw - 34, 70);
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  ctx.fillStyle = "#0d0d0d";
  rr(ctx, -hw + 2, -10, 9, 10, 2); ctx.fill();
  rr(ctx, hw - 11, -10, 9, 10, 2); ctx.fill();

  if (c.truck) {
    if (front) {
      const cg = ctx.createLinearGradient(-hw, 0, hw, 0);
      cg.addColorStop(0, "#9aa0aa"); cg.addColorStop(0.5, "#e1e4ea"); cg.addColorStop(1, "#9aa0aa");
      ctx.fillStyle = cg; rr(ctx, -hw, -72, w, 34, 3); ctx.fill();
      const bg2 = ctx.createLinearGradient(0, -48, 0, -6);
      bg2.addColorStop(0, shade(col, 25)); bg2.addColorStop(1, shade(col, -55));
      ctx.fillStyle = bg2; rr(ctx, -hw, -48, w, 40, 4); ctx.fill();
      const gl = ctx.createLinearGradient(0, -45, 0, -30);
      gl.addColorStop(0, "#a8d8ff"); gl.addColorStop(1, "#3b6e99");
      ctx.fillStyle = gl; rr(ctx, -hw + 5, -45, w - 10, 15, 2); ctx.fill();
      ctx.fillStyle = "#151515"; rr(ctx, -hw + 11, -26, w - 22, 11, 2); ctx.fill();
      ctx.strokeStyle = "#555"; ctx.lineWidth = 1;
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-hw + 12, -23 + k * 3.5); ctx.lineTo(hw - 12, -23 + k * 3.5); ctx.stroke(); }
      lights(-hw + 2, hw - 12, -21, 10, 6, "#fffbd1", 18);
    } else {
      const cg = ctx.createLinearGradient(-hw, 0, hw, 0);
      cg.addColorStop(0, "#9aa0aa"); cg.addColorStop(0.5, "#eef0f4"); cg.addColorStop(1, "#9aa0aa");
      ctx.fillStyle = cg; rr(ctx, -hw, -68, w, 60, 3); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, -66); ctx.lineTo(0, -10); ctx.stroke();
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-hw + 2, -60 + k * 13); ctx.lineTo(hw - 2, -60 + k * 13); ctx.stroke(); }
      ctx.fillStyle = col; ctx.fillRect(-hw, -68, w, 5);
      ctx.fillStyle = "#1a1a1a"; rr(ctx, -hw, -10, w, 4, 1); ctx.fill();
      lights(-hw + 2, hw - 10, -16, 8, 5, "#ff2b2b", 10);
      ctx.fillStyle = "#f2f2f2"; rr(ctx, -6, -18, 12, 6, 1); ctx.fill();
    }
    return;
  }
  const g = ctx.createLinearGradient(0, -26, 0, -4);
  g.addColorStop(0, shade(col, 35)); g.addColorStop(1, shade(col, -55));
  ctx.fillStyle = g; rr(ctx, -hw, -25, w, 19, 5); ctx.fill();
  ctx.fillStyle = shade(col, -25);
  ctx.beginPath(); ctx.moveTo(-hw + 3, -24); ctx.lineTo(-hw + 8, -38); ctx.lineTo(hw - 8, -38); ctx.lineTo(hw - 3, -24); ctx.closePath(); ctx.fill();
  const gl = ctx.createLinearGradient(0, -37, 0, -25);
  gl.addColorStop(0, front ? "#a8d8ff" : "#26394d"); gl.addColorStop(1, front ? "#3b6e99" : "#0b1520");
  ctx.fillStyle = gl;
  ctx.beginPath(); ctx.moveTo(-hw + 6, -25.5); ctx.lineTo(-hw + 10, -36); ctx.lineTo(hw - 10, -36); ctx.lineTo(hw - 6, -25.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.18)";
  ctx.beginPath(); ctx.moveTo(-hw + 10, -35); ctx.lineTo(-hw + 16, -35); ctx.lineTo(-hw + 11, -27); ctx.lineTo(-hw + 7, -27); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#1a1a1a"; rr(ctx, -hw + 1, -9, w - 2, 4, 2); ctx.fill();
  if (front) {
    ctx.fillStyle = "#151515"; rr(ctx, -8, -19, 16, 6, 2); ctx.fill();
    lights(-hw + 3, hw - 13, -20, 10, 4, "#fffbd1", 18);
  } else {
    lights(-hw + 2, hw - 12, -21, 10, 4, "#ff2b2b", 10);
    ctx.fillStyle = "#f2f2f2"; rr(ctx, -6, -16, 12, 5, 1); ctx.fill();
  }
}
function lights(xl, xr, y, w, h, col, blur) {
  ctx.save();
  ctx.shadowColor = col; ctx.shadowBlur = blur; ctx.fillStyle = col;
  rr(ctx, xl, y, w, h, 1.5); ctx.fill();
  rr(ctx, xr, y, w, h, 1.5); ctx.fill();
  ctx.restore();
}

// Bike peeche se (rider ki peeth dikhti hai) — ground point (0,0) par
function drawBikeRear(g, b, o) {
  const t = o.t || 0;
  g.save();
  g.rotate((o.tilt || 0) * 0.35);
  g.fillStyle = "rgba(0,0,0,.45)";
  g.beginPath(); g.ellipse(0, 0, 20, 5, 0, 0, TAU); g.fill();

  if (o.boost) {                                   // nitro flame camera ki taraf
    const fl = 14 + Math.random() * 14;
    [-8, 8].forEach(ex => {
      const fg = g.createLinearGradient(0, -15, 0, -15 + fl);
      fg.addColorStop(0, "#ffffff"); fg.addColorStop(0.3, "#00c6ff"); fg.addColorStop(1, "rgba(122,92,255,0)");
      g.fillStyle = fg;
      g.beginPath(); g.ellipse(ex, -15 + fl / 2, 4.2, fl / 2, 0, 0, TAU); g.fill();
    });
  }
  // pichla tyre
  g.fillStyle = "#0b0b0b"; rr(g, -6, -22, 12, 22, 5); g.fill();
  g.strokeStyle = "#3a3a3a"; g.lineWidth = 1.4;
  for (let k = 0; k < 4; k++) {
    const yy = -20 + ((k * 5 + (o.wheel || 0) * 0.5) % 18);
    g.beginPath(); g.moveTo(-4, yy); g.lineTo(4, yy); g.stroke();
  }
  // twin exhaust (chrome)
  [-1, 1].forEach(sd => {
    const ex = g.createLinearGradient(sd * 7 - 4, 0, sd * 7 + 4, 0);
    ex.addColorStop(0, "#666"); ex.addColorStop(0.5, "#f5f5f5"); ex.addColorStop(1, "#666");
    g.fillStyle = ex; rr(g, sd * 8 - 4, -21, 8, 9, 3.5); g.fill();
    g.fillStyle = "#111"; g.beginPath(); g.arc(sd * 8, -16.5, 2.3, 0, TAU); g.fill();
  });
  // side fairing (aage wala chauda hissa)
  const fg = g.createLinearGradient(-17, 0, 17, 0);
  fg.addColorStop(0, shade(b.color, -70)); fg.addColorStop(0.5, shade(b.color, 20)); fg.addColorStop(1, shade(b.color, -70));
  g.fillStyle = fg;
  g.beginPath(); g.moveTo(-15, -30); g.quadraticCurveTo(-17, -40, -12, -46); g.lineTo(12, -46); g.quadraticCurveTo(17, -40, 15, -30); g.closePath(); g.fill();
  // tail cowl
  const tg = g.createLinearGradient(-10, 0, 10, 0);
  tg.addColorStop(0, shade(b.color, -60)); tg.addColorStop(0.5, shade(b.color, 30)); tg.addColorStop(1, shade(b.color, -60));
  g.fillStyle = tg;
  g.beginPath(); g.moveTo(-9, -22); g.quadraticCurveTo(-11, -33, -7, -40); g.lineTo(7, -40); g.quadraticCurveTo(11, -33, 9, -22); g.closePath(); g.fill();
  g.fillStyle = b.accent || "#fff";
  g.fillRect(-7, -36, 2, 6); g.fillRect(5, -36, 2, 6);
  // tail light (brake par tez laal)
  g.save();
  g.shadowColor = "#ff0000"; g.shadowBlur = o.brake ? 18 : 6;
  g.fillStyle = o.brake ? "#ff2020" : "#b00000";
  rr(g, -6.5, -31, 13, 3.6, 1.5); g.fill();
  g.restore();
  g.fillStyle = "#f4f4f4"; rr(g, -5, -26, 10, 5, 1); g.fill();
  g.fillStyle = "#222"; g.fillRect(-3.5, -24.2, 7, 1.2);

  // rider ke pair
  g.lineCap = "round";
  g.strokeStyle = "#15151f"; g.lineWidth = 7;
  [-1, 1].forEach(sd => {
    g.beginPath(); g.moveTo(sd * 6, -44); g.lineTo(sd * 17, -37); g.lineTo(sd * 14, -23); g.stroke();
    g.fillStyle = "#0a0a0a"; rr(g, sd * 14 - 4, -26, 8, 7, 2.5); g.fill();
    g.fillStyle = b.color; g.beginPath(); g.arc(sd * 17, -37, 2.4, 0, TAU); g.fill();
  });
  // rider ki peeth (aage jhuka hua)
  const jg = g.createLinearGradient(-17, 0, 17, 0);
  jg.addColorStop(0, shade(b.suit, -30)); jg.addColorStop(0.5, shade(b.suit, 40)); jg.addColorStop(1, shade(b.suit, -30));
  g.fillStyle = jg;
  g.beginPath();
  g.moveTo(-9, -42); g.quadraticCurveTo(-17, -52, -17, -62); g.quadraticCurveTo(-16, -69, -8, -69);
  g.lineTo(8, -69); g.quadraticCurveTo(16, -69, 17, -62); g.quadraticCurveTo(17, -52, 9, -42);
  g.closePath(); g.fill();
  g.fillStyle = b.color;
  rr(g, -2, -67, 4, 24, 2); g.fill();
  g.beginPath(); g.ellipse(-14, -64, 4.2, 3.4, -0.4, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(14, -64, 4.2, 3.4, 0.4, 0, TAU); g.fill();
  g.fillStyle = "#fff"; g.font = "bold 9px Arial"; g.textAlign = "center";
  g.fillText("7", 0, -48);
  // haath handle tak + mirror
  g.strokeStyle = b.suit; g.lineWidth = 6;
  g.beginPath(); g.moveTo(-15, -62); g.lineTo(-22, -52); g.stroke();
  g.beginPath(); g.moveTo(15, -62); g.lineTo(22, -52); g.stroke();
  g.strokeStyle = "#1a1a1a"; g.lineWidth = 2;
  g.beginPath(); g.moveTo(-22, -53); g.lineTo(-26, -61); g.moveTo(22, -53); g.lineTo(26, -61); g.stroke();
  g.fillStyle = "#333"; g.beginPath(); g.ellipse(-27, -62, 4.5, 2.6, -0.3, 0, TAU); g.ellipse(27, -62, 4.5, 2.6, 0.3, 0, TAU); g.fill();
  g.fillStyle = "#111"; g.beginPath(); g.arc(-22, -52, 3.2, 0, TAU); g.arc(22, -52, 3.2, 0, TAU); g.fill();
  // sar (peeche se baal)
  const skin = "#d39a64";
  g.fillStyle = skin; rr(g, -3.5, -74, 7, 7, 2); g.fill();
  g.beginPath(); g.ellipse(-8.3, -78, 2, 3, 0, 0, TAU); g.ellipse(8.3, -78, 2, 3, 0, 0, TAU); g.fill();
  const hair = g.createRadialGradient(-2, -82, 1, 0, -79, 9);
  hair.addColorStop(0, "#3a2a20"); hair.addColorStop(1, "#0e0a08");
  g.fillStyle = hair; g.beginPath(); g.ellipse(0, -79, 8, 9, 0, 0, TAU); g.fill();
  g.strokeStyle = "#111"; g.lineWidth = 1.3;
  g.beginPath(); g.moveTo(-8, -78); g.lineTo(8, -78); g.stroke();

  if (o.passenger) drawPillionRear(g, o.passenger, t);
  g.restore();
}

// Peeche baithi pillion (peeth se) — choti aur udta dupatta
function drawPillionRear(g, p, t) {
  const w1 = Math.sin(t * 9) * 2.5, w2 = Math.sin(t * 9 + 1.3) * 3, w3 = Math.sin(t * 7 + 0.5) * 4;
  g.fillStyle = p.dupatta || "#ffe066";
  g.globalAlpha = 0.92;
  g.beginPath();
  g.moveTo(-8, -56);
  g.quadraticCurveTo(-24 + w2, -54, -34 + w3, -44);
  g.lineTo(-30 + w1, -38);
  g.quadraticCurveTo(-20 + w2, -46, -7, -48);
  g.closePath(); g.fill();
  g.globalAlpha = 1;
  // pair
  g.lineCap = "round"; g.strokeStyle = "#f6e7d8"; g.lineWidth = 5;
  [-1, 1].forEach(sd => { g.beginPath(); g.moveTo(sd * 6, -38); g.lineTo(sd * 12, -30); g.lineTo(sd * 11, -24); g.stroke(); });
  g.fillStyle = "#c2185b"; rr(g, -15, -26, 7, 5, 2); g.fill(); rr(g, 8, -26, 7, 5, 2); g.fill();
  // kurti
  const dg = g.createLinearGradient(-11, 0, 11, 0);
  dg.addColorStop(0, shade(p.dress, -40)); dg.addColorStop(0.5, shade(p.dress, 30)); dg.addColorStop(1, shade(p.dress, -40));
  g.fillStyle = dg;
  g.beginPath();
  g.moveTo(-11, -36); g.quadraticCurveTo(-12, -50, -8, -58); g.lineTo(8, -58); g.quadraticCurveTo(12, -50, 11, -36);
  g.quadraticCurveTo(0, -33, -11, -36); g.closePath(); g.fill();
  g.strokeStyle = "#ffd34d"; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(-11, -36.5); g.quadraticCurveTo(0, -33.5, 11, -36.5); g.stroke();
  // haath rider ki kamar par
  g.strokeStyle = p.skin; g.lineWidth = 3.6;
  g.beginPath(); g.moveTo(-9, -55); g.quadraticCurveTo(-15, -51, -13, -45); g.stroke();
  g.beginPath(); g.moveTo(9, -55); g.quadraticCurveTo(15, -51, 13, -45); g.stroke();
  g.strokeStyle = "#ffd34d"; g.lineWidth = 1.3;
  g.beginPath(); g.moveTo(-15, -49); g.lineTo(-12, -49); g.moveTo(15, -49); g.lineTo(12, -49); g.stroke();
  // sar + lambi choti
  g.fillStyle = p.skin;
  g.beginPath(); g.ellipse(-6.3, -64, 1.6, 2.4, 0, 0, TAU); g.ellipse(6.3, -64, 1.6, 2.4, 0, 0, TAU); g.fill();
  g.fillStyle = "#ffd34d";
  g.beginPath(); g.arc(-6.5, -61.5, 1.3, 0, TAU); g.arc(6.5, -61.5, 1.3, 0, TAU); g.fill();
  g.fillStyle = p.hair;
  g.beginPath(); g.ellipse(0, -65, 6.6, 7.2, 0, 0, TAU); g.fill();
  g.beginPath();
  g.moveTo(-3.5, -60);
  g.quadraticCurveTo(-4 + w1, -50, -1 + w2, -38);
  g.quadraticCurveTo(1 + w1, -35, 3 + w2, -38);
  g.quadraticCurveTo(4 + w1, -50, 3.5, -60);
  g.closePath(); g.fill();
  g.strokeStyle = shade(p.hair.length === 7 ? p.hair : "#222222", 35); g.lineWidth = 0.9;
  for (let k = 0; k < 5; k++) {
    const yy = -56 + k * 3.6, xx = w1 * (k / 5) + w2 * (k / 10);
    g.beginPath(); g.moveTo(-2.4 + xx, yy); g.lineTo(2.4 + xx, yy + 1.8); g.stroke();
  }
  g.fillStyle = "#ff2e88";
  g.beginPath(); g.moveTo(0, -60); g.lineTo(-5, -63); g.lineTo(-5, -57); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(0, -60); g.lineTo(5, -63); g.lineTo(5, -57); g.closePath(); g.fill();
  g.beginPath(); g.arc(0, -60, 1.8, 0, TAU); g.arc(1 + w2, -36.5, 1.7, 0, TAU); g.fill();
}

// Road ke kinare: lamp post / ped / billboard
const BOARD_TEXT = ["TURBO BIKE RUSH", "NITRO 🔥", "RIDE SAFE", "⛽ FUEL UP", "SPEED ZONE"];
function drawLamp(side, col) {
  ctx.fillStyle = "#2b2b3a"; ctx.fillRect(-2, -150, 4, 150);
  ctx.strokeStyle = "#2b2b3a"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, -148); ctx.quadraticCurveTo(-side * 20, -160, -side * 44, -156); ctx.stroke();
  ctx.save();
  ctx.shadowColor = col; ctx.shadowBlur = 22; ctx.fillStyle = col;
  rr(ctx, -side * 44 - 8, -158, 16, 5, 2); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const lg = ctx.createRadialGradient(-side * 44, -154, 2, -side * 44, -154, 40);
  lg.addColorStop(0, col + "88"); lg.addColorStop(1, col + "00");
  ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(-side * 44, -154, 40, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawRoadTree(s) {
  ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(0, 0, 30 * s, 7 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#4a2f1d"; rr(ctx, -5 * s, -46 * s, 10 * s, 46 * s, 3 * s); ctx.fill();
  ctx.fillStyle = "#11471f";
  ctx.beginPath(); ctx.arc(0, -78 * s, 34 * s, 0, TAU); ctx.arc(-22 * s, -60 * s, 24 * s, 0, TAU); ctx.arc(22 * s, -60 * s, 24 * s, 0, TAU); ctx.fill();
  ctx.fillStyle = "#1d7a33";
  ctx.beginPath(); ctx.arc(-8 * s, -86 * s, 18 * s, 0, TAU); ctx.arc(14 * s, -66 * s, 12 * s, 0, TAU); ctx.fill();
}
function drawBillboard(n) {
  ctx.fillStyle = "#222"; ctx.fillRect(-46, -70, 5, 70); ctx.fillRect(41, -70, 5, 70);
  ctx.fillStyle = "#120a24"; rr(ctx, -66, -132, 132, 64, 6); ctx.fill();
  const col = ["#ff3cac", "#00e5ff", "#ffd34d"][n % 3];
  ctx.save();
  ctx.shadowColor = col; ctx.shadowBlur = 14; ctx.strokeStyle = col; ctx.lineWidth = 3;
  rr(ctx, -62, -128, 124, 56, 5); ctx.stroke();
  ctx.fillStyle = col; ctx.font = "bold 17px Orbitron, Segoe UI, Arial"; ctx.textAlign = "center";
  ctx.fillText(BOARD_TEXT[n % BOARD_TEXT.length], 0, -94);
  ctx.restore();
}
function drawGantry(text) {
  [-1, 1].forEach(sd => { ctx.fillStyle = "#30303c"; ctx.fillRect(sd * (ROAD_HW + 24) - 5, -150, 10, 150); });
  const sq = 12, w = (ROAD_HW + 30) * 2;
  for (let r = 0; r < 2; r++)
    for (let x = -w / 2, k = 0; x < w / 2; x += sq, k++) {
      ctx.fillStyle = (k + r) % 2 ? "#111" : "#f5f5f5";
      ctx.fillRect(x, -168 + r * sq, sq, sq);
    }
  ctx.fillStyle = "#e63946"; rr(ctx, -80, -196, 160, 30, 6); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "bold 20px Orbitron, Segoe UI, Arial"; ctx.textAlign = "center";
  ctx.fillText(text, 0, -174);
}

// Sprite ko uski jagah par perspective scale ke saath banao (hill ke peeche chhupa ho to kat jaye)
function putSprite(p, scale, fn, alpha = 1) {
  ctx.save();
  if (p.clip < H) { ctx.beginPath(); ctx.rect(-50, -50, W + 100, p.clip + 50); ctx.clip(); }
  ctx.globalAlpha = alpha;
  ctx.translate(p.x, p.y);
  ctx.scale(scale, scale);
  fn();
  ctx.restore();
}

// ================== DRAW ==================
function draw() {
  setupView();
  if (player) camX = (player.x - 240) * 0.78;     // camera bike ke peeche follow karta hai
  buildSegments();

  ctx.save();
  if (shake > 0.5) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

  drawSky();
  drawRoad();

  // Racing: start / finish patti
  if (mode === "racing" && player) {
    checkerDecal((RACE_DIST - distance) * 10);
    checkerDecal(-distance * 10 + 40);
  }

  // Bike ki headlight road par
  if (player && (state !== "over" || overReason !== "crash")) {
    const a1 = project(30, player.x - 240 - 10), a2 = project(30, player.x - 240 + 10);
    const b1 = project(780, player.x - 240 - 150), b2 = project(780, player.x - 240 + 150);
    if (a1 && a2 && b1 && b2) {
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      const hg = ctx.createLinearGradient(0, a1.y, 0, b1.y);
      hg.addColorStop(0, "rgba(255,255,210,.22)"); hg.addColorStop(1, "rgba(255,255,210,0)");
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.moveTo(a1.x, a1.y); ctx.lineTo(a2.x, a2.y); ctx.lineTo(b2.x, b2.y); ctx.lineTo(b1.x, b1.y); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  // ---- saari cheezein door se paas (painter's order) ----
  const list = [];
  const fadeAt = d => Math.max(0, Math.min(1, ((player ? player.y : 600) + 260 - d) / 220));

  // road ke kinare ki cheezein (zameen ke saath fixed)
  const RS = 200, n0 = Math.ceil((trackS + segStart) / RS), n1 = Math.floor((trackS + segStart + NSEG * SEG - 10) / RS);
  for (let n = n0; n <= n1; n++) {
    const d = n * RS - trackS, side = n % 2 ? 1 : -1, h = hash(n);
    if (h < 0.1) list.push({ d, lat: side * 300, k: "board", n });
    else if (h < 0.55) list.push({ d, lat: side * (ROAD_HW + 40), k: "lamp", side, col: n % 3 ? "#00e5ff" : "#ff3cac" });
    else list.push({ d, lat: side * (ROAD_HW + 90 + hash(n + 3) * 110), k: "tree", s: 0.8 + hash(n + 5) * 0.5 });
    if (h > 0.3 && h < 0.75) list.push({ d: d + 90, lat: -side * (ROAD_HW + 120 + hash(n + 9) * 140), k: "tree", s: 0.7 + hash(n + 11) * 0.5 });
  }
  if (mode === "racing" && player) {
    list.push({ d: (RACE_DIST - distance) * 10 + 2, lat: 0, k: "gantry", text: "FINISH" });
    list.push({ d: -distance * 10 + 42, lat: 0, k: "gantry", text: "START" });
  }
  if (player) {
    for (const p of pickups) list.push({ d: player.y - p.y, lat: p.x - 240, k: "pick", p });
    for (const c of traffic) list.push({ d: player.y - (c.y + c.h / 2), lat: c.x - 240, k: "car", c });
    for (const r of rivals) list.push({ d: (r.dist - distance) * 10, lat: r.x - 240, k: "rival", r });
    if (state !== "over" || overReason === "fuel" || overReason === "finish")
      list.push({ d: 0, lat: player.x - 240, k: "player" });
  }
  list.sort((a, b) => b.d - a.d);

  for (const o of list) {
    const p = project(o.d, o.lat);
    if (!p || p.y < horizonY - 400 || p.sc > 4) continue;
    const sc = p.sc;
    if (o.k === "lamp") putSprite(p, sc, () => drawLamp(o.side, o.col));
    else if (o.k === "tree") putSprite(p, sc, () => drawRoadTree(o.s));
    else if (o.k === "board") putSprite(p, sc, () => drawBillboard(o.n));
    else if (o.k === "gantry") {                 // gate ke neeche se guzarte waqt halka ho jaye (bike na dhake)
      const ga = Math.max(0, Math.min(1, (o.d - 40) / 220));
      if (ga > 0) putSprite(p, sc, () => drawGantry(o.text), ga);
    }
    else if (o.k === "car") putSprite(p, sc, () => drawCarView(o.c), fadeAt(o.d));
    else if (o.k === "pick") {
      const q = o.p, a = fadeAt(o.d);
      if (q.type === "girl") putSprite(p, sc * 1.15, () => drawGirl({ ...q, x: 0, y: -23 }), a);
      else if (q.type === "coin") putSprite(p, sc * 1.1, () => drawCoin({ ...q, x: 0, y: -q.r - 8 }), a);
      else if (q.type === "nitro") putSprite(p, sc * 1.1, () => { ctx.translate(0, -24); drawNitro({ ...q, x: 0, y: 0 }); }, a);
      else putSprite(p, sc * 1.1, () => { ctx.translate(0, -24); drawFuel({ ...q, x: 0, y: 0 }); }, a);
    } else if (o.k === "rival") {
      const r = o.r;
      putSprite(p, sc * 1.15, () => {
        drawBikeRear(ctx, r.bike, { tilt: r.tilt, wheel: wheelAnim, boost: r.boost > 0, t: animT });
        ctx.font = "bold 12px Rajdhani, Segoe UI, Arial"; ctx.textAlign = "center";
        ctx.fillStyle = "rgba(0,0,0,.6)"; rr(ctx, -22, -106, 44, 16, 8); ctx.fill();
        ctx.fillStyle = r.bike.color; ctx.fillText(r.name, 0, -94);
      });
    } else if (o.k === "player") {
      putSprite(p, sc * 1.15, () => drawBikeRear(ctx, bike, {
        tilt: player.tilt, wheel: wheelAnim, boost: boosting, brake: braking, passenger: pillion, t: animT,
      }));
    }
  }

  // Particles (dhuan / crash)
  if (player) {
    for (const q of particles) {
      const p = project(player.y - q.y, q.x - 240);
      if (!p || p.sc > 3.5) continue;
      ctx.globalAlpha = Math.max(0, q.life / q.max);
      ctx.fillStyle = q.color;
      ctx.beginPath(); ctx.arc(p.x, p.y - 12 * p.sc, q.size * p.sc, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Speed lines (nitro)
  if (boosting && state === "play") {
    ctx.strokeStyle = "rgba(255,255,255,.28)"; ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * TAU, r1 = 120 + Math.random() * 200, r2 = r1 + 60 + Math.random() * 80;
      const cx = W / 2, cy = horizonY + 40;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.8);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2 * 0.8); ctx.stroke();
    }
  }

  // Floating texts
  ctx.textAlign = "center";
  ctx.font = "bold 17px Rajdhani, Segoe UI, Arial";
  if (player) for (const t of texts) {
    const p = project(player.y - t.y, t.x - 240);
    if (!p) continue;
    const ty = p.y - 95 * Math.min(p.sc, 1.6);
    ctx.globalAlpha = Math.max(0, t.life);
    ctx.fillStyle = "#000"; ctx.fillText(t.text, p.x + 1, ty + 1);
    ctx.fillStyle = t.color; ctx.fillText(t.text, p.x, ty);
  }
  ctx.globalAlpha = 1;

  // Warnings / banners
  if (state === "play") {
    if (fuel <= 0) banner("OUT OF FUEL!", "#ff3b3b", Math.floor(performance.now() / 250) % 2);
    else if (fuel / bike.tank < 0.25) {
      if (Math.floor(performance.now() / 300) % 2) {
        ctx.fillStyle = "#ff3b3b"; ctx.font = "bold 18px Segoe UI, Arial";
        ctx.fillText("⛽ LOW FUEL!", W / 2, 110);
      }
    }
    if (mode !== "racing" && distance % 1000 < 60 && distance > 100) banner("LEVEL " + level, "#ffd34d", true);

    if (mode === "racing") {
      if (raceCount > 0) {
        const n = Math.ceil(raceCount - 0.6);
        banner(n > 0 ? String(n) : "GO!", n > 0 ? "#ffd34d" : "#2ecc71", true);
      } else {
        const leftM = Math.max(0, Math.ceil(RACE_DIST - distance));
        ctx.textAlign = "center"; ctx.font = "bold 18px Rajdhani, Segoe UI, Arial";
        ctx.fillStyle = "rgba(0,0,0,.55)"; rr(ctx, W / 2 - 78, 122, 156, 26, 13); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.fillText("🏁 FINISH  " + leftM + " m", W / 2, 141);
      }
    }
  }

  ctx.restore();
}

function banner(text, color, show) {
  if (!show) return;
  ctx.fillStyle = "rgba(0,0,0,.5)";
  ctx.fillRect(0, H / 2 - 40, W, 70);
  ctx.fillStyle = color;
  ctx.font = "bold 36px Segoe UI, Arial";
  ctx.textAlign = "center";
  ctx.fillText(text, W / 2, H / 2 + 8);
}

function checkerLine(y) {
  if (y < -40 || y > H + 40) return;
  const sq = 15;
  for (let row = 0; row < 2; row++) {
    for (let x = ROAD_L, i = 0; x < ROAD_R; x += sq, i++) {
      ctx.fillStyle = (i + row) % 2 ? "#111" : "#f5f5f5";
      ctx.fillRect(x, y + row * sq, Math.min(sq, ROAD_R - x), sq);
    }
  }
}

function drawArrow(x, y, down) {
  ctx.save(); ctx.translate(x, y); if (down) ctx.rotate(Math.PI);
  ctx.beginPath();
  ctx.moveTo(0, -18); ctx.lineTo(10, -4); ctx.lineTo(4, -4); ctx.lineTo(4, 16);
  ctx.lineTo(-4, 16); ctx.lineTo(-4, -4); ctx.lineTo(-10, -4); ctx.closePath();
  ctx.fill(); ctx.restore();
}

function drawTree(x, y, s) {
  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.beginPath(); ctx.ellipse(x + 6, y + 6, 22 * s, 22 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#145222";
  ctx.beginPath(); ctx.arc(x, y, 22 * s, 0, TAU); ctx.fill();
  ctx.fillStyle = "#1d7a33";
  ctx.beginPath(); ctx.arc(x - 5 * s, y - 5 * s, 13 * s, 0, TAU); ctx.fill();
}

function drawCar(c) {
  const { x, y, w, h } = c;
  ctx.save();
  ctx.translate(x, y);
  if (c.oncoming) {
    // headlight glow on road (towards player)
    const beam = ctx.createLinearGradient(0, h / 2, 0, h / 2 + 110);
    beam.addColorStop(0, "rgba(255,255,200,.35)"); beam.addColorStop(1, "rgba(255,255,200,0)");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 4, h / 2); ctx.lineTo(w / 2 - 4, h / 2);
    ctx.lineTo(w / 2 + 25, h / 2 + 110); ctx.lineTo(-w / 2 - 25, h / 2 + 110);
    ctx.closePath(); ctx.fill();
    ctx.rotate(Math.PI); // car ka front neeche (player ki taraf)
  }
  ctx.fillStyle = "rgba(0,0,0,.35)";
  rr(ctx, -w / 2 + 4, -h / 2 + 6, w, h, 8); ctx.fill();
  ctx.fillStyle = "#111";
  ctx.fillRect(-w / 2 - 3, -h / 2 + 12, 5, 16);
  ctx.fillRect(w / 2 - 2, -h / 2 + 12, 5, 16);
  ctx.fillRect(-w / 2 - 3, h / 2 - 28, 5, 16);
  ctx.fillRect(w / 2 - 2, h / 2 - 28, 5, 16);
  const bg = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  bg.addColorStop(0, shade(c.color.length === 7 ? c.color : "#888888", -45));
  bg.addColorStop(0.5, c.color);
  bg.addColorStop(1, shade(c.color.length === 7 ? c.color : "#888888", -45));
  ctx.fillStyle = bg;
  rr(ctx, -w / 2, -h / 2, w, h, 8); ctx.fill();
  if (c.truck) {
    ctx.fillStyle = "#ddd";
    rr(ctx, -w / 2 + 3, -h / 2 + 34, w - 6, h - 40, 4); ctx.fill();
    ctx.fillStyle = "#1a2a3a";
    rr(ctx, -w / 2 + 6, -h / 2 + 18, w - 12, 12, 3); ctx.fill();
  } else {
    ctx.fillStyle = "#1a2a3a";
    rr(ctx, -w / 2 + 6, -h / 2 + 14, w - 12, 14, 4); ctx.fill();
    rr(ctx, -w / 2 + 6, h / 2 - 24, w - 12, 10, 4); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.15)";
    rr(ctx, -w / 2 + 6, -h / 2 + 30, w - 12, h - 56, 4); ctx.fill();
  }
  // headlights (front = top in local space)
  ctx.fillStyle = "#fffbd1";
  ctx.fillRect(-w / 2 + 4, -h / 2 + 1, 9, 4);
  ctx.fillRect(w / 2 - 13, -h / 2 + 1, 9, 4);
  // tail lights
  ctx.fillStyle = "#ff2b2b";
  ctx.fillRect(-w / 2 + 3, h / 2 - 5, 10, 4);
  ctx.fillRect(w / 2 - 13, h / 2 - 5, 10, 4);
  ctx.restore();
}

// Detailed top-down sport bike + clearly visible rider (+ optional pillion)
function tyre(g, x, y, w, h, wa) {
  g.fillStyle = "#0b0b0b"; rr(g, x, y, w, h, w / 2); g.fill();
  g.strokeStyle = "#3d3d3d"; g.lineWidth = 1.6;
  const n = Math.floor(h / 6);
  for (let i = 0; i < n; i++) {
    const ty = y + 2 + ((i * 6 + wa) % (h - 4));
    g.beginPath(); g.moveTo(x + 2, ty); g.lineTo(x + w - 2, ty); g.stroke();
  }
  g.fillStyle = "rgba(255,255,255,.08)"; rr(g, x + 1, y + 2, 2.5, h - 4, 1.2); g.fill();
}

function drawBike(g, x, y, b, o) {
  g.save();
  g.translate(x, y);
  g.rotate((o.tilt || 0) * 0.35);
  if (o.scale) g.scale(o.scale, o.scale);
  const wa = o.wheel || 0, t = o.t || 0;

  if (o.beam) {
    const beam = g.createLinearGradient(0, -44, 0, -230);
    beam.addColorStop(0, "rgba(255,255,210,.42)");
    beam.addColorStop(1, "rgba(255,255,210,0)");
    g.fillStyle = beam;
    g.beginPath();
    g.moveTo(-7, -43); g.lineTo(7, -43); g.lineTo(58, -230); g.lineTo(-58, -230);
    g.closePath(); g.fill();
  }

  // ground shadow
  g.fillStyle = "rgba(0,0,0,.38)";
  g.beginPath(); g.ellipse(7, 8, 21, 46, 0, 0, TAU); g.fill();

  // tyres
  tyre(g, -9, 16, 18, 30, wa);    // rear (fat)
  tyre(g, -6, -50, 12, 24, wa);   // front

  // front forks (gold USD forks)
  g.fillStyle = "#d4a017";
  g.fillRect(-8, -38, 3, 12); g.fillRect(5, -38, 3, 12);

  // exhaust (right, chrome)
  const ex = g.createLinearGradient(10, 0, 18, 0);
  ex.addColorStop(0, "#666"); ex.addColorStop(0.5, "#f5f5f5"); ex.addColorStop(1, "#666");
  g.fillStyle = ex; rr(g, 10, 6, 8, 32, 4); g.fill();
  g.fillStyle = "#1a1a1a"; g.beginPath(); g.arc(14, 37, 3, 0, TAU); g.fill();
  if (o.boost) {
    const fl = 16 + Math.random() * 18;
    const fg = g.createLinearGradient(0, 38, 0, 38 + fl);
    fg.addColorStop(0, "#fff"); fg.addColorStop(0.35, "#00c6ff"); fg.addColorStop(1, "rgba(122,92,255,0)");
    g.fillStyle = fg;
    g.beginPath(); g.moveTo(10, 38); g.lineTo(18, 38); g.lineTo(14, 38 + fl); g.closePath(); g.fill();
  }

  // ---- bodywork ----
  const bg = g.createLinearGradient(-14, 0, 14, 0);
  bg.addColorStop(0, shade(b.color, -70));
  bg.addColorStop(0.45, shade(b.color, 25));
  bg.addColorStop(0.55, b.color);
  bg.addColorStop(1, shade(b.color, -70));
  g.fillStyle = bg;
  g.beginPath();
  g.moveTo(0, -46);
  g.quadraticCurveTo(14, -40, 14, -22);   // nose fairing
  g.lineTo(13, -6);                         // tank
  g.quadraticCurveTo(11, 2, 9, 8);
  g.lineTo(8, 30);                          // tail
  g.quadraticCurveTo(6, 39, 0, 40);
  g.quadraticCurveTo(-6, 39, -8, 30);
  g.lineTo(-9, 8);
  g.quadraticCurveTo(-11, 2, -13, -6);
  g.lineTo(-14, -22);
  g.quadraticCurveTo(-14, -40, 0, -46);
  g.closePath(); g.fill();
  g.strokeStyle = "rgba(0,0,0,.45)"; g.lineWidth = 1; g.stroke();

  // side vents / decals
  g.fillStyle = b.accent;
  g.beginPath(); g.moveTo(-13, -30); g.lineTo(-8, -26); g.lineTo(-12, -16); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(13, -30); g.lineTo(8, -26); g.lineTo(12, -16); g.closePath(); g.fill();
  // tail stripes
  g.fillRect(-5, 30, 2, 7); g.fillRect(3, 30, 2, 7);

  // seat (long, for 2)
  g.fillStyle = "#151515"; rr(g, -8, 0, 16, 31, 7); g.fill();
  g.strokeStyle = "#333"; g.lineWidth = 1;
  g.beginPath(); g.moveTo(-6, 15); g.lineTo(6, 15); g.stroke();

  // windscreen
  const ws = g.createLinearGradient(0, -42, 0, -28);
  ws.addColorStop(0, "rgba(170,225,255,.9)"); ws.addColorStop(1, "rgba(60,120,170,.7)");
  g.fillStyle = ws;
  g.beginPath();
  g.moveTo(0, -42); g.quadraticCurveTo(8, -38, 7, -29); g.lineTo(-7, -29);
  g.quadraticCurveTo(-8, -38, 0, -42); g.fill();

  // twin headlights
  g.shadowColor = "#fffbd1"; g.shadowBlur = 10;
  g.fillStyle = "#fffbd1";
  g.beginPath(); g.ellipse(-4, -44, 2.6, 1.6, -0.3, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(4, -44, 2.6, 1.6, 0.3, 0, TAU); g.fill();
  g.shadowBlur = 0;

  // handlebar + mirrors
  g.strokeStyle = "#1a1a1a"; g.lineWidth = 3.2; g.lineCap = "round";
  g.beginPath(); g.moveTo(-19, -22); g.lineTo(19, -22); g.stroke();
  g.fillStyle = "#333";
  g.beginPath(); g.ellipse(-21, -27, 4, 2.4, -0.3, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(21, -27, 4, 2.4, 0.3, 0, TAU); g.fill();
  g.fillStyle = "#9fd8ff";
  g.beginPath(); g.ellipse(-21, -27, 2.4, 1.2, -0.3, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(21, -27, 2.4, 1.2, 0.3, 0, TAU); g.fill();

  // tail light
  if (o.brake) { g.shadowColor = "#ff0000"; g.shadowBlur = 14; }
  g.fillStyle = o.brake ? "#ff2020" : "#a00";
  rr(g, -6, 37, 12, 3.5, 1.5); g.fill();
  g.shadowBlur = 0;

  // ---- RIDER (man) ----
  drawRider(g, b);

  // ---- PILLION (girl) ----
  if (o.passenger) drawPillion(g, o.passenger, t);

  g.restore();
}

function drawRider(g, b) {
  const pants = "#15151f";
  // thighs
  g.fillStyle = pants;
  rr(g, -16, -6, 7, 18, 3.5); g.fill();
  rr(g, 9, -6, 7, 18, 3.5); g.fill();
  // knee sliders
  g.fillStyle = b.color;
  g.beginPath(); g.arc(-13.5, -4, 2.2, 0, TAU); g.fill();
  g.beginPath(); g.arc(13.5, -4, 2.2, 0, TAU); g.fill();
  // boots on pegs
  g.fillStyle = "#0a0a0a";
  rr(g, -18, 10, 8, 9, 3); g.fill();
  rr(g, 10, 10, 8, 9, 3); g.fill();
  g.fillStyle = "#c0392b";
  g.fillRect(-17, 16, 6, 1.5); g.fillRect(11, 16, 6, 1.5);

  // torso (leather jacket, leaning forward)
  const jg = g.createLinearGradient(-13, 0, 13, 0);
  jg.addColorStop(0, shade(b.suit, -25)); jg.addColorStop(0.5, shade(b.suit, 35)); jg.addColorStop(1, shade(b.suit, -25));
  g.fillStyle = jg;
  g.beginPath();
  g.moveTo(-13, -10);
  g.quadraticCurveTo(-14, -17, -7, -18);
  g.lineTo(7, -18);
  g.quadraticCurveTo(14, -17, 13, -10);
  g.lineTo(10, 7);
  g.quadraticCurveTo(0, 11, -10, 7);
  g.closePath(); g.fill();
  // spine stripe + shoulder armour
  g.fillStyle = b.color;
  g.fillRect(-2, -15, 4, 20);
  g.beginPath(); g.ellipse(-11, -14, 4, 3.4, -0.4, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(11, -14, 4, 3.4, 0.4, 0, TAU); g.fill();
  // back hump number
  g.fillStyle = "#fff"; g.font = "bold 7px Arial"; g.textAlign = "center";
  g.fillText("7", 0, 3);

  // arms to grips
  g.strokeStyle = b.suit; g.lineWidth = 6; g.lineCap = "round";
  g.beginPath(); g.moveTo(-11, -13); g.lineTo(-18, -22); g.stroke();
  g.beginPath(); g.moveTo(11, -13); g.lineTo(18, -22); g.stroke();
  g.strokeStyle = b.color; g.lineWidth = 2;
  g.beginPath(); g.moveTo(-12, -14); g.lineTo(-16, -19); g.stroke();
  g.beginPath(); g.moveTo(12, -14); g.lineTo(16, -19); g.stroke();
  // gloves
  g.fillStyle = "#111";
  g.beginPath(); g.arc(-18.5, -22, 3.3, 0, TAU); g.fill();
  g.beginPath(); g.arc(18.5, -22, 3.3, 0, TAU); g.fill();

  // ---- HEAD (no helmet) : short hair wala ladka ----
  const skin = "#d39a64";
  // neck
  g.fillStyle = skin;
  rr(g, -3.5, -19, 7, 5, 2); g.fill();
  // ears
  g.beginPath(); g.ellipse(-8.6, -23, 2, 3, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(8.6, -23, 2, 3, 0, 0, TAU); g.fill();
  // head
  g.beginPath(); g.ellipse(0, -23.5, 8.2, 9, 0, 0, TAU); g.fill();
  // short black hair (fade) covering top/back of head
  const hair = g.createRadialGradient(-2, -27, 1, 0, -24, 9);
  hair.addColorStop(0, "#3a2a20"); hair.addColorStop(1, "#0e0a08");
  g.fillStyle = hair;
  g.beginPath(); g.ellipse(0, -24.5, 7.8, 8.4, 0, 0, TAU); g.fill();
  // spiky front
  g.beginPath();
  g.moveTo(-7, -27);
  for (let i = 0; i <= 6; i++) g.lineTo(-7 + i * 2.33, -33.5 + (i % 2) * 2.5);
  g.lineTo(7, -27); g.closePath(); g.fill();
  // sunglasses strap
  g.strokeStyle = "#111"; g.lineWidth = 1.3;
  g.beginPath(); g.ellipse(0, -24.5, 8.1, 8.6, 0, Math.PI * 1.05, Math.PI * 1.95, true); g.stroke();
}

function drawPillion(g, p, t) {
  const w1 = Math.sin(t * 9) * 2.5, w2 = Math.sin(t * 9 + 1.3) * 3, w3 = Math.sin(t * 7 + 0.5) * 3;

  // dupatta udta hua (hawa mein)
  g.fillStyle = p.dupatta || "#ffe066";
  g.globalAlpha = 0.92;
  g.beginPath();
  g.moveTo(-9, 10);
  g.quadraticCurveTo(-20 + w2, 22, -24 + w3, 40);
  g.lineTo(-17 + w1, 41);
  g.quadraticCurveTo(-14 + w2, 24, -4, 13);
  g.closePath(); g.fill();
  g.globalAlpha = 1;

  // legs (leggings) + sandals
  g.fillStyle = "#f6e7d8";
  rr(g, -13, 15, 5.5, 15, 3); g.fill();
  rr(g, 7.5, 15, 5.5, 15, 3); g.fill();
  g.fillStyle = "#c2185b";
  rr(g, -14, 27, 7, 6, 3); g.fill();
  rr(g, 7, 27, 7, 6, 3); g.fill();

  // kurti (slim)
  const dg = g.createLinearGradient(-10, 0, 10, 0);
  dg.addColorStop(0, shade(p.dress, -40)); dg.addColorStop(0.5, shade(p.dress, 30)); dg.addColorStop(1, shade(p.dress, -40));
  g.fillStyle = dg;
  g.beginPath();
  g.moveTo(-8.5, 14);
  g.quadraticCurveTo(-9.5, 9, -4.5, 8);
  g.lineTo(4.5, 8);
  g.quadraticCurveTo(9.5, 9, 8.5, 14);
  g.lineTo(10, 28);
  g.quadraticCurveTo(0, 31, -10, 28);
  g.closePath(); g.fill();
  // kurti border
  g.strokeStyle = "#ffd34d"; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(-10, 27.5); g.quadraticCurveTo(0, 30.5, 10, 27.5); g.stroke();

  // arms holding rider's waist + bangles
  g.strokeStyle = p.skin; g.lineWidth = 3.6; g.lineCap = "round";
  g.beginPath(); g.moveTo(-8, 12); g.quadraticCurveTo(-12, 6, -9, 2); g.stroke();
  g.beginPath(); g.moveTo(8, 12); g.quadraticCurveTo(12, 6, 9, 2); g.stroke();
  g.strokeStyle = "#ffd34d"; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(-12, 5); g.lineTo(-9, 6); g.moveTo(12, 5); g.lineTo(9, 6); g.stroke();
  g.fillStyle = p.skin;
  g.beginPath(); g.arc(-8.5, 1.5, 2.2, 0, TAU); g.fill();
  g.beginPath(); g.arc(8.5, 1.5, 2.2, 0, TAU); g.fill();

  // head (no helmet) — skin sides + earrings
  g.fillStyle = p.skin;
  g.beginPath(); g.ellipse(0, 10, 7, 7.6, 0, 0, TAU); g.fill();
  g.fillStyle = "#ffd34d";
  g.beginPath(); g.arc(-7.2, 11.5, 1.4, 0, TAU); g.arc(7.2, 11.5, 1.4, 0, TAU); g.fill();

  // long hair: top of head with center parting
  g.fillStyle = p.hair;
  g.beginPath(); g.ellipse(0, 10.5, 6.8, 7.4, 0, 0, TAU); g.fill();
  g.strokeStyle = shade(p.hair.length === 7 ? p.hair : "#222222", 40); g.lineWidth = 0.8;
  g.beginPath(); g.moveTo(0, 3.2); g.lineTo(0, 9); g.stroke();
  // long braid (choti) flowing back in wind
  g.fillStyle = p.hair;
  g.beginPath();
  g.moveTo(-4, 14);
  g.quadraticCurveTo(-5 + w1, 26, -1 + w2, 38);
  g.quadraticCurveTo(1 + w1, 41, 3 + w2, 38);
  g.quadraticCurveTo(5 + w1, 26, 4, 14);
  g.closePath(); g.fill();
  // braid pattern
  g.strokeStyle = shade(p.hair.length === 7 ? p.hair : "#222222", 35); g.lineWidth = 0.9;
  for (let i = 0; i < 5; i++) {
    const yy = 18 + i * 4, xx = w1 * (i / 5) + w2 * (i / 10);
    g.beginPath(); g.moveTo(-2.5 + xx, yy); g.lineTo(2.5 + xx, yy + 2); g.stroke();
  }
  // bow / scrunchie
  g.fillStyle = "#ff2e88";
  const bx = 0, by = 15;
  g.beginPath(); g.moveTo(bx, by); g.lineTo(bx - 5, by - 3); g.lineTo(bx - 5, by + 3); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + 5, by - 3); g.lineTo(bx + 5, by + 3); g.closePath(); g.fill();
  g.beginPath(); g.arc(bx, by, 1.8, 0, TAU); g.fill();
  // tassel at end of braid
  g.beginPath(); g.arc(1 + w2, 39.5, 1.8, 0, TAU); g.fill();
}

// Road par khadi lift maangti ladki (front view, clear dikhe)
function drawGirl(p) {
  const L = p.look, t = p.t;
  ctx.save();
  ctx.translate(p.x, p.y);

  // highlight ring on road
  const pulse = 0.5 + Math.sin(t * 0.8) * 0.5;
  ctx.strokeStyle = `rgba(255,121,198,${0.35 + pulse * 0.4})`;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, 22, 24 + pulse * 4, 9 + pulse * 1.5, 0, 0, TAU); ctx.stroke();
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.beginPath(); ctx.ellipse(3, 22, 14, 5, 0, 0, TAU); ctx.fill();

  // legs + shoes
  ctx.fillStyle = "#2c3e70";
  ctx.fillRect(-6, 6, 5, 15); ctx.fillRect(1, 6, 5, 15);
  ctx.fillStyle = "#fff";
  rr(ctx, -8, 19, 7, 4, 2); ctx.fill(); rr(ctx, 1, 19, 7, 4, 2); ctx.fill();

  // kurti / dress
  ctx.fillStyle = L.dress;
  ctx.beginPath();
  ctx.moveTo(-7, -12); ctx.lineTo(7, -12); ctx.lineTo(11, 9); ctx.lineTo(-11, 9); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.3)";
  ctx.fillRect(-11, 5, 22, 2);

  // bag strap
  ctx.strokeStyle = "#5a3a22"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-6, -12); ctx.lineTo(8, 4); ctx.stroke();
  ctx.fillStyle = "#7a4b2a"; rr(ctx, 6, 2, 7, 6, 1.5); ctx.fill();

  // arms: left down, right waving (thumb up for lift)
  ctx.strokeStyle = L.skin; ctx.lineWidth = 3.5; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-7, -10); ctx.lineTo(-10, 2); ctx.stroke();
  const wave = Math.sin(t * 1.6) * 0.5;
  ctx.save(); ctx.translate(7, -10); ctx.rotate(-1.1 + wave);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -13); ctx.stroke();
  ctx.fillStyle = L.skin; ctx.beginPath(); ctx.arc(0, -14, 2.6, 0, TAU); ctx.fill();
  ctx.restore();

  // long hair (behind head)
  ctx.fillStyle = L.hair;
  ctx.beginPath(); ctx.ellipse(0, -20, 8.5, 8.5, 0, 0, TAU); ctx.fill();
  rr(ctx, -9.5, -21, 4.5, 16, 2.2); ctx.fill();   // left side long hair
  rr(ctx, 5, -21, 4.5, 16, 2.2); ctx.fill();      // right side long hair
  // face
  ctx.fillStyle = L.skin;
  ctx.beginPath(); ctx.arc(0, -19, 6.5, 0, TAU); ctx.fill();
  // fringe
  ctx.fillStyle = L.hair;
  ctx.beginPath(); ctx.arc(0, -21, 7, Math.PI, TAU); ctx.fill();
  // eyes + smile
  ctx.fillStyle = "#222";
  ctx.beginPath(); ctx.arc(-2.3, -18.5, 0.9, 0, TAU); ctx.arc(2.3, -18.5, 0.9, 0, TAU); ctx.fill();
  ctx.strokeStyle = "#a33"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, -16.5, 2, 0.2, Math.PI - 0.2); ctx.stroke();

  // speech bubble
  const by = -46 + Math.sin(t * 0.9) * 2;
  ctx.fillStyle = "#fff";
  rr(ctx, -24, by - 10, 48, 20, 10); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-4, by + 9); ctx.lineTo(4, by + 9); ctx.lineTo(0, by + 16); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#e0267f";
  ctx.font = "bold 12px Rajdhani, Segoe UI, Arial"; ctx.textAlign = "center";
  ctx.fillText("LIFT? 👍", 0, by + 4);

  ctx.restore();
}

function drawCoin(p) {
  const sx = Math.abs(Math.cos(p.t)) * p.r + 2;
  ctx.fillStyle = "#c99700";
  ctx.beginPath(); ctx.ellipse(p.x, p.y, sx, p.r, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#ffd34d";
  ctx.beginPath(); ctx.ellipse(p.x, p.y, Math.max(1, sx - 3), p.r - 3, 0, 0, TAU); ctx.fill();
}

function drawNitro(p) {
  const pulse = 1 + Math.sin(p.t) * 0.1;
  ctx.save();
  ctx.translate(p.x, p.y); ctx.scale(pulse, pulse);
  ctx.shadowColor = "#00c6ff"; ctx.shadowBlur = 18;
  ctx.fillStyle = "#1e88e5";
  rr(ctx, -10, -16, 20, 32, 6); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#fff";
  ctx.font = "bold 10px Arial"; ctx.textAlign = "center";
  ctx.fillText("N₂O", 0, 4);
  ctx.restore();
}

function drawFuel(p) {
  const pulse = 1 + Math.sin(p.t) * 0.08;
  ctx.save();
  ctx.translate(p.x, p.y); ctx.scale(pulse, pulse);
  ctx.shadowColor = "#2ecc71"; ctx.shadowBlur = 20;
  // jerry can
  ctx.fillStyle = "#d62828";
  rr(ctx, -12, -14, 24, 30, 4); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#8b0000"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(8, 12); ctx.moveTo(8, -10); ctx.lineTo(-8, 12); ctx.stroke();
  // handle + spout
  ctx.fillStyle = "#222";
  rr(ctx, -9, -20, 10, 6, 2); ctx.fill();
  ctx.fillStyle = "#ffcc00";
  ctx.fillRect(5, -20, 5, 6);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 9px Arial"; ctx.textAlign = "center";
  ctx.fillText("FUEL", 0, 4);
  ctx.restore();
}

// ================== LOOP ==================
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  animT += dt;
  if (state === "play") update(dt);
  else if (state === "over") { updateParticles(dt); shake *= 0.92; }
  else if (state === "menu") {
    roadOffset = (roadOffset + 200 * dt) % 80;
    trackS += 200 * dt; bgX -= trackCurve(trackS) * 200 * dt * 900;
    trees.forEach(t => { t.y += 200 * dt; if (t.y > H + 60) t.y -= treeSpan; });
  }
  draw();
  requestAnimationFrame(loop);
}

resizeGame();
reset();
renderBikeSelect();
route();
// Android par gyro bina permission chalta hai — pehle se sun lo
if (isTouch && window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission !== "function") enableGyro();
requestAnimationFrame(loop);

// ================== PWA (Install + offline) ==================
if ("serviceWorker" in navigator) {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
let installEvt = null;
addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  installEvt = e;
  $("installBtn").classList.remove("hidden");
});
$("installBtn").onclick = async () => {
  if (!installEvt) return;
  installEvt.prompt();
  try { await installEvt.userChoice; } catch (e) {}
  installEvt = null;
  $("installBtn").classList.add("hidden");
};
addEventListener("appinstalled", () => $("installBtn").classList.add("hidden"));
