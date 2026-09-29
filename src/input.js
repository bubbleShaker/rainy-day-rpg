// キーボード + タッチ（仮想ジョイスティック・ボタン・視点ドラッグ）
export const input = {
  joyX: 0, joyY: 0, camDX: 0, camDY: 0,
  actions: new Set(), held: new Set(), keys: new Set(), moved: false,
};

const KEYMAP = {
  KeyJ: 'attack', Space: 'dodge', ShiftLeft: 'dodge', ShiftRight: 'dodge',
  KeyK: 'skill', KeyQ: 'item', KeyE: 'talk', Enter: 'talk',
};

export function initInput(canvas) {
  const joy = document.getElementById('joy');
  const knob = document.getElementById('knob');
  let joyId = null; let jx = 0; let jy = 0;
  let camId = null; let lx = 0; let ly = 0; let downX = 0; let downY = 0; let dragged = false;

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (e.pointerType !== 'mouse' && joyId === null && e.clientX < innerWidth * 0.45) {
      joyId = e.pointerId;
      jx = e.clientX; jy = e.clientY;
      joy.style.left = `${jx}px`;
      joy.style.top = `${jy}px`;
      joy.classList.remove('hidden');
      knob.style.transform = 'translate(-50%, -50%)';
    } else if (camId === null) {
      camId = e.pointerId;
      lx = downX = e.clientX; ly = downY = e.clientY;
      dragged = false;
    }
    try { canvas.setPointerCapture(e.pointerId); } catch { /* noop */ }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId === joyId) {
      let dx = e.clientX - jx;
      let dy = e.clientY - jy;
      const R = 55;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      input.joyX = dx / R;
      input.joyY = dy / R;
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    } else if (e.pointerId === camId) {
      input.camDX += e.clientX - lx;
      input.camDY += e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 8) dragged = true;
    }
  });

  const release = (e) => {
    if (e.pointerId === joyId) {
      joyId = null;
      input.joyX = input.joyY = 0;
      joy.classList.add('hidden');
    } else if (e.pointerId === camId) {
      if (!dragged && e.pointerType === 'mouse' && e.type === 'pointerup' && e.button === 0) input.actions.add('attack');
      camId = null;
    }
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    input.keys.add(e.code);
    const a = KEYMAP[e.code];
    if (a && !e.repeat) input.actions.add(a);
  });
  addEventListener('keyup', (e) => input.keys.delete(e.code));
  addEventListener('blur', () => { input.keys.clear(); input.held.clear(); });

  document.querySelectorAll('[data-act]').forEach((b) => {
    const act = b.dataset.act;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      input.actions.add(act);
      input.held.add(act);
      b.classList.add('down');
    });
    const up = () => { input.held.delete(act); b.classList.remove('down'); };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointerleave', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });
  addEventListener('contextmenu', (e) => e.preventDefault());
}

export function getMove() {
  let x = input.joyX;
  let y = -input.joyY;
  if (Math.hypot(x, y) < 0.15) { x = 0; y = 0; }
  const k = input.keys;
  if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
  if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
  if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
  if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
  const l = Math.hypot(x, y);
  if (l > 1) { x /= l; y /= l; }
  if (l > 0.2) input.moved = true;
  return { x, y };
}

export function consume(a) {
  const has = input.actions.has(a);
  input.actions.delete(a);
  return has;
}

export function isHeld(a) {
  return input.held.has(a) || (a === 'attack' && input.keys.has('KeyJ'));
}

export function clearActions() { input.actions.clear(); }

export function takeCam() {
  const d = { x: input.camDX, y: input.camDY };
  input.camDX = input.camDY = 0;
  return d;
}
