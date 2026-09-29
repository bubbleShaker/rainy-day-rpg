// 効果音・雨音・BGM はすべて Web Audio API で生成する（音声ファイル不要）
let ctx = null;
let master = null;
let rainGain = null;
let whiteBuf = null;
let brownBuf = null;
let muted = false;
let sunny = false;
let rainLevel = 1;
let beat = 0;

const RAIN_SCALE = [293.66, 349.23, 392.0, 440.0, 523.25, 587.33, 698.46];
const SUN_SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];

function makeNoise(sec, brown) {
  const len = Math.floor(ctx.sampleRate * sec);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else {
      d[i] = w;
    }
  }
  return buf;
}

export function initAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (ctx) { ctx.resume(); return; }
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.9;
  master.connect(ctx.destination);

  whiteBuf = makeNoise(4, false);
  brownBuf = makeNoise(4, true);

  // 雨音: 高域のサーッという音 + 低域のザーッという音
  const white = ctx.createBufferSource();
  white.buffer = whiteBuf; white.loop = true;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
  const wg = ctx.createGain(); wg.gain.value = 0.08;
  const brown = ctx.createBufferSource();
  brown.buffer = brownBuf; brown.loop = true;
  const blp = ctx.createBiquadFilter(); blp.type = 'lowpass'; blp.frequency.value = 500;
  const bg = ctx.createGain(); bg.gain.value = 0.3;
  rainGain = ctx.createGain(); rainGain.gain.value = 0;
  white.connect(hp).connect(lp).connect(wg).connect(rainGain);
  brown.connect(blp).connect(bg).connect(rainGain);
  rainGain.connect(master);
  white.start(); brown.start();
  rainGain.gain.setTargetAtTime(rainLevel, ctx.currentTime, 1.0);

  setInterval(musicTick, 420);
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });
}

function pluck(freq, vol, dur = 1.8, delay = 0) {
  const t = ctx.currentTime + delay;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(master);
  const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2;
  const g2 = ctx.createGain(); g2.gain.value = 0.25;
  o1.connect(g); o2.connect(g2).connect(g);
  o1.start(t); o2.start(t); o1.stop(t + dur); o2.stop(t + dur);
}

function musicTick() {
  if (!ctx || ctx.state !== 'running') return;
  beat++;
  const scale = sunny ? SUN_SCALE : RAIN_SCALE;
  if (Math.random() < (sunny ? 0.6 : 0.42)) {
    pluck(scale[Math.floor(Math.random() * scale.length)], 0.045);
  }
  if (beat % 8 === 0) pluck(scale[0] / 2, 0.05, 3);
  if (sunny && beat % 8 === 4) pluck(scale[2] / 2, 0.035, 2.5);
}

function tone(freq, dur, type, vol, freqEnd, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noiseHit(dur, ftype, freq, vol, freqEnd, delay = 0, buf = whiteBuf) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource();
  s.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = ftype;
  f.frequency.setValueAtTime(freq, t);
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random() * 2); s.stop(t + dur + 0.02);
}

export function sfx(name) {
  if (!ctx) return;
  switch (name) {
    case 'swing': noiseHit(0.16, 'bandpass', 1000, 0.3, 3200); break;
    case 'hit': tone(240, 0.1, 'square', 0.08, 90); noiseHit(0.1, 'lowpass', 2400, 0.25, 400); break;
    case 'hurt': tone(320, 0.25, 'sawtooth', 0.1, 110); break;
    case 'dash': noiseHit(0.25, 'bandpass', 500, 0.25, 2600); break;
    case 'spin': noiseHit(0.55, 'bandpass', 400, 0.35, 3400); tone(380, 0.45, 'triangle', 0.07, 900); break;
    case 'levelup': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.12, 0, i * 0.09)); break;
    case 'shard': [784, 988, 1175, 1568].forEach((f, i) => pluck(f, 0.12, 1.4, i * 0.12)); break;
    case 'heal': tone(440, 0.45, 'sine', 0.12, 880); tone(660, 0.45, 'sine', 0.06, 1320, 0.08); break;
    case 'talk': tone(900, 0.05, 'square', 0.035); break;
    case 'pickup': tone(660, 0.12, 'sine', 0.12, 990); break;
    case 'enemyDie': noiseHit(0.35, 'lowpass', 1600, 0.3, 200); tone(500, 0.2, 'sine', 0.06, 200); break;
    case 'step': noiseHit(0.07, 'bandpass', 1700, 0.035); break;
    case 'barrier': tone(180, 0.35, 'sine', 0.12, 140); break;
    case 'boss': tone(110, 1.2, 'sawtooth', 0.08, 55); noiseHit(1.2, 'lowpass', 300, 0.4, 80, 0, brownBuf); break;
    case 'clear': [523, 659, 784, 1047, 1319].forEach((f, i) => pluck(f, 0.1, 3, i * 0.15)); break;
    default: break;
  }
}

export function thunder(delay = 0, vol = 0.8) {
  if (!ctx) return;
  noiseHit(3.2, 'lowpass', 260, vol, 90, delay, brownBuf);
  if (delay < 0.3) noiseHit(0.25, 'highpass', 1500, vol * 0.35, 0, delay);
}

export function setRain(v) {
  rainLevel = v;
  if (rainGain) rainGain.gain.setTargetAtTime(v, ctx.currentTime, 0.8);
}

export function setSunny(v) { sunny = v; }

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05);
  return muted;
}
