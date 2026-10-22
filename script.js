// ================== TURBO BIKE RUSH v6 ==================
// Features: 3 bikes, two-way traffic, fuel system, nitro, near-miss bonus
// v3: 3 modes (One Way / Two Way / Racing), phone tilt (gyro) steering,
//     auto full screen, auto pause, PWA install
// v4: 3D road view (bike ke peeche se camera), road par mod (curves) + chadhaai-utaar (hills)
// v6: COCKPIT camera (handlebar, dials, mirror) + CHASE camera, din ka highway, asli jaisi gaadiyan
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
    g.save(); g.translate(36, 91); g.scale(0.82, 0.82);
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

// ================== SETTINGS (phone mein save hoti hain) ==================
const SETTINGS_DEF = { steer: "tilt", sens: 22, dead: 3, invert: false, zero: 0, sound: true, vibrate: true, cam: "cockpit" };
let settings = { ...SETTINGS_DEF };
try { settings = { ...SETTINGS_DEF, ...JSON.parse(localStorage.getItem("bikeSettings") || "{}") }; } catch (e) {}
function saveSettings() { try { localStorage.setItem("bikeSettings", JSON.stringify(settings)); } catch (e) {} }
function buzz(p) { if (settings.vibrate && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} } }

document.querySelectorAll("#touch button").forEach(b => {
  const k = b.dataset.key;
  b.addEventListener("pointerdown", e => { e.preventDefault(); keys[k] = true; buzz(8); });
  ["pointerup", "pointerleave", "pointercancel"].forEach(ev =>
    b.addEventListener(ev, () => (keys[k] = false)));
});

// ---------- GYRO STEERING (phone tilt) ----------
// Phone ko left/right jhukao = bike left/right. Buttons sirf Brake / Nitro / Gas.
// Agar phone mein gyro sensor nahi hai ya permission nahi mili, to ◀ ▶ buttons wapas aa jayenge.
// Settings se: sensitivity, dead zone, ulta (invert), calibrate, ya Buttons steering.
let tiltSteer = 0, tiltRaw = 0, gyroOn = false, gyroAsked = false;
function onTilt(e) {
  if (e.gamma == null) return;
  gyroOn = true;
  if (settings.steer === "tilt") ui.touch.classList.remove("nogyro");
  let g = e.gamma;                          // portrait: left/right tilt
  const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
  if (ang === 90) g = e.beta; else if (ang === -90 || ang === 270) g = -e.beta; else if (ang === 180) g = -e.gamma;
  tiltRaw = g;
  const v = (g - settings.zero) * (settings.invert ? -1 : 1);
  const full = Math.max(settings.dead + 2, settings.sens);
  const a = Math.min(1, Math.max(0, (Math.abs(v) - settings.dead) / (full - settings.dead)));
  tiltSteer = Math.sign(v) * a;
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
let audio, engineOsc, engineGain, muted = !settings.sound;
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
function toggleMute() {
  muted = !muted; if (engineGain) engineGain.gain.value = 0;
  settings.sound = !muted; saveSettings();
  if (typeof syncSettingsUI === "function") syncSettingsUI();
}

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
    if (settings.steer === "buttons") ui.touch.classList.add("nogyro");
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
// Phone par P key nahi hoti: Pause screen par tap karke resume (buttons ke alawa kahin bhi)
ui.pause.addEventListener("click", e => {
  if (e.target.closest && e.target.closest(".panel button")) return;
  if (state === "pause") togglePause();
});
$("pauseBtn").addEventListener("click", () => { if (state === "play" || state === "pause") togglePause(); });
$("resumeBtn").onclick = () => { if (state === "pause") togglePause(); };
$("quitBtn").onclick = () => {                  // race chhod ke bike select par
  if (state !== "pause") return;
  state = "menu";
  ui.pause.classList.add("hidden");
  reset();
  ui.start.classList.remove("hidden");
  renderBikeSelect();
};

// ================== SETTINGS SCREEN ==================
const setUI = {
  screen: $("settingsScreen"), sens: $("setSens"), dead: $("setDead"), invert: $("setInvert"),
  sound: $("setSound"), vib: $("setVibrate"), sensVal: $("sensVal"), deadVal: $("deadVal"),
  knob: $("tiltKnob"), tiltNote: $("tiltNote"), tiltBox: $("tiltBox"), calMsg: $("calMsg"),
};
function syncSettingsUI() {
  document.querySelectorAll("#steerSeg button").forEach(b => b.classList.toggle("active", b.dataset.steer === settings.steer));
  document.querySelectorAll("#camSeg button").forEach(b => b.classList.toggle("active", b.dataset.cam === (settings.cam || "cockpit")));
  setUI.sens.value = 46 - settings.sens;                       // slider: zyada = zyada sensitive
  setUI.sensVal.textContent = Math.round((46 - settings.sens - 10) / 26 * 100) + "%";
  setUI.dead.value = settings.dead;
  setUI.deadVal.textContent = settings.dead + "°";
  setUI.invert.checked = settings.invert;
  setUI.sound.checked = settings.sound;
  setUI.vib.checked = settings.vibrate;
  setUI.tiltBox.classList.toggle("disabled", settings.steer !== "tilt");
}
function openSettings() {
  if (isTouch) enableGyro();               // iPhone: permission isi tap par maangi jayegi
  syncSettingsUI();
  setUI.tiltNote.textContent = isTouch ? "Phone ko left/right jhuka kar dekho 👇" : "Tilt steering sirf phone par chalti hai";
  setUI.calMsg.textContent = "";
  setUI.screen.classList.remove("hidden");
}
function closeSettings() { setUI.screen.classList.add("hidden"); }
document.querySelectorAll(".settings-open").forEach(b => b.addEventListener("click", e => { e.stopPropagation(); openSettings(); }));
$("setDone").onclick = closeSettings;
$("setReset").onclick = () => {
  settings = { ...SETTINGS_DEF };
  muted = !settings.sound;
  saveSettings(); syncSettingsUI();
  setUI.calMsg.textContent = "Default settings wapas aa gayi";
};
document.querySelectorAll("#steerSeg button").forEach(b => b.onclick = () => {
  settings.steer = b.dataset.steer;
  ui.touch.classList.toggle("nogyro", settings.steer === "buttons" || (isTouch && !gyroOn && state === "play"));
  saveSettings(); syncSettingsUI();
});
// Camera: COCKPIT (rider ki nazar) / CHASE (bike peeche se)
function setCam(c) { settings.cam = c; saveSettings(); syncSettingsUI(); }
document.querySelectorAll("#camSeg button").forEach(b => b.onclick = () => setCam(b.dataset.cam));
$("camBtn").addEventListener("click", e => { e.stopPropagation(); setCam(isCockpit() ? "chase" : "cockpit"); buzz(10); });
addEventListener("keydown", e => { if (e.code === "KeyC" && !e.repeat) setCam(isCockpit() ? "chase" : "cockpit"); });
setUI.sens.oninput = () => { settings.sens = 46 - +setUI.sens.value; saveSettings(); syncSettingsUI(); };
setUI.dead.oninput = () => {
  settings.dead = +setUI.dead.value;
  if (settings.sens < settings.dead + 4) settings.sens = settings.dead + 4;
  saveSettings(); syncSettingsUI();
};
setUI.invert.onchange = () => { settings.invert = setUI.invert.checked; saveSettings(); };
setUI.sound.onchange = () => {
  settings.sound = setUI.sound.checked; muted = !settings.sound;
  if (engineGain) engineGain.gain.value = 0;
  saveSettings();
};
setUI.vib.onchange = () => { settings.vibrate = setUI.vib.checked; saveSettings(); buzz(20); };
$("calBtn").onclick = () => {
  if (!gyroOn) { setUI.calMsg.textContent = "Gyro sensor nahi mila — phone par try karo"; return; }
  settings.zero = Math.round(tiltRaw * 10) / 10;
  saveSettings();
  setUI.calMsg.textContent = "✓ Calibrated! Ab ye position seedhi (center) maani jayegi";
  buzz(30);
};
// Live tilt preview (settings khuli ho tab)
function updateTiltPreview() {
  if (setUI.screen.classList.contains("hidden")) return;
  const v = gyroOn ? tiltSteer : 0;
  setUI.knob.style.left = (50 + v * 45) + "%";
  setUI.knob.classList.toggle("on", Math.abs(v) > 0);
}

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
    buzz([60, 40, 140]);
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
  if (!steer && gyroOn && isTouch && settings.steer === "tilt") steer = tiltSteer;
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

// ================== 3D ROAD VIEW (2 camera: COCKPIT + CHASE) ==================
// Game ka logic (lanes, traffic, collision) waisa hi hai — sirf dikhne ka tareeka badla hai.
// Har cheez ko "kitni door aage hai (d)" aur "road ke center se kitni side (lat)" se screen par project karte hain.
//  COCKPIT = rider ki aankh se (handlebar, dials, mirror dikhte hain)
//  CHASE   = bike ke peeche se (bike + rider dikhta hai)
let CAM_BACK = 330;                   // camera bike se kitna peeche (game px)
const SEG = 30, NSEG = 140;           // road ke tukde, aage ~4k px tak
const ROAD_HW = 180;                  // road ki aadhi chaudai (game px)
const segD = new Float32Array(NSEG + 1), segX = new Float32Array(NSEG + 1), segY = new Float32Array(NSEG + 1);
const segSc = new Float32Array(NSEG + 1), segEl = new Float32Array(NSEG + 1), segClip = new Float32Array(NSEG + 1);
let horizonY = 0, camH = 1, FOCAL = 1, camX = 0, trackS = 0, bgX = 0, segStart = 0, roll = 0, fovKick = 0;
const FOG = "#d9cdb8";                 // din ki dhundh (garam rang)
const isCockpit = () => settings.cam !== "chase";

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
  const boost = boosting && state === "play";
  fovKick += ((boost ? 1 : 0) - fovKick) * 0.08;          // nitro par view thoda khulta hai (speed feel)
  if (isCockpit()) {
    CAM_BACK = 46;                                       // camera = rider ki aankh
    horizonY = Math.round(H * 0.4);
    FOCAL = 330 * (1 - fovKick * 0.12);
    camH = 128;                                          // aankh ki oonchai (game px)
  } else {
    CAM_BACK = 330;
    horizonY = Math.round(H * 0.27);
    const groundY = H - (isTouch ? 228 : 150);           // bike ka pahiya screen par kahan
    FOCAL = 250 * CAM_BACK / ROAD_HW * (1 - fovKick * 0.08);
    camH = (groundY - horizonY) * CAM_BACK / FOCAL;
  }
}

