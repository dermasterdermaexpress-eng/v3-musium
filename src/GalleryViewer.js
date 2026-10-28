// GalleryViewer.js - viewer galeri 3D (orang pertama/ketiga, joystick mobile, web frame, video, area popup)
// Butuh: npm i three   (diuji untuk three r152 ke atas)
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

const PX = 1280, GAP = 0.02;
// Pencahayaan disamakan dengan editor (three r128). Ubah angka ini jika terlalu terang/gelap.
const LIGHT = parseInt(THREE.REVISION, 10) >= 155 ? Math.PI : 1;

const CSS = `
.gv-root{position:relative;overflow:hidden;background:#14161a;font-family:system-ui,sans-serif}
.gv-css,.gv-canvas{position:absolute;inset:0;width:100%;height:100%}
.gv-css{pointer-events:none}
.gv-canvas{touch-action:none;cursor:grab}
.gv-area{width:100%;height:100%;box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:30px;background:linear-gradient(135deg,#2b7be0,#0f2547);color:#fff;font:700 56px system-ui,sans-serif;text-align:center;padding:0 40px}
.gv-area.img{align-items:flex-end;justify-content:flex-start;padding:0 56px 56px;background-size:cover;background-position:center;text-align:left;text-shadow:0 2px 12px rgba(0,0,0,.6)}
.gv-dot{flex:none;width:70px;height:70px;border-radius:50%;background:#fff;animation:gv-pl 1.8s ease-out infinite}
@keyframes gv-pl{0%{box-shadow:0 0 0 0 rgba(255,255,255,.7)}100%{box-shadow:0 0 0 46px rgba(255,255,255,0)}}
.gv-pop{position:absolute;inset:0;z-index:10;display:none;align-items:center;justify-content:center;opacity:0;transition:opacity .3s}
.gv-pop.on{opacity:1}
.gv-box{background:#1c1f25;display:flex;flex-direction:column;border:1px solid #2b3038;box-shadow:0 24px 80px rgba(0,0,0,.65);border-radius:18px;overflow:hidden;color:#e9e7e2}
.gv-bar{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 14px;font:600 13px system-ui,sans-serif}
.gv-bar a{color:#4da3ff;text-decoration:none;margin-right:10px}
.gv-bar button{width:30px;height:30px;border:0;border-radius:50%;background:#4da3ff;color:#06121f;cursor:pointer}
.gv-view{position:relative;flex:1;background:#fff}
.gv-view iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.gv-hint{padding:7px 14px;color:#9aa0aa;font:12px system-ui,sans-serif}
.gv-root,.gv-ui{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
.gv-ui{position:absolute;inset:0;z-index:5;pointer-events:none;display:none}
.gv-ui.on{display:block}
.gv-joy{position:absolute;left:calc(28px + env(safe-area-inset-left,0px));bottom:calc(34px + env(safe-area-inset-bottom,0px));width:132px;height:132px;border-radius:50%;background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.35);backdrop-filter:blur(2px);pointer-events:auto;touch-action:none}
.gv-knob{position:absolute;left:50%;top:50%;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;background:rgba(255,255,255,.55);border:2px solid rgba(255,255,255,.8);box-shadow:0 2px 10px rgba(0,0,0,.35);pointer-events:none}
.gv-btns{position:absolute;right:calc(22px + env(safe-area-inset-right,0px));bottom:calc(34px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:12px;align-items:flex-end}
.gv-top{position:absolute;right:calc(14px + env(safe-area-inset-right,0px));top:calc(14px + env(safe-area-inset-top,0px));display:flex;gap:10px}
.gv-b{pointer-events:auto;touch-action:manipulation;min-width:64px;height:44px;padding:0 14px;border-radius:22px;border:1px solid rgba(255,255,255,.4);background:rgba(20,22,26,.55);color:#fff;font:600 13px system-ui,sans-serif;backdrop-filter:blur(4px)}
.gv-b.on{background:#4da3ff;color:#06121f;border-color:#4da3ff}
.gv-msg{position:absolute;left:50%;top:18px;transform:translateX(-50%);z-index:12;max-width:86%;padding:9px 16px;border-radius:12px;background:rgba(20,22,26,.85);color:#fff;font:13px system-ui,sans-serif;text-align:center;display:none;pointer-events:none}
`;

