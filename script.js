// Tahun di footer
document.getElementById('year').textContent = new Date().getFullYear();
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Menu mobile
const menuBtn = document.getElementById('menuToggle');
const navLinks = document.getElementById('navLinks');
const setMenu = (open) => {
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  navLinks.classList.toggle('is-open', open);
};
menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
navLinks.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));

// Foto potret: tampilkan placeholder kalau img/portrait.png belum ada
const portrait = document.getElementById('portrait');
const portraitImg = document.getElementById('portraitImg');
portraitImg.addEventListener('error', () => portrait.classList.add('no-photo'));
if (portraitImg.complete && portraitImg.naturalWidth === 0) portrait.classList.add('no-photo');

// Efek aura: versi aura "terbakar" hilang saat halaman dibuka, tombol "Show aura" membakar
// bolak-balik antara dua versi, dan jejak kursor/jari sesaat memperlihatkan versi yang lain.
const auraBtn = document.getElementById('auraToggle');
const fxCanvas = document.getElementById('portraitFx');
let portraitFx = null;

function mountPortraitFx(photo, aura) {
  const ctx = fxCanvas.getContext('2d');
  const layer = document.createElement('canvas');
  const lctx = layer.getContext('2d');

  // mask, glow dan jejak dihitung di resolusi kecil lalu di-scale halus
  const MW = 260;
  const MH = Math.round((MW * photo.naturalHeight) / photo.naturalWidth);
  const makeCanvas = () => { const c = document.createElement('canvas'); c.width = MW; c.height = MH; return c; };
  const trail = makeCanvas(), mask = makeCanvas(), glow = makeCanvas();
  const tctx = trail.getContext('2d', { willReadFrequently: true });
  const mctx = mask.getContext('2d'), gctx = glow.getContext('2d');
  const mdata = mctx.createImageData(MW, MH), gdata = gctx.createImageData(MW, MH);

  // noise berlapis untuk tepi bakar yang tidak rata
  const rnd = (x, y) => { const v = Math.sin(x * 91.7 + y * 47.3 + 3.1) * 15731.743; return v - Math.floor(v); };
  const vnoise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = rnd(xi, yi), b = rnd(xi + 1, yi), c = rnd(xi, yi + 1), d = rnd(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const field = new Float32Array(MW * MH);
  for (let j = 0; j < MH; j++) {
    for (let i = 0; i < MW; i++) {
      const x = (i / MW) * 4.2 + 1.7, y = (j / MW) * 4.2 + 1.7;
      field[j * MW + i] = vnoise(x, y) * 0.53 + vnoise(x * 2, y * 2) * 0.27 + vnoise(x * 4, y * 4) * 0.13 + vnoise(x * 8, y * 8) * 0.07;
    }
  }
  const ss = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

  // progress 0 = aura, 1 = foto asli
  let progress = reduceMotion ? 1 : 0, target = 1;
  const duration = 2.2, edge = 0.07;
  let cw = 0, ch = 0;

  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    cw = Math.round(fxCanvas.clientWidth * dpr);
    ch = Math.round(fxCanvas.clientHeight * dpr);
    if (!cw || !ch) return;
    fxCanvas.width = layer.width = cw;
    fxCanvas.height = layer.height = ch;
    wake();
  };

  // jejak kursor
  let pointer = null, lastPointer = null, activeFrames = 0, rect = fxCanvas.getBoundingClientRect();
  const onPointer = (e) => {
    rect = fxCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width, y = (e.clientY - rect.top) / rect.height;
    if (x < -0.1 || x > 1.1 || y < -0.1 || y > 1.1) { lastPointer = null; return; }
    pointer = { x, y };
    wake();
  };
  const paintTrail = () => {
    tctx.globalCompositeOperation = 'destination-out';
    tctx.fillStyle = 'rgba(0,0,0,0.045)';
    tctx.fillRect(0, 0, MW, MH);
    if (!pointer) return;
    tctx.globalCompositeOperation = 'lighter';
    const brush = (90 / rect.width) * MW;
    const from = lastPointer || pointer;
    const steps = Math.max(1, Math.ceil(Math.hypot((pointer.x - from.x) * MW, (pointer.y - from.y) * MH) / (brush * 0.35)));
    for (let k = 1; k <= steps; k++) {
      const cx = (from.x + ((pointer.x - from.x) * k) / steps) * MW;
      const cy = (from.y + ((pointer.y - from.y) * k) / steps) * MH;
      const g = tctx.createRadialGradient(cx, cy, 0, cx, cy, brush);
      g.addColorStop(0, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      tctx.fillStyle = g;
      tctx.fillRect(cx - brush, cy - brush, brush * 2, brush * 2);
    }
    lastPointer = pointer;
    pointer = null;
  };

  const render = () => {
    const td = tctx.getImageData(0, 0, MW, MH).data;
    const md = mdata.data, gd = gdata.data;
    const th = progress * (1 + edge * 2) - edge;
    for (let i = 0; i < MW * MH; i++) {
      const n = field[i];
      const revealed = 1 - ss(th - edge * 0.35, th + edge * 0.35, n);
      const burn = (1 - ss(0, edge * 0.45, Math.abs(n - th))) * 0.9;
      const tm = ss(0.28, 0.55, td[i * 4 + 3] / 255 + (n - 0.5) * 0.35);
      const tg = Math.pow(4 * tm * (1 - tm), 6) * 0.75;
      const showPhoto = revealed + (1 - 2 * revealed) * tm;
      const o = i * 4;
      md[o] = md[o + 1] = md[o + 2] = 255;
      md[o + 3] = (1 - showPhoto) * 255;
      gd[o] = 255; gd[o + 1] = 212; gd[o + 2] = 59;
      gd[o + 3] = Math.min(1, burn * (progress > 0 && progress < 1 ? 1 : 0) + tg) * 255;
    }
    mctx.putImageData(mdata, 0, 0);
    gctx.putImageData(gdata, 0, 0);

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(photo, 0, 0, cw, ch);
    // versi aura, hanya di area mask
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, cw, ch);
    lctx.drawImage(aura, 0, 0, cw, ch);
    lctx.globalCompositeOperation = 'destination-in';
    lctx.drawImage(mask, 0, 0, cw, ch);
    ctx.drawImage(layer, 0, 0);
    // garis bakar kuning, hanya di dalam siluet
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, cw, ch);
    lctx.drawImage(glow, 0, 0, cw, ch);
    lctx.globalCompositeOperation = 'destination-in';
    lctx.drawImage(photo, 0, 0, cw, ch);
    ctx.drawImage(layer, 0, 0);
  };

  let raf = 0, running = false, last = performance.now();
  const frame = (now) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const burning = progress !== target;
    if (burning) {
      const step = dt / duration;
      progress = target > progress ? Math.min(target, progress + step) : Math.max(target, progress - step);
    }
    const moved = pointer !== null;
    paintTrail();
    render();
    activeFrames = moved ? 150 : activeFrames - 1;
    if (burning || activeFrames > 0) raf = requestAnimationFrame(frame);
    else { running = false; lastPointer = null; }
  };
  function wake() {
    if (running || document.hidden || !cw) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  new ResizeObserver(resize).observe(fxCanvas);
  if (!reduceMotion) addEventListener('pointermove', onPointer, { passive: true });
  document.addEventListener('visibilitychange', wake);
  portrait.classList.add('fx-ready');
  resize();

  return {
    show(which) {
      target = which === 'aura' ? 0 : 1;
      if (reduceMotion) progress = target;
      wake();
    },
  };
}