function buildSegments() {
  const D0 = -CAM_BACK + 26;
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

// ---------- Aasmaan: din, suraj ki chamak, baadal, pathrile pahaad ----------
const CLOUDS = Array.from({ length: 9 }, (_, i) => ({ x: hash(i * 7 + 1), y: 0.12 + hash(i * 7 + 2) * 0.5, s: 0.6 + hash(i * 7 + 3) * 0.9 }));

function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, horizonY);
  g.addColorStop(0, "#3d7fcf"); g.addColorStop(0.55, "#8ec2ee"); g.addColorStop(0.9, "#dbe7ee"); g.addColorStop(1, "#efe3cc");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, horizonY + 2);

  // suraj + glare
  const sx = W * 0.78 + ((bgX * 0.1) % (W * 1.6) + W * 1.6) % (W * 1.6) - W * 0.8, sy = horizonY * 0.28;
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const sg = ctx.createRadialGradient(sx, sy, 2, sx, sy, horizonY * 0.9);
  sg.addColorStop(0, "rgba(255,250,225,.95)"); sg.addColorStop(0.08, "rgba(255,240,200,.55)"); sg.addColorStop(0.4, "rgba(255,230,190,.12)"); sg.addColorStop(1, "rgba(255,230,190,0)");
  ctx.fillStyle = sg; ctx.fillRect(0, 0, W, horizonY + 2);
  ctx.restore();

  // baadal
  for (const c of CLOUDS) {
    const x = ((c.x * W * 2.2 + bgX * 0.18 + animT * 4) % (W * 1.6) + W * 1.6) % (W * 1.6) - W * 0.3;
    const y = c.y * horizonY * 0.75, s = c.s * W / 480;
    ctx.fillStyle = "rgba(255,255,255,.75)";
    ctx.beginPath();
    ctx.ellipse(x, y, 46 * s, 11 * s, 0, 0, TAU); ctx.ellipse(x - 22 * s, y + 3 * s, 26 * s, 9 * s, 0, 0, TAU);
    ctx.ellipse(x + 26 * s, y + 2 * s, 30 * s, 9 * s, 0, 0, TAU); ctx.ellipse(x + 4 * s, y - 7 * s, 24 * s, 11 * s, 0, 0, TAU);
    ctx.fill();
  }

  mountains(bgX * 0.2, "#a59aa6", horizonY * 0.30, 1.3, 0.55);
  mountains(bgX * 0.35, "#8b7766", horizonY * 0.22, 4.1, 0.3);
  mountains(bgX * 0.55, "#a7845d", horizonY * 0.12, 2.2, 0.1);
}
function mountains(off, col, amp, seed, haze) {
  const top = horizonY - amp;
  const g = ctx.createLinearGradient(0, top, 0, horizonY);
  g.addColorStop(0, mixC(col, "#ffffff", haze * 0.3)); g.addColorStop(1, mixC(col, FOG, 0.35 + haze * 0.4));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(0, horizonY + 2);
  for (let x = 0; x <= W + 12; x += 12) {
    const u = x - off;
    const y = horizonY - amp * (0.55 + 0.45 * Math.sin(u * 0.011 + seed)) * (0.65 + 0.35 * Math.sin(u * 0.029 + seed * 2.3))
            - amp * 0.06 * Math.sin(u * 0.13 + seed * 5);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, horizonY + 2); ctx.closePath(); ctx.fill();
}

// ---------- Road (zameen + shoulder + road + lines + guardrail) ----------
function quad(x1, y1, w1, x2, y2, w2, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x1 - w1, y1); ctx.lineTo(x1 + w1, y1);
  ctx.lineTo(x2 + w2, y2); ctx.lineTo(x2 - w2, y2);
  ctx.closePath(); ctx.fill();
}
function drawRoad() {
  const gg = ctx.createLinearGradient(0, horizonY, 0, horizonY + Math.max(60, H * 0.14));
  gg.addColorStop(0, mixC("#c9ad7c", FOG, 0.7));
  gg.addColorStop(1, mixC("#b39260", FOG, 0.25));
  ctx.fillStyle = gg;
  ctx.fillRect(0, horizonY, W, H - horizonY + 2);
  const lines = mode === "twoway" ? [-90, 90] : [-90, 0, 90];
  const RAIL = ROAD_HW + 46;
  for (let i = NSEG - 1; i >= 0; i--) {
    const yN = segY[i], yF = segY[i + 1] - 0.6;
    if (yF >= yN || yF > H) continue;              // hill ke peeche chhupa hissa
    const sN = segSc[i], sF = segSc[i + 1];
    const cN = W / 2 + (segX[i] - camX) * sN, cF = W / 2 + (segX[i + 1] - camX) * sF;
    const n = Math.floor((trackS + segD[i]) / SEG + 0.5);
    const alt = Math.floor(n / 3) % 2 === 0;
    const fog = Math.min(0.8, Math.max(0, (segD[i] - 1700) / 2600));

    // registaani zameen + gravel
    ctx.fillStyle = mixC(alt ? "#b8955f" : "#ad8b57", FOG, fog);
    ctx.fillRect(0, yF, W, yN - yF + 1);
    quad(cN, yN, (RAIL + 26) * sN, cF, yF, (RAIL + 26) * sF, mixC(alt ? "#9c8a70" : "#958368", FOG, fog));
    // shoulder + road
    quad(cN, yN, (ROAD_HW + 30) * sN, cF, yF, (ROAD_HW + 30) * sF, mixC("#77787a", FOG, fog));
    quad(cN, yN, ROAD_HW * sN, cF, yF, ROAD_HW * sF, mixC(alt ? "#5c5e62" : "#585a5e", FOG, fog));
    // tyre ke ghise nishaan (har lane mein do halki dark patti)
    const tc = mixC("#4f5154", FOG, fog);
    for (let l = 0; l < LANES; l++) {
      const lc = laneX(l) - 240;
      quad(cN + (lc - 22) * sN, yN, 7 * sN, cF + (lc - 22) * sF, yF, 7 * sF, tc);
      quad(cN + (lc + 22) * sN, yN, 7 * sN, cF + (lc + 22) * sF, yF, 7 * sF, tc);
    }
    // road ke kinare safed line
    const edge = mixC("#f2f2f2", FOG, fog);
    quad(cN - (ROAD_HW - 4) * sN, yN, 2.4 * sN, cF - (ROAD_HW - 4) * sF, yF, 2.4 * sF, edge);
    quad(cN + (ROAD_HW - 4) * sN, yN, 2.4 * sN, cF + (ROAD_HW - 4) * sF, yF, 2.4 * sF, edge);
    // lane dashes
    if (alt) {
      const lc = mixC("#fafafa", FOG, fog);
      for (const L of lines) quad(cN + L * sN, yN, 2.4 * sN, cF + L * sF, yF, 2.4 * sF, lc);
    }
    // Two Way: beech mein double peeli line
    if (mode === "twoway") {
      const yc = mixC("#f2c200", FOG, fog);
      quad(cN - 4.5 * sN, yN, 1.8 * sN, cF - 4.5 * sF, yF, 1.8 * sF, yc);
      quad(cN + 4.5 * sN, yN, 1.8 * sN, cF + 4.5 * sF, yF, 1.8 * sF, yc);
    }
    // steel guardrail dono taraf (beam + posts)
    const hN = 24 * sN, hF = 24 * sF;
    [-1, 1].forEach(sd => {
      const xN = cN + sd * RAIL * sN, xF = cF + sd * RAIL * sF;
      ctx.fillStyle = mixC("#5d6168", FOG, fog);
      ctx.beginPath();
      ctx.moveTo(xN, yN - hN * 0.55); ctx.lineTo(xN, yN - hN); ctx.lineTo(xF, yF - hF); ctx.lineTo(xF, yF - hF * 0.55);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = mixC("#c9ced6", FOG, fog);
      ctx.beginPath();
      ctx.moveTo(xN, yN - hN * 0.72); ctx.lineTo(xN, yN - hN * 0.98); ctx.lineTo(xF, yF - hF * 0.98); ctx.lineTo(xF, yF - hF * 0.72);
      ctx.closePath(); ctx.fill();
      if (n % 2 === 0) {
        ctx.fillStyle = mixC("#3e4248", FOG, fog);
        ctx.fillRect(xN - 1.6 * sN, yN - hN * 0.98, 3.2 * sN, hN * 0.98);
        if (n % 4 === 0) {                                     // reflector
          ctx.fillStyle = mixC(sd < 0 ? "#ff5a3c" : "#ffd23c", FOG, fog);
          ctx.fillRect(xN - 2 * sN, yN - hN * 0.86, 4 * sN, 3 * sN);
        }
      }
    });
  }
}

