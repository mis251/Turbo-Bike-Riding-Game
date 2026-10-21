// ================== TURBO BIKE RUSH v2 ==================
// Features: 3 bikes, two-way traffic, fuel system, nitro, near-miss bonus
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
const isOncoming = lane => lane < 2;

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
};

// Lift maangne wali passengers ke looks (random)
const RIDERS = [
  { dress: "#ff4fa3", hair: "#2b1a12", dupatta: "#ffe066", skin: "#f1c27d" },
  { dress: "#9b5de5", hair: "#120c08", dupatta: "#ff9ecf", skin: "#e0ac69" },
  { dress: "#ffbe0b", hair: "#4a2c17", dupatta: "#ff5d8f", skin: "#f1c27d" },
  { dress: "#00bbf9", hair: "#1a0f0a", dupatta: "#fff3b0", skin: "#c68642" },
];

let best = 0, selected = 0;
try {
  best = +localStorage.getItem("bikeBest") || 0;
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
    g.save(); g.translate(36, 48); g.scale(0.95, 0.95);
    drawBike(g, 0, 0, b, { tilt: 0, wheel: 0 });
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
  if (e.code === "Enter" && (state === "menu" || state === "over")) startGame();
});
addEventListener("keyup", e => (keys[e.code] = false));

document.querySelectorAll("#touch button").forEach(b => {
  const k = b.dataset.key;
  b.addEventListener("pointerdown", e => { e.preventDefault(); keys[k] = true; });
  ["pointerup", "pointerleave", "pointercancel"].forEach(ev =>
    b.addEventListener(ev, () => (keys[k] = false)));
});

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
}

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
function toggleFullscreen() {
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  } else goFullscreen();
}
const fsBtn = document.getElementById("fsBtn");
if (fsBtn) fsBtn.onclick = toggleFullscreen;
addEventListener("keydown", e => { if (e.code === "KeyF") toggleFullscreen(); });

function startGame() {
  if (isTouch) goFullscreen();
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
  } else {
    beep(300, 0.3, "triangle"); setTimeout(() => beep(200, 0.5, "triangle"), 250);
  }
  const score = Math.floor(getScore());
  const isBest = score > best;
  if (isBest) { best = score; try { localStorage.setItem("bikeBest", best); } catch (e) {} }
  setTimeout(() => {
    ui.overTitle.textContent = reason === "crash" ? "CRASHED!" : "OUT OF FUEL!";
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
    const free = [2, 3].filter(l => !traffic.some(c => c.lane === l && c.y < 200 && c.y > -350));
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
    fuel -= speed * dt * 0.0042 * bike.eff * (boosting ? 1.7 : 1);
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

  // Steering
  const steer = (right() ? 1 : 0) - (left() ? 1 : 0);
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
    spawnTimer = Math.max(0.32, 1.1 - level * 0.08) * (500 / Math.max(speed, 300));
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
      if (c.swerveT > 1 && c.y > 50 && c.y < H / 2) { c.lane = c.lane === 2 ? 3 : 2; c.swerve = false; }
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
  ui.level.textContent = level;
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

// ================== DRAW ==================
function draw() {
  ctx.save();
  if (shake > 0.5) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

  // Grass
  ctx.fillStyle = "#1f6b2e";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#24793a";
  for (let y = -80 + roadOffset; y < H; y += 80) {
    ctx.fillRect(0, y, ROAD_L, 40);
    ctx.fillRect(ROAD_R, y, W - ROAD_R, 40);
  }
  for (const t of trees) drawTree(t.side === 0 ? 28 : W - 28, t.y, t.s);

  // Road
  const g = ctx.createLinearGradient(ROAD_L, 0, ROAD_R, 0);
  g.addColorStop(0, "#2b2b2b"); g.addColorStop(0.5, "#3a3a3a"); g.addColorStop(1, "#2b2b2b");
  ctx.fillStyle = g;
  ctx.fillRect(ROAD_L, 0, ROAD_R - ROAD_L, H);

  // Kerbs
  for (let y = -80 + roadOffset; y < H; y += 40) {
    ctx.fillStyle = (Math.round((y - roadOffset) / 40) % 2 === 0) ? "#e63946" : "#f1f1f1";
    ctx.fillRect(ROAD_L - 8, y, 8, 40);
    ctx.fillRect(ROAD_R, y, 8, 40);
  }

  // Lane dashes (white) for lane 0|1 and 2|3
  ctx.fillStyle = "rgba(255,255,255,.75)";
  [1, 3].forEach(i => {
    const x = ROAD_L + LANE_W * i - 2;
    for (let y = -80 + roadOffset; y < H; y += 80) ctx.fillRect(x, y, 4, 40);
  });
  // Center double yellow line (divider between two directions)
  const cx = ROAD_L + LANE_W * 2;
  ctx.fillStyle = "#ffcc00";
  ctx.fillRect(cx - 5, 0, 3, H);
  ctx.fillRect(cx + 2, 0, 3, H);

  // Direction arrows painted on road
  ctx.fillStyle = "rgba(255,255,255,.18)";
  for (let y = -160 + (roadOffset * 2) % 320; y < H; y += 320) {
    for (let l = 0; l < LANES; l++) drawArrow(laneX(l), y, isOncoming(l));
  }

  // Speed lines
  if (boosting && state === "play") {
    ctx.strokeStyle = "rgba(255,255,255,.25)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const x = ROAD_L + Math.random() * (ROAD_R - ROAD_L), y = Math.random() * H;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 60); ctx.stroke();
    }
  }

  for (const p of pickups) {
    if (p.type === "coin") drawCoin(p);
    else if (p.type === "nitro") drawNitro(p);
    else if (p.type === "fuel") drawFuel(p);
  }
  for (const p of pickups) if (p.type === "girl") drawGirl(p);

  for (const c of traffic) drawCar(c);

  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (state !== "over" || overReason === "fuel") {
    drawBike(ctx, player.x, player.y, bike, {
      tilt: player.tilt, wheel: wheelAnim, boost: boosting, brake: braking, beam: true,
      passenger: pillion, t: animT, scale: 1.18,
    });
  }

  // Floating texts
  ctx.textAlign = "center";
  ctx.font = "bold 17px Rajdhani, Segoe UI, Arial";
  for (const t of texts) {
    ctx.globalAlpha = Math.max(0, t.life);
    ctx.fillStyle = "#000"; ctx.fillText(t.text, t.x + 1, t.y + 1);
    ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
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
    if (distance % 1000 < 60 && distance > 100) banner("LEVEL " + level, "#ffd34d", true);
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
    trees.forEach(t => { t.y += 200 * dt; if (t.y > H + 60) t.y -= treeSpan; });
  }
  draw();
  requestAnimationFrame(loop);
}

resizeGame();
reset();
renderBikeSelect();
requestAnimationFrame(loop);