const loadImage = (src) => new Promise((resolve, reject) => {
  const im = new Image();
  im.onload = () => resolve(im);
  im.onerror = reject;
  im.src = src;
});
if (portraitImg.dataset.aura && fxCanvas.getContext) {
  Promise.all([loadImage(portraitImg.getAttribute('src')), loadImage(portraitImg.dataset.aura)])
    .then(([photo, aura]) => { portraitFx = mountPortraitFx(photo, aura); })
    .catch(() => { auraBtn.hidden = true; });
}

auraBtn.addEventListener('click', () => {
  const on = auraBtn.getAttribute('aria-pressed') !== 'true';
  auraBtn.setAttribute('aria-pressed', String(on));
  auraBtn.querySelector('strong').textContent = on ? 'Show photo' : 'Show aura';
  if (portraitFx) portraitFx.show(on ? 'aura' : 'photo');
});

// Garis kontur topografi di latar (marching squares di atas noise)
const canvas = document.getElementById('contours');
const ctx = canvas.getContext('2d');
const seed = 7.31;
const hash = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453;
  return s - Math.floor(s);
};
const smooth = (t) => t * t * (3 - 2 * t);
const noise = (x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  const u = smooth(xf), v = smooth(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const field = (x, y) => noise(x, y) * 0.65 + noise(x * 2.1 + 5, y * 2.1 + 3) * 0.25 + noise(x * 4.3, y * 4.3) * 0.1;

function drawContours() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = innerWidth, h = innerHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--contour').trim();
  ctx.lineWidth = 1;

  const step = 12;
  const scale = 1 / 380;
  const cols = Math.ceil(w / step) + 1, rows = Math.ceil(h / step) + 1;
  const v = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) v[j * cols + i] = field(i * step * scale, j * step * scale);

  ctx.beginPath();
  for (let level = 0.2; level < 0.9; level += 0.055) {
    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const a = v[j * cols + i], b = v[j * cols + i + 1], c = v[(j + 1) * cols + i + 1], d = v[(j + 1) * cols + i];
        const idx = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const x = i * step, y = j * step;
        const top = [x + step * ((level - a) / (b - a)), y];
        const right = [x + step, y + step * ((level - b) / (c - b))];
        const bottom = [x + step * ((level - d) / (c - d)), y + step];
        const left = [x, y + step * ((level - a) / (d - a))];
        const seg = (p, q) => { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); };
        switch (idx) {
          case 1: case 14: seg(left, bottom); break;
          case 2: case 13: seg(bottom, right); break;
          case 3: case 12: seg(left, right); break;
          case 4: case 11: seg(top, right); break;
          case 6: case 9: seg(top, bottom); break;
          case 7: case 8: seg(left, top); break;
          case 5: seg(left, top); seg(bottom, right); break;
          case 10: seg(top, right); seg(left, bottom); break;
        }
      }
    }
  }
  ctx.stroke();
}
drawContours();
let resizeTimer;
addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(drawContours, 150); });

// Animasi muncul saat masuk layar. Konten tetap terlihat tanpa JS;
// .reveal-ready hanya dipasang kalau animasi boleh jalan.
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('is-visible');
    io.unobserve(e.target);
  });
}, { threshold: 0.15 });
if (!reduceMotion) {
  document.documentElement.classList.add('reveal-ready');
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    const i = [...el.parentElement.children].filter((c) => c.hasAttribute('data-reveal')).indexOf(el);
    el.style.setProperty('--d', `${i * 90}ms`);
    io.observe(el);
  });
}

// Link nav aktif sesuai section
const links = [...navLinks.querySelectorAll('a:not(.nav__cta)')];
const spy = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    links.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${e.target.id}`));
  });
}, { rootMargin: '-45% 0px -50% 0px' });
document.querySelectorAll('section[id]').forEach((s) => spy.observe(s));