// Har lane mein direction arrow (Two Way mein left wali lanes neeche ki taraf = saamne se gaadi)
const ARROW = [[0, -2.5], [34, -2.5], [34, -8], [56, 0], [34, 8], [34, 2.5], [0, 2.5]];
function drawLaneArrows() {
  const GAP = 640, n0 = Math.ceil((trackS + 40) / GAP), n1 = Math.floor((trackS + 2600) / GAP);
  for (let n = n1; n >= n0; n--) {
    const d0 = n * GAP - trackS;
    const fog = Math.min(1, Math.max(0, (d0 - 1600) / 1000));
    ctx.fillStyle = `rgba(255,255,255,${0.55 * (1 - fog)})`;
    for (let l = 0; l < LANES; l++) {
      const lat = laneX(l) - 240, down = isOncoming(l);
      ctx.beginPath();
      let ok = true;
      ARROW.forEach(([dd, ll], k) => {
        const pp = project(d0 + (down ? 56 - dd : dd), lat + ll * 1.6);
        if (!pp) { ok = false; return; }
        k ? ctx.lineTo(pp.x, pp.y) : ctx.moveTo(pp.x, pp.y);
      });
      if (ok) { ctx.closePath(); ctx.fill(); }
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

// ---------- Gaadiyan (asli look: sedan / SUV / pickup / hatch / container truck) ----------
const CAR_KINDS = ["sedan", "suv", "pickup", "hatch", "sedan", "suv"];
function carKind(c) {
  if (!c.vis) c.vis = c.truck ? (Math.random() < 0.5 ? "box" : "tanker") : CAR_KINDS[Math.floor(Math.random() * CAR_KINDS.length)];
  return c.vis;
}
function wheel(x, y, w, h) {
  ctx.fillStyle = "#0e0e10"; rr(ctx, x, y, w, h, 2.5); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fillRect(x + 1.5, y + 1, w - 3, 2);
}
function drawCarView(c) {
  const kind = carKind(c), w = c.w, hw = w / 2, front = c.oncoming;
  const col = c.color.length === 7 ? c.color : "#888888";
  // parchhai
  const sh = ctx.createRadialGradient(0, 0, 2, 0, 0, hw + 10);
  sh.addColorStop(0, "rgba(0,0,0,.5)"); sh.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(0, -1, hw + 9, 7, 0, 0, TAU); ctx.fill();

  if (c.truck) { drawTruckView(c, kind, w, hw, front, col); return; }
  const tall = kind === "suv" ? 1.18 : kind === "pickup" ? 1.12 : kind === "hatch" ? 1.05 : 1;
  const bodyTop = -25 * tall, roofTop = -39 * tall;
  wheel(-hw + 1, -11, 9, 11); wheel(hw - 10, -11, 9, 11);

  // body
  const g = ctx.createLinearGradient(0, bodyTop, 0, -5);
  g.addColorStop(0, shade(col, 50)); g.addColorStop(0.35, col); g.addColorStop(1, shade(col, -60));
  ctx.fillStyle = g; rr(ctx, -hw, bodyTop, w, -bodyTop - 6, 5); ctx.fill();
  // cabin
  const cabW = kind === "pickup" ? 0.78 : 0.86, topW = kind === "suv" ? 0.8 : 0.66;
  ctx.fillStyle = shade(col, -18);
  ctx.beginPath();
  ctx.moveTo(-hw * cabW - 1, bodyTop + 1); ctx.lineTo(-hw * topW, roofTop + 2);
  ctx.quadraticCurveTo(0, roofTop - 1, hw * topW, roofTop + 2); ctx.lineTo(hw * cabW + 1, bodyTop + 1);
  ctx.closePath(); ctx.fill();
  // sheesha (reflection ke saath)
  const gl = ctx.createLinearGradient(-hw, roofTop, hw, bodyTop);
  gl.addColorStop(0, front ? "#bfe0f7" : "#2b3d52"); gl.addColorStop(0.45, front ? "#7fb2d8" : "#162330"); gl.addColorStop(1, front ? "#4a7aa0" : "#0b131c");
  ctx.fillStyle = gl;
  ctx.beginPath();
  ctx.moveTo(-hw * cabW + 3, bodyTop - 0.5); ctx.lineTo(-hw * topW + 3, roofTop + 4.5);
  ctx.lineTo(hw * topW - 3, roofTop + 4.5); ctx.lineTo(hw * cabW - 3, bodyTop - 0.5);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.22)";
  ctx.beginPath(); ctx.moveTo(-hw * topW + 6, roofTop + 5); ctx.lineTo(-hw * topW + 13, roofTop + 5); ctx.lineTo(-hw * cabW + 9, bodyTop - 1); ctx.lineTo(-hw * cabW + 3, bodyTop - 1); ctx.closePath(); ctx.fill();
  // roof highlight
  ctx.fillStyle = "rgba(255,255,255,.25)"; ctx.fillRect(-hw * topW + 2, roofTop + 1.5, hw * topW * 2 - 4, 1.4);
  if (kind === "pickup" && !front) {                       // pickup ka tailgate neeche
    ctx.fillStyle = shade(col, -8); rr(ctx, -hw, bodyTop + 4, w, -bodyTop - 10, 3); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.3)"; ctx.lineWidth = 0.8; ctx.strokeRect(-hw + 3, bodyTop + 7, w - 6, -bodyTop - 16);
  }
  // bumper + chrome
  ctx.fillStyle = "#202226"; rr(ctx, -hw + 0.5, -10, w - 1, 5, 2); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(-hw + 4, -14.5, w - 8, 1);
  if (front) {
    ctx.fillStyle = "#16181b"; rr(ctx, -9, -20, 18, 7, 2); ctx.fill();          // grille
    ctx.strokeStyle = "#555"; ctx.lineWidth = 0.7;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-8, -18 + k * 2); ctx.lineTo(8, -18 + k * 2); ctx.stroke(); }
    lights(-hw + 2.5, hw - 12.5, -21, 10, 4.5, "#fffbe0", 12);
    ctx.fillStyle = "#f2f2f2"; rr(ctx, -5, -12.5, 10, 3.5, 0.8); ctx.fill();
  } else {
    lights(-hw + 2, hw - 12, -22 * tall + 1, 10, 4.5, "#ff2b2b", 6);
    ctx.fillStyle = "#ffb04a"; ctx.fillRect(-hw + 2, -22 * tall + 5.5, 4, 1.4); ctx.fillRect(hw - 6, -22 * tall + 5.5, 4, 1.4);
    ctx.fillStyle = "#f2f2f2"; rr(ctx, -6, -17, 12, 5, 1); ctx.fill();
    ctx.fillStyle = "#333"; ctx.fillRect(-4, -15, 8, 1);
  }
}
function drawTruckView(c, kind, w, hw, front, col) {
  wheel(-hw + 1, -12, 11, 12); wheel(hw - 12, -12, 11, 12);
  if (front) {
    const box = kind === "tanker" ? "#d9dde3" : col;
    ctx.fillStyle = shade(box, -20); rr(ctx, -hw, -74, w, 32, 4); ctx.fill();
    const bg2 = ctx.createLinearGradient(0, -50, 0, -8);
    bg2.addColorStop(0, shade("#e9ecef", 0)); bg2.addColorStop(1, shade("#9aa1aa", -10));
    ctx.fillStyle = bg2; rr(ctx, -hw, -50, w, 42, 4); ctx.fill();
    const gl = ctx.createLinearGradient(0, -47, 0, -31);
    gl.addColorStop(0, "#bfe0f7"); gl.addColorStop(1, "#4a7aa0");
    ctx.fillStyle = gl; rr(ctx, -hw + 4, -47, w - 8, 16, 2); ctx.fill();
    ctx.fillStyle = "#1c1e21"; rr(ctx, -hw + 10, -27, w - 20, 12, 2); ctx.fill();
    ctx.strokeStyle = "#666"; ctx.lineWidth = 0.8;
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-hw + 11, -25 + k * 3); ctx.lineTo(hw - 11, -25 + k * 3); ctx.stroke(); }
    lights(-hw + 1.5, hw - 11.5, -22, 10, 6, "#fffbe0", 14);
    ctx.fillStyle = "#202226"; rr(ctx, -hw, -11, w, 4, 1); ctx.fill();
    return;
  }
  if (kind === "tanker") {
    const tg = ctx.createLinearGradient(-hw, 0, hw, 0);
    tg.addColorStop(0, "#8d949d"); tg.addColorStop(0.45, "#f4f6f8"); tg.addColorStop(1, "#7c838c");
    ctx.fillStyle = tg; ctx.beginPath(); ctx.ellipse(0, -40, hw, 27, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, -40, hw - 6, 21, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = col; ctx.fillRect(-hw + 2, -42, w - 4, 4);
    ctx.fillStyle = "#30343a"; rr(ctx, -hw + 2, -15, w - 4, 5, 1); ctx.fill();
  } else {
    const cg = ctx.createLinearGradient(-hw, 0, hw, 0);
    cg.addColorStop(0, shade(col, -55)); cg.addColorStop(0.5, shade(col, 15)); cg.addColorStop(1, shade(col, -55));
    ctx.fillStyle = cg; rr(ctx, -hw, -70, w, 60, 2); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 1;
    for (let k = 1; k < 8; k++) { ctx.beginPath(); ctx.moveTo(-hw + k * w / 8, -68); ctx.lineTo(-hw + k * w / 8, -12); ctx.stroke(); }
    ctx.lineWidth = 1.6; ctx.strokeStyle = "rgba(0,0,0,.55)";
    ctx.beginPath(); ctx.moveTo(0, -69); ctx.lineTo(0, -11); ctx.stroke();
    ctx.strokeStyle = "#c9ced6"; ctx.lineWidth = 1.4;
    [-hw * 0.5, hw * 0.5].forEach(x => { ctx.beginPath(); ctx.moveTo(x, -66); ctx.lineTo(x, -14); ctx.stroke(); });
    ctx.fillStyle = "#ffd23c"; ctx.fillRect(-hw, -13, w, 2);
  }
  ctx.fillStyle = "#1a1a1a"; rr(ctx, -hw, -10, w, 4, 1); ctx.fill();
  lights(-hw + 2, hw - 10, -17, 8, 5, "#ff2b2b", 6);
  ctx.fillStyle = "#f2f2f2"; rr(ctx, -6, -19, 12, 5.5, 1); ctx.fill();
}
function lights(xl, xr, y, w, h, col, blur) {
  ctx.save();
  ctx.shadowColor = col; ctx.shadowBlur = blur; ctx.fillStyle = col;
  rr(ctx, xl, y, w, h, 1.5); ctx.fill();
  rr(ctx, xr, y, w, h, 1.5); ctx.fill();
  ctx.restore();
}