// Muat model .glb/.gltf atau .fbx (onProg dan onErr opsional)
function loadAny(url, cb, onProg, onErr) {
  if (/\.fbx$/i.test(url)) new FBXLoader().load(url, o => cb(o, o.animations), onProg, onErr);
  else new GLTFLoader().load(url, g => cb(g.scene, g.animations), onProg, onErr);
}

// Perkecil tekstur raksasa (mis. 4096 px) agar memori GPU, terutama di HP, tidak habis
function shrinkTex(t, max) {
  const im = t && t.image; if (!im) return;
  const w = im.width, h = im.height; if (!w || !h || Math.max(w, h) <= max) return;
  const k = max / Math.max(w, h), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, c.width, c.height);
  t.image = c; t.needsUpdate = true;
}
const TEX_KEYS = ['map', 'normalMap', 'metalnessMap', 'roughnessMap', 'emissiveMap', 'aoMap'];
function prepModel(obj, maxTex, env) {
  let tris = 0;
  obj.traverse(o => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
      TEX_KEYS.forEach(k => { if (m[k]) { shrinkTex(m[k], maxTex); m[k].anisotropy = 4; } });
      if (env && m.isMeshStandardMaterial) { m.envMap = env; m.envMapIntensity = 1; }
      m.needsUpdate = true;
    });
  });
  return Math.round(tris);
}
const normUrl = u => /^[a-z][a-z0-9+.-]*:\/\//i.test(u) ? u : 'https://' + u;
function toEmbed(raw, muted) {
  raw = normUrl(raw);
  let u; try { u = new URL(raw); } catch (e) { return raw; }
  const m = muted ? 1 : 0, host = u.hostname.replace('www.', '');
  let id = null;
  if (host === 'youtu.be') id = u.pathname.slice(1);
  else if (host.endsWith('youtube.com')) {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else if (/^\/(shorts|embed)\//.test(u.pathname)) id = u.pathname.split('/')[2];
  }
  if (id) return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=${m}&loop=1&playlist=${id}&rel=0&playsinline=1`;
  if (host.endsWith('vimeo.com') && !host.startsWith('player')) {
    const v = u.pathname.split('/').filter(Boolean)[0];
    if (/^\d+$/.test(v)) return `https://player.vimeo.com/video/${v}?autoplay=1&muted=${m}&loop=1`;
  }
  return raw;
}

function makeBot() {            // karakter bawaan (menghadap +Z)
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0x4da3ff, roughness: 0.6 }), sk = new THREE.MeshStandardMaterial({ color: 0xf1c9a5, roughness: 0.8 });
  const part = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); g.add(o); return o; };
  const limb = (w, h, x, y) => { const pv = new THREE.Group(); pv.position.set(x, y, 0); const l = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.16), m); l.position.y = -h / 2; pv.add(l); g.add(pv); return pv; };
  part(new THREE.BoxGeometry(0.42, 0.6, 0.24), m, 0, 1.15, 0);
  part(new THREE.SphereGeometry(0.15, 16, 12), sk, 0, 1.62, 0);
  part(new THREE.BoxGeometry(0.06, 0.06, 0.08), sk, 0, 1.62, 0.16);
  g.userData.legs = [limb(0.17, 0.8, -0.11, 0.82), limb(0.17, 0.8, 0.11, 0.82)];
  g.userData.arms = [limb(0.12, 0.58, -0.28, 1.43), limb(0.12, 0.58, 0.28, 1.43)];
  return g;
}

