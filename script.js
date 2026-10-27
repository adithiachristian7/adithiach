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
const mainSrc = portraitImg.getAttribute('src');
const altSrc = portraitImg.dataset.alt;
let hasAlt = false;
portraitImg.addEventListener('error', () => {
  if (portraitImg.getAttribute('src') === mainSrc) portrait.classList.add('no-photo');
  else portraitImg.src = mainSrc;
});
if (portraitImg.complete && portraitImg.naturalWidth === 0) portrait.classList.add('no-photo');
if (altSrc) {
  const probe = new Image();
  probe.onload = () => { hasAlt = true; };
  probe.src = altSrc;
}

// Tombol "Show aura": nyalakan aura warna dan ganti foto kalau ada foto kedua
const auraBtn = document.getElementById('auraToggle');
auraBtn.addEventListener('click', () => {
  const on = auraBtn.getAttribute('aria-pressed') !== 'true';
  auraBtn.setAttribute('aria-pressed', String(on));
  auraBtn.querySelector('strong').textContent = on ? 'Hide aura' : 'Show aura';
  portrait.classList.toggle('is-aura', on);
  if (hasAlt) portraitImg.src = on ? altSrc : mainSrc;
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