// Bike peeche se (asli sport bike + rider ka proportion) — ground point (0,0) par, 1 unit ≈ 1.6 cm
function drawBikeRear(g, b, o) {
  const t = o.t || 0, wa = o.wheel || 0;
  const dark = shade(b.color, -75), mid = b.color, light = shade(b.color, 45);
  g.save();
  g.rotate((o.tilt || 0) * 0.35);

  // zameen par parchhai
  const sh = g.createRadialGradient(0, -1, 2, 0, -1, 26);
  sh.addColorStop(0, "rgba(0,0,0,.55)"); sh.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = sh; g.beginPath(); g.ellipse(0, -1, 26, 7, 0, 0, TAU); g.fill();

  // nitro flame (muffler se camera ki taraf)
  if (o.boost) {
    const fl = 16 + Math.random() * 16;
    const fg = g.createLinearGradient(0, -23, 0, -23 + fl);
    fg.addColorStop(0, "#ffffff"); fg.addColorStop(0.25, "#7ff3ff"); fg.addColorStop(0.6, "#00a2ff"); fg.addColorStop(1, "rgba(122,92,255,0)");
    g.save(); g.globalCompositeOperation = "lighter";
    g.fillStyle = fg; g.beginPath(); g.ellipse(14.5, -23 + fl / 2, 4.6, fl / 2, -0.15, 0, TAU); g.fill();
    g.restore();
  }

  // ---- pichla tyre (chauda, tread chalta hua) ----
  const ty = g.createLinearGradient(-7, 0, 7, 0);
  ty.addColorStop(0, "#050505"); ty.addColorStop(0.5, "#2a2a2a"); ty.addColorStop(1, "#050505");
  g.fillStyle = ty; rr(g, -7, -27, 14, 27, 6); g.fill();
  g.strokeStyle = "rgba(255,255,255,.12)"; g.lineWidth = 1.2;
  for (let k = 0; k < 5; k++) {
    const yy = -25 + ((k * 5.2 + wa * 0.6) % 24);
    g.beginPath(); g.moveTo(-4.5, yy); g.lineTo(0, yy + 1.6); g.lineTo(4.5, yy); g.stroke();
  }
  // swingarm (silver) + chain
  g.strokeStyle = "#9aa3ad"; g.lineWidth = 2.6; g.lineCap = "round";
  g.beginPath(); g.moveTo(-8.5, -14); g.lineTo(-10, -30); g.moveTo(8.5, -14); g.lineTo(10, -30); g.stroke();
  g.strokeStyle = "#444"; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(-9.5, -15); g.lineTo(-11, -29); g.stroke();
  // hugger (tyre ke upar mudguard)
  g.fillStyle = "#151518";
  g.beginPath(); g.moveTo(-8, -24); g.quadraticCurveTo(0, -32, 8, -24); g.lineTo(7, -21); g.quadraticCurveTo(0, -27, -7, -21); g.closePath(); g.fill();

  // ---- side fairing / belly pan (pairon ke peeche se dikhta) ----
  const fg2 = g.createLinearGradient(-19, 0, 19, 0);
  fg2.addColorStop(0, dark); fg2.addColorStop(0.18, mid); fg2.addColorStop(0.5, shade(b.color, -40)); fg2.addColorStop(0.82, mid); fg2.addColorStop(1, dark);
  g.fillStyle = fg2;
  g.beginPath();
  g.moveTo(-18, -27); g.quadraticCurveTo(-20, -40, -15, -52); g.lineTo(15, -52); g.quadraticCurveTo(20, -40, 18, -27);
  g.quadraticCurveTo(0, -22, -18, -27); g.closePath(); g.fill();
  g.fillStyle = b.accent || "#fff";                         // racing decal
  g.beginPath(); g.moveTo(-17.5, -34); g.lineTo(-13, -40); g.lineTo(-13, -37); g.lineTo(-16.5, -31); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(17.5, -34); g.lineTo(13, -40); g.lineTo(13, -37); g.lineTo(16.5, -31); g.closePath(); g.fill();

  // ---- side muffler (right, carbon + chrome) ----
  const mf = g.createLinearGradient(9, 0, 19, 0);
  mf.addColorStop(0, "#1b1b1b"); mf.addColorStop(0.5, "#4a4a4a"); mf.addColorStop(1, "#141414");
  g.fillStyle = mf;
  g.save(); g.translate(14.5, -27); g.rotate(-0.15);
  rr(g, -5, -7, 10, 14, 4); g.fill();
  const ch = g.createRadialGradient(0, 3, 0.5, 0, 3, 4.5);
  ch.addColorStop(0, "#111"); ch.addColorStop(0.55, "#222"); ch.addColorStop(0.6, "#e8e8e8"); ch.addColorStop(1, "#777");
  g.fillStyle = ch; g.beginPath(); g.arc(0, 3, 4.5, 0, TAU); g.fill();
  g.restore();

  // ---- tail section (seat ke neeche nukila tail + LED) ----
  const tg = g.createLinearGradient(-11, 0, 11, 0);
  tg.addColorStop(0, dark); tg.addColorStop(0.5, light); tg.addColorStop(1, dark);
  g.fillStyle = tg;
  g.beginPath();
  g.moveTo(-11, -48); g.lineTo(-7.5, -36); g.quadraticCurveTo(0, -33, 7.5, -36); g.lineTo(11, -48);
  g.quadraticCurveTo(0, -52, -11, -48); g.closePath(); g.fill();
  g.save();
  g.shadowColor = "#ff1a1a"; g.shadowBlur = o.brake ? 22 : 8;
  g.fillStyle = o.brake ? "#ff3030" : "#c00000";
  g.beginPath(); g.moveTo(-8, -43.5); g.quadraticCurveTo(0, -40.5, 8, -43.5); g.lineTo(7, -41.2); g.quadraticCurveTo(0, -38.4, -7, -41.2); g.closePath(); g.fill();
  g.restore();
  // undertail + number plate + indicators
  g.fillStyle = "#121214"; rr(g, -4, -36, 8, 6, 1.5); g.fill();
  g.fillStyle = "#f2f2f2"; rr(g, -6, -31, 12, 6, 1); g.fill();
  g.fillStyle = "#222"; g.font = "bold 3.6px Arial"; g.textAlign = "center"; g.fillText("TBR 07", 0, -26.8);
  g.fillStyle = "#ff9f1c";
  g.beginPath(); g.ellipse(-9.5, -32.5, 1.8, 1.1, 0, 0, TAU); g.ellipse(9.5, -32.5, 1.8, 1.1, 0, 0, TAU); g.fill();

  // ---- RIDER ----
  const suit = b.suit, suitL = shade(b.suit, 45), suitD = shade(b.suit, -35);
  // pair: jaangh tank ko pakde, ghutna bahar, boot peg par
  g.lineCap = "round"; g.lineJoin = "round";
  [-1, 1].forEach(sd => {
    g.strokeStyle = suitD; g.lineWidth = 8.5;
    g.beginPath(); g.moveTo(sd * 8, -52); g.lineTo(sd * 17, -45); g.stroke();       // jaangh
    g.lineWidth = 7;
    g.beginPath(); g.moveTo(sd * 17, -45); g.lineTo(sd * 15.5, -26); g.stroke();    // pindli
    g.strokeStyle = b.color; g.lineWidth = 2;
    g.beginPath(); g.moveTo(sd * 17.5, -43); g.lineTo(sd * 16.3, -31); g.stroke();  // suit stripe
    g.fillStyle = "#e9e9e9";                                                          // knee slider
    g.beginPath(); g.ellipse(sd * 18.5, -45, 2.6, 3.4, 0, 0, TAU); g.fill();
    g.fillStyle = "#0b0b0d"; rr(g, sd * 15.5 - 4.5, -29, 9, 9, 3); g.fill();         // boot
    g.fillStyle = b.color; g.fillRect(sd * 15.5 - 3.5, -24.5, 7, 1.6);
    g.fillStyle = "#777"; g.fillRect(sd * 13 - 1, -21, 2, 3);                          // foot peg
  });

  // seat par baitha hissa
  g.fillStyle = suitD; rr(g, -11, -56, 22, 9, 4); g.fill();

  // peeth (aage jhuki) — leather suit, beech mein spine panel
  const jg = g.createLinearGradient(-16, 0, 16, 0);
  jg.addColorStop(0, suitD); jg.addColorStop(0.3, suit); jg.addColorStop(0.5, suitL); jg.addColorStop(0.7, suit); jg.addColorStop(1, suitD);
  g.fillStyle = jg;
  g.beginPath();
  g.moveTo(-11, -53);
  g.bezierCurveTo(-15, -60, -17, -70, -15, -79);
  g.quadraticCurveTo(-13, -84, -6, -84);
  g.lineTo(6, -84);
  g.quadraticCurveTo(13, -84, 15, -79);
  g.bezierCurveTo(17, -70, 15, -60, 11, -53);
  g.closePath(); g.fill();
  // side panels (bike color) + spine
  g.fillStyle = b.color;
  g.beginPath(); g.moveTo(-14.5, -77); g.quadraticCurveTo(-16, -66, -11.5, -55); g.lineTo(-9, -56); g.quadraticCurveTo(-12.5, -66, -11.5, -77); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(14.5, -77); g.quadraticCurveTo(16, -66, 11.5, -55); g.lineTo(9, -56); g.quadraticCurveTo(12.5, -66, 11.5, -77); g.closePath(); g.fill();
  g.fillStyle = "rgba(0,0,0,.28)"; rr(g, -3, -80, 6, 26, 3); g.fill();
  g.strokeStyle = "rgba(255,255,255,.12)"; g.lineWidth = 0.8;
  for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(-2.5, -76 + k * 4.6); g.lineTo(2.5, -76 + k * 4.6); g.stroke(); }
  // number
  g.fillStyle = "#fff"; g.font = "bold 10px Arial"; g.textAlign = "center";
  g.fillText("7", -8.5, -63); g.fillText("7", 8.5, -63);
  // aero hump (gardan ke peeche)
  const hg = g.createLinearGradient(-7, 0, 7, 0);
  hg.addColorStop(0, dark); hg.addColorStop(0.5, light); hg.addColorStop(1, dark);
  g.fillStyle = hg;
  g.beginPath(); g.moveTo(-7, -82); g.quadraticCurveTo(-7, -90, 0, -91); g.quadraticCurveTo(7, -90, 7, -82); g.closePath(); g.fill();

  // haath: kandha → kohni bahar → grip
  [-1, 1].forEach(sd => {
    g.strokeStyle = suit; g.lineWidth = 6.5;
    g.beginPath(); g.moveTo(sd * 13, -79); g.lineTo(sd * 22, -70); g.lineTo(sd * 20.5, -61); g.stroke();
    g.fillStyle = suitL;                                                         // shoulder armour
    g.beginPath(); g.ellipse(sd * 13.5, -79, 5, 4, sd * 0.5, 0, TAU); g.fill();
    g.fillStyle = "#e9e9e9";                                                     // elbow slider
    g.beginPath(); g.arc(sd * 22.3, -70, 2.3, 0, TAU); g.fill();
    g.fillStyle = "#121212";                                                     // glove
    g.beginPath(); g.ellipse(sd * 20.5, -60, 3.4, 3, 0, 0, TAU); g.fill();
    // clip-on + mirror
    g.strokeStyle = "#202024"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(sd * 22, -61); g.lineTo(sd * 26, -60); g.moveTo(sd * 19, -64); g.lineTo(sd * 26, -72); g.stroke();
    g.fillStyle = "#262629"; g.beginPath(); g.ellipse(sd * 28, -73, 5.2, 3, sd * 0.25, 0, TAU); g.fill();
    g.fillStyle = "rgba(160,215,255,.85)"; g.beginPath(); g.ellipse(sd * 28, -73.3, 3.6, 1.8, sd * 0.25, 0, TAU); g.fill();
    g.fillStyle = "#ff9f1c"; g.fillRect(sd * 28 - 1.5, -71.4, 3, 1);
  });

  // sar (peeche se): gardan, kaan, chhote baal
  const skin = "#c98d5a";
  g.fillStyle = shade(skin, -25); rr(g, -4, -94, 8, 6, 2.5); g.fill();
  g.fillStyle = skin;
  g.beginPath(); g.ellipse(-7.8, -99, 1.9, 3, -0.15, 0, TAU); g.ellipse(7.8, -99, 1.9, 3, 0.15, 0, TAU); g.fill();
  const hair = g.createRadialGradient(-2, -103, 1, 0, -100, 9.5);
  hair.addColorStop(0, "#4a3426"); hair.addColorStop(0.6, "#1c130e"); hair.addColorStop(1, "#0a0706");
  g.fillStyle = hair;
  g.beginPath(); g.ellipse(0, -100.5, 7.6, 8.6, 0, 0, TAU); g.fill();
  g.strokeStyle = "rgba(255,255,255,.07)"; g.lineWidth = 0.8;
  for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(k * 1.8, -108); g.quadraticCurveTo(k * 2.1, -101, k * 1.6, -94.5); g.stroke(); }
  g.fillStyle = "#0e0a08"; rr(g, -6, -95, 12, 2.2, 1); g.fill();            // fade neckline
  g.strokeStyle = "#111"; g.lineWidth = 1.2;                                     // sunglasses strap
  g.beginPath(); g.moveTo(-7.6, -100); g.quadraticCurveTo(0, -98.5, 7.6, -100); g.stroke();

  if (o.passenger) drawPillionRear(g, o.passenger, t);
  g.restore();
}