export class GalleryViewer {
  constructor(container, config, opts = {}) {
    if (!document.getElementById('gv-css')) {
      const s = document.createElement('style'); s.id = 'gv-css'; s.textContent = CSS; document.head.appendChild(s);
    }
    this.el = container; this.base = opts.baseUrl || ''; this.cfg = config;
    const cam = this.cam = config.camera;
    container.classList.add('gv-root');
    this.cssEl = document.createElement('div'); this.cssEl.className = 'gv-css';
    this.canvas = document.createElement('canvas'); this.canvas.className = 'gv-canvas';
    container.append(this.cssEl, this.canvas);

    const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    r.setPixelRatio(Math.min(window.devicePixelRatio, this.isTouch ? 1.5 : 2));
    this.canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.msg('Memori GPU habis. Muat ulang halaman atau pakai karakter/tekstur lebih ringan.', 8000); });
    if ('outputColorSpace' in r) r.outputColorSpace = THREE.SRGBColorSpace; else r.outputEncoding = THREE.sRGBEncoding;
    r.setClearColor(0x000000, 0);
    this.cssR = new CSS3DRenderer(); this.cssEl.appendChild(this.cssR.domElement);
    this.scene = new THREE.Scene(); this.cssScene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 1.1 * LIGHT));
    const sun = new THREE.DirectionalLight(0xffffff, 0.6 * LIGHT); sun.position.set(3, 8, 5); this.scene.add(sun);

    this.camera = new THREE.PerspectiveCamera(cam.fov, 1, 0.05, 500); this.camera.rotation.order = 'YXZ';
    this.yaw = 0; this.pitch = 0; this.ground = null; this.need = true; this.keys = {};
    this.body = new THREE.Vector3(); this.tp = false; this.chr = null; this.mixer = null; this.anims = {}; this.botT = 0; this.clips = []; this.extra = { walk: null, idle: null };
    this.keyToggle = opts.keyToggle !== false;
    this.joy = { x: 0, y: 0, id: null, run: false };
    this.maxTex = config.characterMaxTex || (this.isTouch ? 1024 : 2048);
    if (cam.dist == null) cam.dist = 3.5;
    if (cam.cs == null) cam.cs = 1;
    this.model = null; this.bounds = null; this.hot = []; this.drag = null;
    this.ray = new THREE.Raycaster(); this.colRay = new THREE.Raycaster(); this.clock = new THREE.Clock();
    this.holeMat = new THREE.MeshBasicMaterial({ color: 0, opacity: 0, transparent: true, blending: THREE.NoBlending, side: THREE.DoubleSide });

    this.goStart();
    this.buildPopup();
    this.buildControls(opts);
    (config.hotspots || []).forEach(h => this.addHotspot(h));
    this.bindEvents();
    this.resize();
    this.msg('Memuat ruangan...', 120000);
    new GLTFLoader().load(this.base + config.model, g => {
      this.msg('');
      prepModel(g.scene, this.isTouch ? 2048 : 4096, null);
      this.model = g.scene; this.scene.add(this.model);
      this.bounds = new THREE.Box3().setFromObject(this.model);
      if (!cam.start) {
        const c = this.bounds.getCenter(new THREE.Vector3());
        cam.start = { pos: [c.x, this.bounds.min.y + cam.eye, c.z], yaw: 0, pitch: 0 };
      }
      this.goStart();
      if (opts.onLoad) opts.onLoad(this);
    }, pr => { if (pr.total) this.msg('Memuat ruangan ' + Math.round(pr.loaded / pr.total * 100) + '%', 120000); },
    er => { console.error(er); this.msg('Gagal memuat ruangan. Cek alamat file model.', 8000); });
    this.setMode(cam.mode || 'first');
    if (config.character) loadAny(this.base + config.character, (o, a) => {
      try {
        prepModel(o, this.maxTex, this.getEnv());
        this.setChar(this.wrap(o), a);
        this.msg('');
      } catch (er) { console.error(er); this.chr = null; this.msg('Karakter tidak bisa dipakai: ' + er.message, 6000); if (this.tp) this.setChar(makeBot(), null); }
      const ca = config.characterAnims || {};
      ['walk', 'idle'].forEach(k => { if (ca[k]) loadAny(this.base + ca[k], (_o, an) => { if (an.length) { this.extra[k] = an[0]; this.rebuild(); } }); });
    }, pr => { if (pr.total && this.tp) this.msg('Memuat karakter ' + Math.round(pr.loaded / pr.total * 100) + '%', 120000); },
    er => { console.error(er); this.msg('Gagal memuat karakter. Cek konsol.', 6000); });
    this.tick = this.tick.bind(this); this.raf = requestAnimationFrame(this.tick);
  }

  msg(t, ms) {
    if (!this.msgEl) { this.msgEl = document.createElement('div'); this.msgEl.className = 'gv-msg'; this.el.appendChild(this.msgEl); }
    clearTimeout(this.msgT);
    if (!t) { this.msgEl.style.display = 'none'; return; }
    this.msgEl.textContent = t; this.msgEl.style.display = 'block';
    this.msgT = setTimeout(() => { this.msgEl.style.display = 'none'; }, ms || 2800);
  }

  // Cahaya lingkungan untuk karakter PBR (tanpa ini bagian metalik tampil hitam)
  getEnv() {
    if (this.env) return this.env;
    try {
      const pm = new THREE.PMREMGenerator(this.renderer), es = new THREE.Scene(), g = new THREE.SphereGeometry(50, 32, 16), pos = g.attributes.position, cols = [];
      for (let i = 0; i < pos.count; i++) { const t = (pos.getY(i) / 50 + 1) / 2; cols.push(0.45 + 0.5 * t, 0.47 + 0.5 * t, 0.52 + 0.48 * t); }
      g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      es.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
      this.env = pm.fromScene(es, 0.04).texture; pm.dispose();
    } catch (er) { console.error('env map gagal', er); }
    return this.env;
  }

  // Joystick + tombol sentuh. opts.joystick: 'auto' (default, hanya di layar sentuh) | true | false
  buildControls(opts) {
    const mode = opts.joystick === undefined ? 'auto' : opts.joystick;
    const show = mode === true || (mode === 'auto' && this.isTouch);
    const ui = this.ui = document.createElement('div'); ui.className = 'gv-ui' + (show ? ' on' : '');
    ui.innerHTML = '<div class="gv-joy"><div class="gv-knob"></div></div>' +
      '<div class="gv-btns"><button type="button" class="gv-b gv-run">Lari</button><button type="button" class="gv-b gv-vw">Orang 1</button></div>' +
      '<div class="gv-top"><button type="button" class="gv-b gv-fs">Layar penuh</button></div>';
    this.el.appendChild(ui);
    const base = ui.querySelector('.gv-joy'), knob = ui.querySelector('.gv-knob'), R = 46, DEAD = 0.15, joy = this.joy;
    const setKnob = (x, y) => { knob.style.transform = 'translate(' + (x * R) + 'px,' + (y * R) + 'px)'; };
    const upd = e => {
      const rc = base.getBoundingClientRect();
      let dx = (e.clientX - (rc.left + rc.width / 2)) / R, dy = (e.clientY - (rc.top + rc.height / 2)) / R;
      const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
      setKnob(dx, dy);
      const m = Math.hypot(dx, dy);
      if (m < DEAD) { joy.x = 0; joy.y = 0; } else { const k = (m - DEAD) / (1 - DEAD) / m; joy.x = dx * k; joy.y = dy * k; }
    };
    const end = e => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = 0; joy.y = 0; setKnob(0, 0); };
    base.addEventListener('pointerdown', e => { if (joy.id !== null) return; joy.id = e.pointerId; try { base.setPointerCapture(e.pointerId); } catch (_) {} upd(e); e.preventDefault(); });
    base.addEventListener('pointermove', e => { if (e.pointerId === joy.id) upd(e); });
    base.addEventListener('pointerup', end); base.addEventListener('pointercancel', end); base.addEventListener('lostpointercapture', end);
    this.btnRun = ui.querySelector('.gv-run'); this.btnView = ui.querySelector('.gv-vw');
    this.btnRun.onclick = () => { joy.run = !joy.run; this.btnRun.classList.toggle('on', joy.run); };
    this.btnView.onclick = () => this.setMode(this.tp ? 'first' : 'third');
    const fs = ui.querySelector('.gv-fs');
    if (!(this.el.requestFullscreen || this.el.webkitRequestFullscreen)) fs.style.display = 'none';
    fs.onclick = () => {
      const d = document;
      if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      else (this.el.requestFullscreen || this.el.webkitRequestFullscreen).call(this.el);
    };
  }

  goStart() {
    const s = this.cam.start; if (!s) return;
    this.body.set(s.pos[0], s.pos[1], s.pos[2]); this.yaw = s.yaw; this.pitch = s.pitch; this.need = true;
  }

  addHotspot(h) {
    const holder = document.createElement('div');
    Object.assign(holder.style, { background: '#111', overflow: 'hidden', boxSizing: 'border-box', width: PX + 'px', height: Math.round(PX * h.h / h.w) + 'px', border: `${h.frame.width}px solid ${h.frame.color}` });
    if (h.type === 'web' && h.url) {
      const f = document.createElement('iframe');
      f.src = toEmbed(h.url, h.muted); f.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
      f.style.cssText = 'width:100%;height:100%;border:0;background:#fff;'; holder.appendChild(f);
    } else if (h.type === 'video' && h.video) {
      const v = document.createElement('video');
      v.src = this.base + h.video; v.loop = true; v.autoplay = true; v.playsInline = true; v.muted = h.muted !== false;
      v.style.cssText = 'width:100%;height:100%;object-fit:fill;display:block;'; holder.appendChild(v);
      v.play().catch(() => {});
    } else if (h.type === 'area') {
      const a = document.createElement('div'); a.className = 'gv-area';
      const dot = document.createElement('span'); dot.className = 'gv-dot';
      const t = document.createElement('span'); t.textContent = h.label || '';
      a.append(dot, t);
      if (h.image) { a.classList.add('img'); a.style.backgroundImage = `linear-gradient(to top,rgba(8,12,24,.85),rgba(8,12,24,.15) 60%),url("${this.base + h.image}")`; }
      holder.appendChild(a);
    }
    const base = new THREE.Quaternion().fromArray(h.base);
    const q = base.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), h.roll * Math.PI / 180));
    const css = new CSS3DObject(holder);
    css.position.fromArray(h.position); css.quaternion.copy(q); css.scale.setScalar(h.w / PX);
    this.cssScene.add(css);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.holeMat);
    mesh.position.fromArray(h.position); mesh.quaternion.copy(q); mesh.scale.set(h.w, h.h, 1);
    this.scene.add(mesh);
    this.hot.push({ h, mesh });
  }

  buildPopup() {
    const p = this.pop = document.createElement('div'); p.className = 'gv-pop';
    p.innerHTML = '<div class="gv-box"><div class="gv-bar"><span class="gv-title"></span><span><a class="gv-new" target="_blank" rel="noopener">Buka di tab baru</a><button aria-label="Tutup">&#10005;</button></span></div><div class="gv-view"><iframe allow="autoplay; fullscreen; encrypted-media; clipboard-write" referrerpolicy="strict-origin-when-cross-origin"></iframe></div><div class="gv-hint">Halaman kosong? Sebagian situs menolak dibuka di dalam bingkai. Gunakan "Buka di tab baru".</div></div>';
    this.el.appendChild(p);
    p.querySelector('button').onclick = () => this.closePop();
    p.onclick = e => { if (e.target === p) this.closePop(); };
  }
  openPop(h) {
    const pp = h.popup; if (!pp || !pp.url) return;
    const p = this.pop, box = p.querySelector('.gv-box'), url = toEmbed(pp.url, false);
    p.style.background = `rgba(0,0,0,${pp.veil})`; box.style.width = pp.size + '%'; box.style.height = pp.size + '%';
    let host = url; try { host = new URL(url).hostname.replace('www.', ''); } catch (e) {}
    p.querySelector('.gv-title').textContent = host; p.querySelector('.gv-new').href = normUrl(pp.url);
    p.querySelector('iframe').src = url;
    p.style.display = 'flex'; requestAnimationFrame(() => p.classList.add('on'));
  }
  closePop() {
    const p = this.pop; if (!p.classList.contains('on')) return;
    p.classList.remove('on');
    setTimeout(() => { p.style.display = 'none'; p.querySelector('iframe').src = 'about:blank'; }, 300);
  }

  pick(e) {
    const rc = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2((e.clientX - rc.left) / rc.width * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const hs = this.ray.intersectObjects(this.hot.map(x => x.mesh), false)[0];
    if (!hs) return null;
    const w = this.model ? this.ray.intersectObject(this.model, true)[0] : null;
    if (w && w.distance < hs.distance - 0.001) return null;
    return this.hot.find(x => x.mesh === hs.object).h;
  }

  bindEvents() {
    const cv = this.canvas, cam = this.cam;
    this.on = {
      down: e => { if (this.drag) return; this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, h: this.pick(e) }; },
      hover: e => {
        if (this.drag || e.pointerType !== 'mouse') return;
        const h = this.pick(e); cv.style.cursor = h && h.popup && h.popup.url ? 'pointer' : 'grab';
      },
      move: e => {
        const d = this.drag; if (!d || e.pointerId !== d.id) return;
        const dx = e.clientX - d.x, dy = e.clientY - d.y; d.x = e.clientX; d.y = e.clientY; d.moved += Math.abs(dx) + Math.abs(dy);
        const k = 0.0035 * cam.rot * (e.pointerType === 'touch' ? 1.3 : 1);
        this.yaw -= dx * k; this.pitch -= dy * k;
      },
      up: e => {
        const d = this.drag; if (!d || e.pointerId !== d.id) return;
        if (d.moved < 6 && d.h) this.openPop(d.h);
        this.drag = null;
      },
      kd: e => {
        if (!/INPUT|TEXTAREA/.test(document.activeElement.tagName)) this.keys[e.code] = true;
        if (e.code === 'Escape') this.closePop();
        if (e.code === 'KeyV' && this.keyToggle) this.setMode(this.tp ? 'first' : 'third');
      },
      ku: e => { this.keys[e.code] = false; },
    };
    this.ac = new AbortController();
    cv.addEventListener('pointerdown', this.on.down);
    cv.addEventListener('pointermove', this.on.hover);
    window.addEventListener('pointermove', this.on.move, { signal: this.ac.signal });
    window.addEventListener('pointerup', this.on.up, { signal: this.ac.signal });
    window.addEventListener('pointercancel', this.on.up, { signal: this.ac.signal });
    window.addEventListener('keydown', this.on.kd, { signal: this.ac.signal });
    window.addEventListener('keyup', this.on.ku, { signal: this.ac.signal });
    window.addEventListener('blur', () => { this.keys = {}; }, { signal: this.ac.signal });
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(this.el);
  }

  resize() {
    const w = this.el.clientWidth || 1, h = this.el.clientHeight || 1;
    this.renderer.setSize(w, h, false); this.cssR.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  hit(from, dir, dist) { this.colRay.set(from, dir); this.colRay.far = dist; return this.colRay.intersectObject(this.model, true).length > 0; }
  groundAt(x, y, z) {
    this.colRay.set(new THREE.Vector3(x, y, z), new THREE.Vector3(0, -1, 0)); this.colRay.far = 8;
    const h = this.colRay.intersectObject(this.model, true)[0]; return h ? h.point.y : null;
  }
  step(dx, dz) {
    const p = this.body, cam = this.cam;
    if (cam.col && this.model) {
      [[dx, 0], [0, dz]].forEach(([ax, az]) => {
        if (!ax && !az) return;
        const d = new THREE.Vector3(ax, 0, az), len = d.length(); d.normalize();
        const low = (this.ground !== null ? this.ground : p.y - cam.eye) + Math.max(cam.step, 0.05) + 0.08;
        if (this.hit(new THREE.Vector3(p.x, low, p.z), d, len + 0.35) || this.hit(new THREE.Vector3(p.x, p.y - 0.3, p.z), d, len + 0.35)) return;
        if (cam.keep && this.ground !== null) { const g = this.groundAt(p.x + ax, p.y, p.z + az); if (g !== null && g - this.ground > cam.step + 0.001) return; }
        p.x += ax; p.z += az;
      });
    } else { p.x += dx; p.z += dz; }
    const b = this.bounds;
    if (cam.bound && b) { p.x = Math.min(b.max.x - 0.3, Math.max(b.min.x + 0.3, p.x)); p.z = Math.min(b.max.z - 0.3, Math.max(b.min.z + 0.3, p.z)); }
  }

  tick() {
    this.raf = requestAnimationFrame(this.tick);
    const cam = this.cam, k = this.keys, p = this.body, joy = this.joy;
    const run = !!(k.ShiftLeft || k.ShiftRight || joy.run);
    const dt = Math.min(this.clock.getDelta(), 0.1), v = (run ? 5 : 2.2) * cam.spd * dt;
    let f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0) - joy.y, r = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0) + joy.x;
    const len = Math.hypot(f, r); if (len > 1) { f /= len; r /= len; }
    const moving = len > 0.01;
    let mdx = 0, mdz = 0;
    if (moving) { mdx = (-Math.sin(this.yaw) * f + Math.cos(this.yaw) * r) * v; mdz = (-Math.cos(this.yaw) * f - Math.sin(this.yaw) * r) * v; this.step(mdx, mdz); this.need = true; }
    if (cam.keep && this.model && this.need) {
      const g = this.groundAt(p.x, p.y, p.z);
      if (g !== null) { this.ground = g; p.y += (g + cam.eye - p.y) * Math.min(1, dt * 12); if (Math.abs(g + cam.eye - p.y) < 0.002) this.need = moving; }
      else this.need = false;
    } else if (!moving) this.need = false;
    if (!isFinite(p.x + p.y + p.z)) this.goStart();
    this.pitch = Math.max(-cam.down * Math.PI / 180, Math.min(cam.up * Math.PI / 180, this.pitch));
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.placeCamera();
    try { this.updateChar(dt, moving, mdx, mdz, run); }
    catch (er) { console.error(er); this.mixer = null; this.anims = {}; if (this.chr) { this.scene.remove(this.chr); this.chr = null; } this.setMode('first'); this.msg('Karakter bermasalah, kembali ke orang pertama', 5000); }
    try { this.renderer.render(this.scene, this.camera); } catch (er) { console.error(er); }
    try { this.cssR.render(this.cssScene, this.camera); } catch (er) { console.error(er); }
  }

  // ----- Orang ketiga -----
  wrap(obj) {
    const junk = []; obj.traverse(o => { if (o.isLight || o.isCamera) junk.push(o); });
    junk.forEach(o => o.parent && o.parent.remove(o));
    obj.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(obj), hh = b.max.y - b.min.y;
    if (b.isEmpty() || !isFinite(hh) || hh <= 0) throw new Error('Karakter kosong atau ukuran tidak valid');
    const s = 1.7 / hh;
    obj.scale.setScalar(s); obj.position.y = -b.min.y * s;
    const g = new THREE.Group(); g.add(obj); return g;
  }
  setChar(group, clips) {
    if (this.chr) this.scene.remove(this.chr);
    this.chr = group; group.scale.setScalar(this.cam.cs); group.visible = this.tp; this.scene.add(group);
    this.clips = clips || []; this.rebuild();
  }
  rebuild() {
    this.mixer = null; this.anims = {};
    const c = this.chr; if (!c || c.userData.legs) return;
    const cl = this.clips, f = re => cl.find(x => re.test(x.name));
    const walk = this.extra.walk || f(/walk|run/i) || cl.find(x => !/idle|stand/i.test(x.name)) || cl[0], idle = this.extra.idle || f(/idle|stand/i), w = walk || idle;
    if (!w) return;
    const m = this.mixer = new THREE.AnimationMixer(c.children[0]);
    this.anims = { walk: m.clipAction(w), idle: idle && idle !== w ? m.clipAction(idle) : null, cur: null };
  }
  setMode(m) {
    this.tp = m === 'third'; this.cam.mode = m;
    if (this.tp && !this.chr) this.setChar(makeBot(), null);
    if (this.chr) this.chr.visible = this.tp;
    if (!this.tp) this.camera.position.copy(this.body);
    if (this.btnView) { this.btnView.textContent = this.tp ? 'Orang 3' : 'Orang 1'; this.btnView.classList.toggle('on', this.tp); }
    this.need = true;
  }
  placeCamera() {
    const cam = this.cam, c = this.camera;
    if (!this.tp) { c.position.copy(this.body); return; }
    const cp = Math.cos(this.pitch), d = new THREE.Vector3(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
    const head = this.body.clone(); head.y += 0.1;
    let dist = cam.dist;
    if (this.model) {
      this.colRay.set(head, d.clone().negate()); this.colRay.far = dist + 0.3;
      const h = this.colRay.intersectObject(this.model, true)[0]; if (h) dist = Math.max(0.4, h.distance - 0.25);
    }
    if (!isFinite(dist)) dist = Math.min(cam.dist, 1.5);
    c.position.copy(head).addScaledVector(d, -dist);
    if (!isFinite(c.position.x + c.position.y + c.position.z)) { this.goStart(); c.position.copy(this.body); }
    if (this.chr) this.chr.visible = dist > 0.5;
  }
  updateChar(dt, moving, dx, dz, run) {
    const c = this.chr; if (!this.tp || !c) return;
    c.position.set(this.body.x, this.body.y - this.cam.eye, this.body.z); c.scale.setScalar(this.cam.cs);
    if (moving) { let d = Math.atan2(dx, dz) - c.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); c.rotation.y += d * Math.min(1, dt * 10); }
    if (this.mixer) {
      const a = this.anims, t = moving ? a.walk : (a.idle || a.walk);
      if (t !== a.cur) { if (a.cur) a.cur.fadeOut(0.2); t.reset().fadeIn(0.2).play(); a.cur = t; }
      t.timeScale = !moving && !a.idle ? 0 : (run ? 1.6 : 1);
      this.mixer.update(dt);
    } else if (c.userData.legs) {
      this.botT += dt * (moving ? (run ? 11 : 7) : 0);
      const sw = moving ? Math.sin(this.botT) * 0.7 : 0, [l1, l2] = c.userData.legs, [a1, a2] = c.userData.arms;
      l1.rotation.x = sw; l2.rotation.x = -sw; a1.rotation.x = -sw; a2.rotation.x = sw;
    } else {   // model tanpa animasi: goyangan ringan saat berjalan
      this.botT += dt * (moving ? (run ? 11 : 7) : 0);
      c.position.y += moving ? Math.abs(Math.sin(this.botT)) * 0.06 : 0; c.rotation.z = moving ? Math.sin(this.botT) * 0.05 : 0;
    }
  }

  dispose() {
    cancelAnimationFrame(this.raf); this.ac.abort(); this.ro.disconnect();
    this.renderer.dispose(); this.el.innerHTML = ''; this.el.classList.remove('gv-root');
  }
}