// Peeche baithi pillion (peeth se) — rider ke peeche, choti aur udta dupatta
function drawPillionRear(g, p, t) {
  const w1 = Math.sin(t * 9) * 2.5, w2 = Math.sin(t * 9 + 1.3) * 3, w3 = Math.sin(t * 7 + 0.5) * 4;
  // udta dupatta
  g.fillStyle = p.dupatta || "#ffe066";
  g.globalAlpha = 0.92;
  g.beginPath();
  g.moveTo(-8, -76);
  g.quadraticCurveTo(-26 + w2, -74, -38 + w3, -62);
  g.lineTo(-33 + w1, -55);
  g.quadraticCurveTo(-22 + w2, -64, -7, -67);
  g.closePath(); g.fill();
  g.globalAlpha = 1;
  // pair (pichle pegs par)
  g.lineCap = "round"; g.strokeStyle = "#efe0cf"; g.lineWidth = 5.5;
  [-1, 1].forEach(sd => { g.beginPath(); g.moveTo(sd * 7, -52); g.lineTo(sd * 13, -44); g.lineTo(sd * 12, -33); g.stroke(); });
  g.fillStyle = "#c2185b"; rr(g, -16, -35, 8, 5, 2); g.fill(); rr(g, 8, -35, 8, 5, 2); g.fill();
  // kurti
  const dg = g.createLinearGradient(-12, 0, 12, 0);
  dg.addColorStop(0, shade(p.dress, -45)); dg.addColorStop(0.5, shade(p.dress, 30)); dg.addColorStop(1, shade(p.dress, -45));
  g.fillStyle = dg;
  g.beginPath();
  g.moveTo(-12, -50); g.bezierCurveTo(-13, -60, -11, -70, -8, -77); g.lineTo(8, -77); g.bezierCurveTo(11, -70, 13, -60, 12, -50);
  g.quadraticCurveTo(0, -46, -12, -50); g.closePath(); g.fill();
  g.strokeStyle = "#ffd34d"; g.lineWidth = 1.3;
  g.beginPath(); g.moveTo(-12, -50.5); g.quadraticCurveTo(0, -46.5, 12, -50.5); g.stroke();
  // haath rider ki kamar par + chudiyan
  g.strokeStyle = p.skin; g.lineWidth = 3.8;
  g.beginPath(); g.moveTo(-10, -73); g.quadraticCurveTo(-17, -68, -15, -60); g.stroke();
  g.beginPath(); g.moveTo(10, -73); g.quadraticCurveTo(17, -68, 15, -60); g.stroke();
  g.strokeStyle = "#ffd34d"; g.lineWidth = 1.3;
  g.beginPath(); g.moveTo(-17, -65); g.lineTo(-13.5, -65); g.moveTo(17, -65); g.lineTo(13.5, -65); g.stroke();
  // sar + jhumke + lambi choti
  g.fillStyle = p.skin;
  g.beginPath(); g.ellipse(-6.4, -84, 1.6, 2.4, 0, 0, TAU); g.ellipse(6.4, -84, 1.6, 2.4, 0, 0, TAU); g.fill();
  g.fillStyle = "#ffd34d";
  g.beginPath(); g.arc(-6.6, -81, 1.4, 0, TAU); g.arc(6.6, -81, 1.4, 0, TAU); g.fill();
  g.fillStyle = p.hair;
  g.beginPath(); g.ellipse(0, -85, 6.8, 7.6, 0, 0, TAU); g.fill();
  g.beginPath();
  g.moveTo(-3.6, -80);
  g.quadraticCurveTo(-4 + w1, -68, -1 + w2, -53);
  g.quadraticCurveTo(1 + w1, -50, 3 + w2, -53);
  g.quadraticCurveTo(4 + w1, -68, 3.6, -80);
  g.closePath(); g.fill();
  g.strokeStyle = shade(p.hair.length === 7 ? p.hair : "#222222", 35); g.lineWidth = 0.9;
  for (let k = 0; k < 6; k++) {
    const yy = -76 + k * 3.7, xx = w1 * (k / 6) + w2 * (k / 12);
    g.beginPath(); g.moveTo(-2.4 + xx, yy); g.lineTo(2.4 + xx, yy + 1.8); g.stroke();
  }
  g.fillStyle = "#ff2e88";
  g.beginPath(); g.moveTo(0, -80); g.lineTo(-5, -83); g.lineTo(-5, -77); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(0, -80); g.lineTo(5, -83); g.lineTo(5, -77); g.closePath(); g.fill();
  g.beginPath(); g.arc(0, -80, 1.8, 0, TAU); g.arc(1 + w2, -51.5, 1.7, 0, TAU); g.fill();
}

// ---------- Highway ke kinare: street light, ped, chattaan, sign, bijli ke tower ----------
const SIGNS = [["NH 48", "JAIPUR", "260 km"], ["NH 48", "AGRA", "180 km"], ["EXPRESSWAY", "MUMBAI", "1150 km"], ["NH 44", "CHANDIGARH", "245 km"]];
function drawStreetLight(side) {
  ctx.fillStyle = "#6b7078"; ctx.fillRect(-2.2, -170, 4.4, 170);
  ctx.fillStyle = "#4b5058"; ctx.fillRect(-4, -6, 8, 6);
  ctx.strokeStyle = "#6b7078"; ctx.lineWidth = 3.4; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(0, -166); ctx.quadraticCurveTo(-side * 14, -178, -side * 52, -176); ctx.stroke();
  ctx.fillStyle = "#3a3e45"; rr(ctx, -side * 52 - 12, -180, 24, 6, 2.5); ctx.fill();
  ctx.fillStyle = "#f3f0dc"; rr(ctx, -side * 52 - 9, -175.5, 18, 2.4, 1); ctx.fill();
}
function drawAcacia(s) {
  ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.beginPath(); ctx.ellipse(0, 0, 40 * s, 8 * s, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = "#5a4130"; ctx.lineCap = "round";
  ctx.lineWidth = 7 * s; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-2 * s, -42 * s); ctx.stroke();
  ctx.lineWidth = 4 * s;
  ctx.beginPath(); ctx.moveTo(-2 * s, -38 * s); ctx.lineTo(-26 * s, -64 * s); ctx.moveTo(-2 * s, -40 * s); ctx.lineTo(22 * s, -66 * s); ctx.moveTo(-1 * s, -42 * s); ctx.lineTo(2 * s, -70 * s); ctx.stroke();
  const cg = ctx.createLinearGradient(0, -92 * s, 0, -58 * s);
  cg.addColorStop(0, "#6f8a3a"); cg.addColorStop(1, "#3f5a22");
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.ellipse(-24 * s, -68 * s, 30 * s, 11 * s, 0, 0, TAU); ctx.ellipse(22 * s, -70 * s, 32 * s, 12 * s, 0, 0, TAU); ctx.ellipse(0, -80 * s, 36 * s, 13 * s, 0, 0, TAU);
  ctx.fill();
}
function drawRocks(s, k) {
  const c1 = ["#8a6f55", "#7a6250", "#957a5c"][k % 3];
  ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.beginPath(); ctx.ellipse(0, 0, 36 * s, 6 * s, 0, 0, TAU); ctx.fill();
  const g = ctx.createLinearGradient(0, -30 * s, 0, 0);
  g.addColorStop(0, shade(c1, 35)); g.addColorStop(1, shade(c1, -35));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(-30 * s, 0); ctx.lineTo(-24 * s, -18 * s); ctx.lineTo(-8 * s, -28 * s); ctx.lineTo(8 * s, -24 * s); ctx.lineTo(20 * s, -12 * s); ctx.lineTo(30 * s, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#6f7d3a";
  ctx.beginPath(); ctx.ellipse(26 * s, -5 * s, 14 * s, 7 * s, 0, 0, TAU); ctx.ellipse(-30 * s, -4 * s, 10 * s, 5 * s, 0, 0, TAU); ctx.fill();
}
function drawSpeedSign() {
  ctx.fillStyle = "#7b8088"; ctx.fillRect(-1.6, -62, 3.2, 62);
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, -70, 13, 0, TAU); ctx.fill();
  ctx.strokeStyle = "#d62828"; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.arc(0, -70, 11, 0, TAU); ctx.stroke();
  ctx.fillStyle = "#111"; ctx.font = "bold 10px Arial"; ctx.textAlign = "center"; ctx.fillText("100", 0, -66.5);
}
function drawPylon() {
  ctx.strokeStyle = "#7d828a"; ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-26, 0); ctx.lineTo(-6, -260); ctx.moveTo(26, 0); ctx.lineTo(6, -260);
  for (let y = -20; y > -250; y -= 26) {
    const w1 = 26 - (-y) / 260 * 20, w2 = 26 - (-(y - 26)) / 260 * 20;
    ctx.moveTo(-w1, y); ctx.lineTo(w2, y - 26); ctx.moveTo(w1, y); ctx.lineTo(-w2, y - 26);
  }
  ctx.moveTo(-60, -210); ctx.lineTo(60, -210); ctx.moveTo(-44, -240); ctx.lineTo(44, -240);
  ctx.stroke();
}
function drawSignGantry(k) {
  const [hwy, city, dist] = SIGNS[k % SIGNS.length];
  [-1, 1].forEach(sd => {
    ctx.fillStyle = "#8b9099"; ctx.fillRect(sd * (ROAD_HW + 40) - 4, -205, 8, 205);
  });
  ctx.fillStyle = "#6b7078"; ctx.fillRect(-ROAD_HW - 40, -205, (ROAD_HW + 40) * 2, 7);
  [[-95, city, dist, "↑"], [95, k % 2 ? "EXIT" : "DELHI", k % 2 ? "2 km" : "22 km", "↗"]].forEach(([x, a, b, ar]) => {
    ctx.fillStyle = "#0b6b3a"; rr(ctx, x - 80, -262, 160, 64, 5); ctx.fill();
    ctx.strokeStyle = "#f2f2f2"; ctx.lineWidth = 2.2; rr(ctx, x - 76, -258, 152, 56, 4); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.textAlign = "center";
    ctx.font = "bold 17px Arial"; ctx.fillText(a, x - 8, -236);
    ctx.font = "bold 13px Arial"; ctx.fillText(b, x - 8, -216);
    ctx.font = "bold 26px Arial"; ctx.fillText(ar, x + 58, -220);
  });
  ctx.fillStyle = "#1d4f9e"; rr(ctx, -20, -286, 40, 22, 4); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "bold 10px Arial"; ctx.fillText(hwy, 0, -271);
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
  if (p.clip < H) { ctx.beginPath(); ctx.rect(-80, -H, W + 160, p.clip + H); ctx.clip(); }
  ctx.globalAlpha = alpha;
  ctx.translate(p.x, p.y);
  ctx.scale(scale, scale);
  fn();
  ctx.restore();
}

// Bijli ke tower ke beech taar
function drawWires(pylons) {
  ctx.strokeStyle = "rgba(60,64,70,.55)"; ctx.lineWidth = 1;
  for (let k = 0; k + 1 < pylons.length; k++) {
    const a = pylons[k], b = pylons[k + 1];
    [[-60, -210], [60, -210], [0, -240]].forEach(([ox, oy]) => {
      const x1 = a.x + ox * a.sc, y1 = a.y + oy * a.sc, x2 = b.x + ox * b.sc, y2 = b.y + oy * b.sc;
      ctx.beginPath(); ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 + 26 * Math.min(a.sc, b.sc) + 4, x2, y2);
      ctx.stroke();
    });
  }
}

// ================== COCKPIT (rider ki nazar se) ==================
function gaugeFace(cx, cy, r, val, max, label, red, digital, unit) {
  // bezel
  const bz = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  bz.addColorStop(0, "#f0f2f5"); bz.addColorStop(0.5, "#8c929b"); bz.addColorStop(1, "#e4e7eb");
  ctx.fillStyle = bz; ctx.beginPath(); ctx.arc(cx, cy, r + 4, 0, TAU); ctx.fill();
  const fc = ctx.createRadialGradient(cx, cy - r * 0.3, 2, cx, cy, r);
  fc.addColorStop(0, "#1b2230"); fc.addColorStop(1, "#05070b");
  ctx.fillStyle = fc; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  // scale ticks
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
  for (let k = 0; k <= 12; k++) {
    const a = a0 + (a1 - a0) * k / 12, big = k % 2 === 0;
    const r1 = r - (big ? 9 : 6), r2 = r - 3;
    ctx.strokeStyle = red && k >= 10 ? "#ff3b3b" : "#dfe6f0"; ctx.lineWidth = big ? 2 : 1;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); ctx.stroke();
    if (k % 4 === 0) {
      ctx.fillStyle = "#c9d2de"; ctx.font = `bold ${Math.round(r * 0.19)}px Arial`; ctx.textAlign = "center";
      ctx.fillText(String(Math.round(max * k / 12)), cx + Math.cos(a) * (r - 19), cy + Math.sin(a) * (r - 19) + 3);
    }
  }
  // glow arc (value)
  const av = a0 + (a1 - a0) * Math.min(1, val / max);
  ctx.save();
  ctx.strokeStyle = red ? "#ff5a3c" : "#00c6ff"; ctx.lineWidth = 3; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.arc(cx, cy, r - 1.5, a0, av); ctx.stroke();
  ctx.restore();
  // digital
  ctx.fillStyle = "#0a1018"; rr(ctx, cx - r * 0.42, cy + r * 0.18, r * 0.84, r * 0.4, 4); ctx.fill();
  ctx.fillStyle = red ? "#ff8a65" : "#7ff3ff"; ctx.textAlign = "center";
  ctx.font = `bold ${Math.round(r * 0.3)}px Orbitron, Arial`; ctx.fillText(digital, cx, cy + r * 0.48);
  ctx.fillStyle = "#8a96a8"; ctx.font = `bold ${Math.round(r * 0.13)}px Arial`; ctx.fillText(unit, cx, cy + r * 0.72);
  ctx.fillText(label, cx, cy - r * 0.32);
  // needle
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(av);
  ctx.shadowColor = "#ff3b3b"; ctx.shadowBlur = 6;
  ctx.fillStyle = "#ff3b3b";
  ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(r - 8, -0.8); ctx.lineTo(r - 8, 0.8); ctx.lineTo(-6, 2); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#2b2f36"; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, TAU); ctx.fill();
  // glass reflection
  ctx.fillStyle = "rgba(255,255,255,.07)";
  ctx.beginPath(); ctx.ellipse(cx - r * 0.25, cy - r * 0.45, r * 0.6, r * 0.28, -0.4, 0, TAU); ctx.fill();
}

function drawMirror(mx, my, side) {
  ctx.save();
  ctx.translate(mx, my); ctx.rotate(side * 0.1);
  const mw = 96, mh = 54;
  ctx.fillStyle = "#15171a"; rr(ctx, -mw / 2 - 5, -mh / 2 - 5, mw + 10, mh + 10, 22); ctx.fill();
  ctx.save();
  rr(ctx, -mw / 2, -mh / 2, mw, mh, 18); ctx.clip();
  const g = ctx.createLinearGradient(0, -mh / 2, 0, mh / 2);
  g.addColorStop(0, "#9cc8ee"); g.addColorStop(0.45, "#e4dccb"); g.addColorStop(0.5, "#b08f5e"); g.addColorStop(1, "#8d7350");
  ctx.fillStyle = g; ctx.fillRect(-mw / 2, -mh / 2, mw, mh);
  // peeche ki road
  ctx.fillStyle = "#5f6164";
  ctx.beginPath(); ctx.moveTo(-side * 8 - 4, 0); ctx.lineTo(-side * 8 + 4, 0); ctx.lineTo(-side * 8 + 70, mh / 2); ctx.lineTo(-side * 8 - 70, mh / 2); ctx.closePath(); ctx.fill();
  // peeche ki gaadiyan (aaine mein ulta)
  if (player) {
    const behind = traffic.map(c => ({ c, d: player.y - (c.y - c.h / 2) })).filter(o => o.d < -20 && o.d > -900);
    behind.sort((a, b) => a.d - b.d);
    for (const o of behind) {
      const k = 1 / (1 + (-o.d) / 140);
      const x = -side * 8 - (o.c.x - player.x) * 0.42 * k, y = 2 + 22 * k;
      const cw = o.c.w * 0.5 * k, chh = (o.c.truck ? 40 : 22) * 0.5 * k;
      ctx.fillStyle = o.c.color; rr(ctx, x - cw / 2, y - chh, cw, chh, 2); ctx.fill();
      ctx.fillStyle = "#fffbe0"; ctx.fillRect(x - cw / 2 + 1, y - chh * 0.45, cw * 0.25, chh * 0.2); ctx.fillRect(x + cw / 4 - 1, y - chh * 0.45, cw * 0.25, chh * 0.2);
    }
  }
  ctx.fillStyle = "rgba(255,255,255,.18)";
  ctx.beginPath(); ctx.ellipse(-mw * 0.18, -mh * 0.22, mw * 0.34, mh * 0.16, -0.2, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "#2a2d31"; ctx.lineWidth = 3; rr(ctx, -mw / 2, -mh / 2, mw, mh, 18); ctx.stroke();
  ctx.restore();
}

function drawCockpit() {
  if (!player || !bike) return;
  const cx = W / 2, cy = H - (isTouch ? 300 : 215);
  const tilt = player.tilt || 0;
  ctx.save();
  // mod par haath / handle halka ghoomta hai
  ctx.translate(cx, H + 60); ctx.rotate(tilt * 0.05); ctx.translate(-cx - tilt * 8, -H - 60);

  // mirror + stalk
  [-1, 1].forEach(sd => {
    ctx.strokeStyle = "#1c1e22"; ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cx + sd * 132, cy + 24); ctx.quadraticCurveTo(cx + sd * 150, cy - 60, cx + sd * 176, cy - 150); ctx.stroke();
    drawMirror(cx + sd * 180, cy - 168, sd);
  });

  // tank (bike ke rang ka)
  const tg = ctx.createRadialGradient(cx - 30, cy + 120, 10, cx, cy + 200, 190);
  tg.addColorStop(0, shade(bike.color, 60)); tg.addColorStop(0.35, bike.color); tg.addColorStop(1, shade(bike.color, -80));
  ctx.fillStyle = tg;
  ctx.beginPath(); ctx.ellipse(cx, cy + 215, 150, 160, 0, Math.PI, TAU); ctx.lineTo(cx + 150, H + 10); ctx.lineTo(cx - 150, H + 10); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.28)";
  ctx.beginPath(); ctx.ellipse(cx - 40, cy + 110, 46, 12, -0.3, 0, TAU); ctx.fill();
  ctx.fillStyle = bike.accent || "#fff"; ctx.fillRect(cx - 4, cy + 62, 8, 60);
  // fuel cap
  ctx.fillStyle = "#2a2d31"; ctx.beginPath(); ctx.ellipse(cx, cy + 128, 22, 9, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#9aa1aa"; ctx.beginPath(); ctx.ellipse(cx, cy + 126, 17, 6.5, 0, 0, TAU); ctx.fill();

  // top yoke + fork caps
  const yk = ctx.createLinearGradient(0, cy + 14, 0, cy + 52);
  yk.addColorStop(0, "#5b6068"); yk.addColorStop(1, "#1e2024");
  ctx.fillStyle = yk; rr(ctx, cx - 90, cy + 14, 180, 40, 16); ctx.fill();
  [-1, 1].forEach(sd => {
    const fg = ctx.createRadialGradient(cx + sd * 70, cy + 30, 2, cx + sd * 70, cy + 32, 15);
    fg.addColorStop(0, "#ffe08a"); fg.addColorStop(1, "#a8740f");
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(cx + sd * 70, cy + 32, 14, 0, TAU); ctx.fill();
    ctx.fillStyle = "#6e4a06"; ctx.beginPath(); ctx.arc(cx + sd * 70, cy + 32, 5, 0, TAU); ctx.fill();
  });

  // dials ka housing
  const hb = ctx.createLinearGradient(0, cy - 86, 0, cy + 30);
  hb.addColorStop(0, "#2a2d33"); hb.addColorStop(1, "#0d0e10");
  ctx.fillStyle = hb; rr(ctx, cx - 112, cy - 86, 224, 116, 34); ctx.fill();
  const kmh = Math.max(0, Math.floor(speed / 5));
  const gear = speed < 20 ? "N" : String(Math.min(6, 1 + Math.floor(kmh / 50)));
  const rpm = speed < 20 ? 1 : 2 + (kmh % 50) / 50 * 9 + (boosting ? 1.2 : 0);
  gaugeFace(cx - 54, cy - 28, 46, kmh, 300, "km/h", false, String(kmh), "SPEED");
  gaugeFace(cx + 54, cy - 28, 46, rpm, 12, "x1000", true, gear, "GEAR");
  // indicator lights
  const ind = [
    ["◀", tilt < -0.35, "#2ecc71"], ["⛽", fuel / bike.tank < 0.25, "#ffb300"],
    ["N₂O", boosting, "#00c6ff"], ["▶", tilt > 0.35, "#2ecc71"],
  ];
  ind.forEach(([t, on, col], k) => {
    const x = cx - 54 + k * 36, y = cy - 98;
    ctx.save();
    ctx.fillStyle = on ? col : "rgba(255,255,255,.18)";
    if (on) { ctx.shadowColor = col; ctx.shadowBlur = 10; }
    ctx.font = "bold 13px Arial"; ctx.textAlign = "center"; ctx.fillText(t, x, y);
    ctx.restore();
  });

  // handlebar (chrome)
  const bar = [[cx - 240, cy + 86], [cx - 150, cy + 50], [cx - 80, cy + 26], [cx + 80, cy + 26], [cx + 150, cy + 50], [cx + 240, cy + 86]];
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  [[16, "#2b2e33"], [12, "#a9b0ba"], [4, "#f4f6f8"]].forEach(([lw, col], k) => {
    ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(bar[0][0], bar[0][1] - k * 2);
    bar.slice(1).forEach(([x, y]) => ctx.lineTo(x, y - k * 2)); ctx.stroke();
  });
  ctx.fillStyle = "#2b2e33"; rr(ctx, cx - 30, cy + 14, 60, 22, 8); ctx.fill();

  // switch box + levers + gloves + baazu
  [-1, 1].forEach(sd => {
    ctx.save();
    ctx.translate(cx + sd * 152, cy + 46); ctx.rotate(sd * 0.36);
    ctx.fillStyle = "#1a1c20"; rr(ctx, -16, -14, 32, 26, 6); ctx.fill();
    ctx.fillStyle = sd < 0 ? "#ffb300" : "#e63946"; ctx.beginPath(); ctx.arc(sd * 4, -2, 4.5, 0, TAU); ctx.fill();
    ctx.restore();
    // lever
    ctx.strokeStyle = "#c3c9d1"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(cx + sd * 170, cy + 38); ctx.quadraticCurveTo(cx + sd * 200, cy + 30, cx + sd * 236, cy + 52); ctx.stroke();
    // sleeve (jacket)
    const sl = ctx.createLinearGradient(cx + sd * 200, H, cx + sd * 240, cy + 80);
    sl.addColorStop(0, shade(bike.suit, -30)); sl.addColorStop(1, shade(bike.suit, 40));
    ctx.fillStyle = sl;
    ctx.beginPath();
    ctx.moveTo(cx + sd * 150, H + 20); ctx.lineTo(cx + sd * 188, cy + 108); ctx.lineTo(cx + sd * 254, cy + 92); ctx.lineTo(cx + sd * 272, H + 20);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = bike.color;
    ctx.beginPath(); ctx.moveTo(cx + sd * 172, H + 20); ctx.lineTo(cx + sd * 200, cy + 112); ctx.lineTo(cx + sd * 212, cy + 110); ctx.lineTo(cx + sd * 186, H + 20); ctx.closePath(); ctx.fill();
    // glove (grip pakde hue)
    ctx.save();
    ctx.translate(cx + sd * 214, cy + 76); ctx.rotate(sd * 0.42);
    const gv = ctx.createLinearGradient(0, -26, 0, 26);
    gv.addColorStop(0, "#3a3d42"); gv.addColorStop(1, "#0b0c0e");
    ctx.fillStyle = gv; rr(ctx, -40, -26, 80, 52, 20); ctx.fill();
    ctx.fillStyle = "#55595f";                                   // knuckle armour
    rr(ctx, -30, -22, 60, 14, 6); ctx.fill();
    ctx.strokeStyle = "#202226"; ctx.lineWidth = 2;
    for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * 12, -6); ctx.lineTo(k * 12 + 2, 18); ctx.stroke(); }
    ctx.fillStyle = bike.color; ctx.fillRect(-36, 10, 10, 10);
    ctx.restore();
  });
  ctx.restore();

  // crash par laal flash
  if (state === "over" && overReason === "crash") {
    ctx.fillStyle = `rgba(255,40,40,${Math.min(0.55, shake / 18 * 0.55)})`;
    ctx.fillRect(0, 0, W, H);
  }
}

// ================== DRAW ==================
function draw() {
  setupView();
  const cock = isCockpit();
  if (player) camX = (player.x - 240) * (cock ? 1 : 0.78);     // camera bike ke saath
  buildSegments();

  ctx.save();
  if (shake > 0.5) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  ctx.save();
  if (cock && player) {                                           // mod/jhukne par duniya halki tirchhi
    roll += (-(player.tilt || 0) * 0.07 - roll) * 0.2;
    const py = horizonY + (H - horizonY) * 0.5;
    ctx.translate(W / 2, py); ctx.rotate(roll); ctx.translate(-W / 2, -py);
    ctx.scale(1, 1);
  }
  if (cock) { ctx.translate(W / 2, 0); ctx.scale(1.08, 1); ctx.translate(-W / 2, 0); }   // roll ke kone na dikhein

  drawSky();
  drawRoad();
  drawLaneArrows();

  // Racing: start / finish patti
  if (mode === "racing" && player) {
    checkerDecal((RACE_DIST - distance) * 10);
    checkerDecal(-distance * 10 + 40);
  }

  // ---- saari cheezein door se paas (painter's order) ----
  const list = [];
  const fadeAt = d => Math.max(0, Math.min(1, ((player ? player.y : 600) + 260 - d) / 220));
  const dMin = segStart, dMax = segStart + NSEG * SEG - 10;

  // road ke kinare ki cheezein (zameen ke saath fixed)
  const RS = 200, n0 = Math.ceil((trackS + dMin) / RS), n1 = Math.floor((trackS + dMax) / RS);
  for (let n = n0; n <= n1; n++) {
    const d = n * RS - trackS, side = n % 2 ? 1 : -1, h = hash(n);
    if (h < 0.45) list.push({ d, lat: side * (ROAD_HW + 64), k: "light", side });
    else if (h < 0.5) list.push({ d, lat: side * (ROAD_HW + 60), k: "speed" });
    else if (h < 0.8) list.push({ d, lat: side * (ROAD_HW + 150 + hash(n + 3) * 220), k: "tree", s: 0.9 + hash(n + 5) * 0.6 });
    else list.push({ d, lat: side * (ROAD_HW + 110 + hash(n + 9) * 260), k: "rock", s: 0.8 + hash(n + 11) * 0.9, n });
    if (h > 0.3 && h < 0.75) list.push({ d: d + 100, lat: -side * (ROAD_HW + 200 + hash(n + 13) * 300), k: "tree", s: 0.8 + hash(n + 15) * 0.6 });
  }
  // bijli ke tower (right side, door) + green highway sign
  const PS = 1300, pylons = [];
  for (let n = Math.ceil((trackS + dMin) / PS); n <= Math.floor((trackS + dMax) / PS); n++) {
    const o = { d: n * PS - trackS, lat: 760, k: "pylon" };
    list.push(o); pylons.push(o);
  }
  const GS = 3100;
  for (let n = Math.ceil((trackS + dMin) / GS); n <= Math.floor((trackS + dMax) / GS); n++)
    if (n > 0) list.push({ d: n * GS - trackS, lat: 0, k: "sign", n });
  if (mode === "racing" && player) {
    list.push({ d: (RACE_DIST - distance) * 10 + 2, lat: 0, k: "gantry", text: "FINISH" });
    list.push({ d: -distance * 10 + 42, lat: 0, k: "gantry", text: "START" });
  }
  if (player) {
    for (const p of pickups) list.push({ d: player.y - p.y, lat: p.x - 240, k: "pick", p });
    for (const c of traffic) list.push({ d: player.y - (c.y + c.h / 2), lat: c.x - 240, k: "car", c });
    for (const r of rivals) list.push({ d: (r.dist - distance) * 10, lat: r.x - 240, k: "rival", r });
    if (!cock && (state !== "over" || overReason === "fuel" || overReason === "finish"))
      list.push({ d: 0, lat: player.x - 240, k: "player" });
  }
  list.sort((a, b) => b.d - a.d);

  // taar pehle (sabse peeche)
  const pp = pylons.map(o => project(o.d, o.lat)).filter(Boolean).sort((a, b) => a.sc - b.sc);
  drawWires(pp);

  for (const o of list) {
    const p = project(o.d, o.lat);
    if (!p || p.y < horizonY - 400 || p.sc > 4.2) continue;
    const sc = p.sc;
    if (o.k === "light") putSprite(p, sc, () => drawStreetLight(o.side));
    else if (o.k === "tree") putSprite(p, sc, () => drawAcacia(o.s));
    else if (o.k === "rock") putSprite(p, sc, () => drawRocks(o.s, o.n));
    else if (o.k === "speed") putSprite(p, sc, drawSpeedSign);
    else if (o.k === "pylon") putSprite(p, sc, drawPylon);
    else if (o.k === "sign") {
      const ga = cock ? 1 : Math.max(0, Math.min(1, (o.d - 40) / 220));
      if (ga > 0) putSprite(p, sc, () => drawSignGantry(o.n), ga);
    } else if (o.k === "gantry") {                 // gate ke neeche se guzarte waqt halka ho jaye (bike na dhake)
      const ga = cock ? 1 : Math.max(0, Math.min(1, (o.d - 40) / 220));
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
      putSprite(p, sc, () => {
        drawBikeRear(ctx, r.bike, { tilt: r.tilt, wheel: wheelAnim, boost: r.boost > 0, t: animT });
        ctx.font = "bold 12px Rajdhani, Segoe UI, Arial"; ctx.textAlign = "center";
        ctx.fillStyle = "rgba(0,0,0,.6)"; rr(ctx, -22, -128, 44, 16, 8); ctx.fill();
        ctx.fillStyle = r.bike.color; ctx.fillText(r.name, 0, -116);
      });
    } else if (o.k === "player") {
      putSprite(p, sc, () => drawBikeRear(ctx, bike, {
        tilt: player.tilt, wheel: wheelAnim, boost: boosting, brake: braking, passenger: pillion, t: animT,
      }));
    }
  }

  // Particles (dhuan / crash) — cockpit mein sirf aage wale
  if (player) {
    for (const q of particles) {
      const d = player.y - q.y;
      if (cock && d < 60) continue;
      const p = project(d, q.x - 240);
      if (!p || p.sc > 3.5) continue;
      ctx.globalAlpha = Math.max(0, q.life / q.max);
      ctx.fillStyle = q.color;
      ctx.beginPath(); ctx.arc(p.x, p.y - 12 * p.sc, q.size * p.sc, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Speed lines (nitro)
  if (boosting && state === "play") {
    ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 2;
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * TAU, r1 = 140 + Math.random() * 200, r2 = r1 + 70 + Math.random() * 90;
      const cx = W / 2, cy = horizonY + 30;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.8);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2 * 0.8); ctx.stroke();
    }
  }

  if (cock) drawCockpit();

  // Floating texts
  ctx.textAlign = "center";
  ctx.font = "bold 18px Rajdhani, Segoe UI, Arial";
  if (player) for (const t of texts) {
    let x, ty;
    if (cock) { x = W / 2; ty = horizonY + 70 - (1 - t.life) * 40; }
    else {
      const p = project(player.y - t.y, t.x - 240);
      if (!p) continue;
      x = p.x; ty = p.y - 125 * Math.min(p.sc, 1.6);
    }
    ctx.globalAlpha = Math.max(0, t.life);
    ctx.fillStyle = "#000"; ctx.fillText(t.text, x + 1, ty + 1);
    ctx.fillStyle = t.color; ctx.fillText(t.text, x, ty);
  }
  ctx.globalAlpha = 1;

  // Warnings / banners
  if (state === "play") {
    const wy = Math.max(200, horizonY - 30);
    if (fuel <= 0) banner("OUT OF FUEL!", "#ff3b3b", Math.floor(performance.now() / 250) % 2);
    else if (fuel / bike.tank < 0.25) {
      if (Math.floor(performance.now() / 300) % 2) {
        ctx.fillStyle = "#ff3b3b"; ctx.font = "bold 20px Segoe UI, Arial"; ctx.textAlign = "center";
        ctx.fillText("⛽ LOW FUEL!", W / 2, wy + 34);
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
        ctx.fillStyle = "rgba(0,0,0,.55)"; rr(ctx, W / 2 - 78, wy - 18, 156, 26, 13); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.fillText("🏁 FINISH  " + leftM + " m", W / 2, wy + 1);
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
  updateTiltPreview();
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
