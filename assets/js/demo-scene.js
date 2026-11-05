/**
 * Damn Parking driver demo.
 * In-browser sequence: pull up to the lot, check the phone, park, and watch the stall fill.
 * This is a portal demonstration, not a live camera and not a released app.
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

const STALLS = 8;
const TARGET = 3;
const PITCH = 2.75;
const DURATION = 24;

const BEATS = [
  { id: 'approach', at: 0, title: 'Pulling up to the lot', caption: 'The driver needs an open stall at Sun Bowl Garage.' },
  { id: 'phone', at: 6, title: 'Phone up', caption: 'Damn Parking shows stall A4 open. Eighteen stalls are still free.' },
  { id: 'park', at: 11.5, title: 'Driving in', caption: 'He follows A4 down the aisle and pulls into the stall.' },
  { id: 'fill', at: 19, title: 'Spot filled', caption: 'The lot camera marks A4 taken. Open stalls drop from 18 to 17.' },
];

function smootherstep(t) {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function stallX(index) {
  return (index - (STALLS - 1) / 2) * PITCH;
}

function fillAmount(t) {
  return smootherstep((t - 19) / 2.4);
}

function beatIndex(t) {
  let index = 0;
  for (let i = 0; i < BEATS.length; i += 1) {
    if (t >= BEATS[i].at) index = i;
  }
  return index;
}

function samplePath(t) {
  const keys = [
    { t: 0, x: 7.2, z: 22 },
    { t: 6, x: stallX(TARGET), z: 8.6 },
    { t: 11.5, x: stallX(TARGET), z: 7.5 },
    { t: 19, x: stallX(TARGET), z: 1.35 },
    { t: DURATION, x: stallX(TARGET), z: 1.35 },
  ];
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i += 1;
  const a = keys[i];
  const b = keys[i + 1];
  const u = smootherstep((t - a.t) / Math.max(0.001, b.t - a.t));
  const x = lerp(a.x, b.x, u);
  const z = lerp(a.z, b.z, u);
  const segX = b.x - a.x;
  const segZ = b.z - a.z;
  const yaw = Math.hypot(segX, segZ) > 0.05 ? Math.atan2(segX, segZ) : Math.PI;
  const aheadT = Math.min(t + 0.35, DURATION);
  const ahead = samplePoint(aheadT, keys);
  const speed = Math.hypot(ahead.x - x, ahead.z - z) / 0.35;
  return { x, z, yaw, speed };
}

function samplePoint(t, keys) {
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i += 1;
  const a = keys[i];
  const b = keys[i + 1];
  const u = smootherstep((t - a.t) / Math.max(0.001, b.t - a.t));
  return { x: lerp(a.x, b.x, u), z: lerp(a.z, b.z, u) };
}

function box(w, h, d, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function makeCarMaterials() {
  const rubber = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95, metalness: 0.02 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd5dae2, roughness: 0.12, metalness: 1, envMapIntensity: 1.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.4, metalness: 0.6 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x8eafc6,
    roughness: 0.05,
    metalness: 0.1,
    transparent: true,
    opacity: 0.45,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.3,
  });
  const tireGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 20);
  const hubGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.26, 16);
  const cache = new Map();
  function body(color) {
    const key = String(color);
    if (!cache.has(key)) {
      cache.set(key, new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.22,
        metalness: 0.72,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.15,
      }));
    }
    return cache.get(key);
  }
  return { rubber, chrome, dark, glass, tireGeo, hubGeo, body };
}

function makeAsphaltTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3a4048';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 4000; i += 1) {
    const g = 48 + Math.random() * 28;
    ctx.fillStyle = 'rgba(' + g + ',' + (g + 2) + ',' + (g + 6) + ',0.35)';
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSkyDome() {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, '#6eafdf');
  gradient.addColorStop(0.42, '#d5ecf8');
  gradient.addColorStop(0.7, '#f6d7b0');
  gradient.addColorStop(1, '#e0a06a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 8, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    new THREE.SphereGeometry(80, 28, 18),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false })
  );
}

function makeLotEnvironment(renderer) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(
    new THREE.SphereGeometry(10, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0x9ec8ea, side: THREE.BackSide })
  ));
  const warm = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), new THREE.MeshBasicMaterial({ color: 0xffe3b0 }));
  warm.position.set(4, 4, 4);
  warm.lookAt(0, 0, 0);
  env.add(warm);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), new THREE.MeshBasicMaterial({ color: 0x3c434c }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2;
  env.add(ground);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.04).texture;
  pmrem.dispose();
  return tex;
}

function addGarage(scene) {
  const wall = new THREE.MeshStandardMaterial({ color: 0xd9d3c8, roughness: 0.82 });
  const block = new THREE.Mesh(new THREE.BoxGeometry(26, 6.2, 5.2), wall);
  block.position.set(0, 3.1, -8.2);
  block.castShadow = true;
  block.receiveShadow = true;
  scene.add(block);
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#c9c2b6';
  ctx.fillRect(0, 0, 512, 256);
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      ctx.fillStyle = (col + row) % 3 === 0 ? '#f4e2b0' : '#8eb4cc';
      ctx.fillRect(28 + col * 62, 28 + row * 70, 36, 46);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const windows = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 4.2),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.05 })
  );
  windows.position.set(0, 3.3, -5.55);
  scene.add(windows);
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 0.7, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x171a20, roughness: 0.5 })
  );
  sign.position.set(0, 5.6, -5.5);
  scene.add(sign);
}

function makeLamp(x, z) {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: 0.4, metalness: 0.7 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.4, 10), metal);
  pole.position.y = 2.2;
  pole.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.28), metal);
  head.position.y = 4.35;
  const bulb = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.06, 0.16),
    new THREE.MeshStandardMaterial({ color: 0xfff4d2, emissive: 0xffe2a0, emissiveIntensity: 0.8 })
  );
  bulb.position.y = 4.26;
  group.add(pole, head, bulb);
  group.position.set(x, 0, z);
  return group;
}

function stallLabel(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.font = '700 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.35, 0.68),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

function boot(root) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const phone = document.getElementById('demo-phone');
  const title = document.getElementById('demo-title');
  const caption = document.getElementById('demo-caption');
  const openEl = document.getElementById('demo-open');
  const statusEl = document.getElementById('demo-status');
  const systemEl = document.getElementById('demo-system');
  const systemText = document.getElementById('demo-system-text');
  const speedEl = document.getElementById('demo-speed');
  const hood = document.querySelector('.demo-hood');
  const pillars = document.querySelectorAll('.demo-pillar');
  const playBtn = document.getElementById('demo-play');
  const bar = document.getElementById('demo-progress');
  const stallGrid = document.getElementById('demo-stalls');

  const stallEls = [];
  for (let i = 0; i < STALLS; i += 1) {
    const cell = document.createElement('div');
    cell.className = 'demo-stall' + (i === TARGET ? ' is-target is-open' : ' is-taken');
    cell.textContent = 'A' + (i + 1);
    stallGrid.appendChild(cell);
    stallEls.push(cell);
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (err) {
    console.warn('Damn Parking driver demo unavailable:', err);
    root.innerHTML = '<p class="demo-fallback">This browser cannot start the 3D demo. The story is listed under the player.</p>';
    showEndCopy();
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x10141c, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  root.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcfe6f4);
  scene.fog = new THREE.Fog(0xd7c4ae, 28, 78);
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 120);
  scene.environment = makeLotEnvironment(renderer);

  scene.add(makeSkyDome());
  scene.add(new THREE.HemisphereLight(0xc5ddf2, 0x6d5b48, 0.72));
  const sun = new THREE.DirectionalLight(0xfff0d2, 2.35);
  sun.position.set(16, 22, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 4;
  sun.shadow.camera.far = 48;
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  const asphalt = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 52),
    new THREE.MeshStandardMaterial({ map: makeAsphaltTexture(), color: 0xffffff, roughness: 0.92, metalness: 0.04 })
  );
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.receiveShadow = true;
  scene.add(asphalt);

  const curbMat = new THREE.MeshStandardMaterial({ color: 0xc8c2b8, roughness: 0.78 });
  const curb = new THREE.Mesh(new THREE.BoxGeometry(28, 0.16, 0.35), curbMat);
  curb.position.set(0, 0.08, -3.15);
  curb.receiveShadow = true;
  scene.add(curb);
  addGarage(scene);
  [-12, 12].forEach((x) => scene.add(makeLamp(x, 11.5)));

  const shared = makeCarMaterials();

  function makeCar(color, isDriver) {
    const group = new THREE.Group();
    const bodyMat = shared.body(color);
    const darkMat = shared.dark;
    const glassMat = shared.glass;
    const chromeMat = shared.chrome;
    const add = (mesh) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    };
    add(box(1.82, 0.18, 3.85, darkMat, 0, 0.28, 0));
    add(box(1.76, 0.46, 3.55, bodyMat, 0, 0.55, 0.02));
    add(box(1.6, 0.1, 1.15, bodyMat, 0, 0.84, 1.05));
    add(box(1.5, 0.46, 1.45, bodyMat, 0, 1.02, -0.15));
    add(box(1.28, 0.06, 1.2, bodyMat, 0, 1.28, -0.18));
    const windshield = add(box(1.22, 0.42, 0.05, glassMat, 0, 1.05, 0.58));
    windshield.rotation.x = -0.42;
    const rear = add(box(1.16, 0.36, 0.05, glassMat, 0, 1.02, -0.92));
    rear.rotation.x = 0.35;
    add(box(0.04, 0.32, 0.95, glassMat, -0.74, 1.02, -0.12));
    add(box(0.04, 0.32, 0.95, glassMat, 0.74, 1.02, -0.12));
    add(box(1.78, 0.16, 0.18, darkMat, 0, 0.32, 1.82));
    add(box(1.78, 0.16, 0.18, darkMat, 0, 0.32, -1.82));
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff6df, emissive: 0xffe7b0, emissiveIntensity: isDriver ? 1.4 : 0.15, roughness: 0.25 });
    const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff0000, emissiveIntensity: isDriver ? 0.9 : 0.25, roughness: 0.35 });
    [-0.55, 0.55].forEach((x) => {
      add(box(0.36, 0.12, 0.08, lampMat, x, 0.52, 1.9));
      add(box(0.4, 0.1, 0.06, tailMat, x, 0.55, -1.9));
    });
    const wheels = [];
    [[-0.82, 0.34, 1.15], [0.82, 0.34, 1.15], [-0.82, 0.34, -1.15], [0.82, 0.34, -1.15]].forEach(([x, y, z]) => {
      const wheel = new THREE.Group();
      const tire = new THREE.Mesh(shared.tireGeo, shared.rubber);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      const hub = new THREE.Mesh(shared.hubGeo, chromeMat);
      hub.rotation.z = Math.PI / 2;
      wheel.add(tire, hub);
      wheel.position.set(x, y, z);
      group.add(wheel);
      wheels.push(wheel);
    });
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.15, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.025;
    group.add(shadow);
    group.userData.wheels = wheels;
    return group;
  }

  const parkedColors = [0x243044, 0x3a3a3a, 0x6b2a2a, 0x1e3a32, 0x3d3424, 0x2a3144, 0x4a3a28];
  let colorCursor = 0;
  const stallLights = [];
  for (let i = 0; i < STALLS; i += 1) {
    const x = stallX(i);
    for (const side of [-1, 1]) {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.02, 4.4),
        new THREE.MeshStandardMaterial({ color: 0xe7e7e7, roughness: 0.6 })
      );
      line.position.set(x + side * (PITCH / 2), 0.02, 0.7);
      scene.add(line);
    }
    const light = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.55, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x12a15c, emissive: 0x12a15c, emissiveIntensity: 0.7 })
    );
    light.position.set(x, 0.9, -1.55);
    scene.add(light);
    stallLights.push(light);
    const label = stallLabel('A' + (i + 1), i === TARGET ? '#b7f0cf' : '#e7e7e7');
    label.position.set(x, 0.04, 2.35);
    scene.add(label);
    if (i !== TARGET) {
      const parked = makeCar(parkedColors[colorCursor % parkedColors.length], false);
      colorCursor += 1;
      parked.position.set(x, 0, 0.55);
      parked.rotation.y = Math.PI;
      scene.add(parked);
      light.material.color.setHex(0x8d2b2b);
      light.material.emissive.setHex(0x8d2b2b);
    } else {
      const pad = new THREE.Mesh(
        new THREE.PlaneGeometry(2.15, 4.1),
        new THREE.MeshStandardMaterial({ color: 0x143d28, roughness: 0.8, emissive: 0x0c3a22, emissiveIntensity: 0.35 })
      );
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(x, 0.03, 0.7);
      scene.add(pad);
      light.userData.pad = pad;
    }
  }

  const driver = makeCar(0xf4f4f4, true);
  scene.add(driver);

  const look = new THREE.Vector3();
  const params = new URLSearchParams(window.location.search);
  const startAt = Number(params.get('at'));
  let t = reduced ? DURATION : (Number.isFinite(startAt) ? Math.min(Math.max(startAt, 0), DURATION) : 0);
  let playing = !reduced && params.get('play') !== '0';
  let last = performance.now();
  let shownBeat = -1;
  let onScreen = true;
  let pageVisible = true;

  function showEndCopy() {
    title.textContent = BEATS[3].title;
    caption.textContent = BEATS[3].caption;
    openEl.textContent = '17';
    statusEl.textContent = 'You parked. The camera marked A4 taken.';
    systemEl.hidden = false;
    systemText.textContent = 'Stall A4 filled · 17 open';
    phone.classList.add('is-up');
    stallEls[TARGET].classList.remove('is-open');
    stallEls[TARGET].classList.add('is-taken');
  }

  function apply(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (playing && onScreen && pageVisible && t < DURATION) t += dt;
    if (t >= DURATION) {
      t = DURATION;
      playing = false;
    }

    const pose = samplePath(t);
    driver.position.set(pose.x, 0, pose.z);
    driver.rotation.y = pose.yaw;
    const spin = pose.speed * dt * 3.2;
    driver.userData.wheels.forEach((wheel) => {
      wheel.rotation.x += spin;
    });

    const fill = fillAmount(t);
    const marker = stallLights[TARGET];
    const openColor = new THREE.Color(0x12a15c);
    const takenColor = new THREE.Color(0xc62828);
    marker.material.color.copy(openColor).lerp(takenColor, fill);
    marker.material.emissive.copy(marker.material.color);
    if (marker.userData.pad) {
      marker.userData.pad.material.color.setHex(fill > 0.45 ? 0x3d1515 : 0x143d28);
      marker.userData.pad.material.emissive.setHex(fill > 0.45 ? 0x3a1010 : 0x0c3a22);
    }

    const forward = new THREE.Vector3(Math.sin(pose.yaw), 0, Math.cos(pose.yaw));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    const eye = new THREE.Vector3(pose.x, 1.28, pose.z)
      .add(right.clone().multiplyScalar(0.28))
      .add(forward.clone().multiplyScalar(0.05));
    const povLook = eye.clone().add(forward.clone().multiplyScalar(8)).add(new THREE.Vector3(0, -0.42, 0));
    const crane = new THREE.Vector3(pose.x + 6.2, 5.4, pose.z + 6.4);
    const craneLook = new THREE.Vector3(pose.x, 0.6, pose.z);
    const craneMix = smootherstep(fill);
    camera.position.lerpVectors(eye, crane, craneMix);
    look.lerpVectors(povLook, craneLook, craneMix);
    camera.lookAt(look);

    const beat = beatIndex(t);
    if (beat !== shownBeat) {
      shownBeat = beat;
      title.textContent = BEATS[beat].title;
      caption.textContent = BEATS[beat].caption;
      document.querySelectorAll('.demo-beat').forEach((button, index) => {
        button.classList.toggle('is-current', index === beat);
        button.setAttribute('aria-current', index === beat ? 'step' : 'false');
      });
    }

    const phoneUp = t >= 6;
    const docked = t >= 11.5 && t < 19;
    phone.classList.toggle('is-up', phoneUp && !docked);
    phone.classList.toggle('is-docked', docked);
    const filled = fill > 0.55;
    openEl.textContent = filled ? '17' : '18';
    statusEl.textContent = filled
      ? 'You parked. The camera marked A4 taken.'
      : 'A4 is open. Park here.';
    stallEls[TARGET].classList.toggle('is-open', !filled);
    stallEls[TARGET].classList.toggle('is-taken', filled);
    systemEl.hidden = fill < 0.2;
    systemText.textContent = filled ? 'Stall A4 filled · 17 open' : 'Watching stall A4';
    speedEl.textContent = Math.max(0, Math.round(pose.speed * 2.2)) + ' mph';
    const clearHood = craneMix > 0.35;
    hood.classList.toggle('is-clear', clearHood);
    pillars.forEach((pillar) => pillar.classList.toggle('is-clear', clearHood));
    playBtn.textContent = playing ? 'Pause' : (t >= DURATION ? 'Replay' : 'Play');
    playBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    if (bar) bar.style.transform = 'scaleX(' + (t / DURATION) + ')';

    renderer.render(scene, camera);
  }

  function seek(next, autoplay) {
    t = Math.min(Math.max(next, 0), DURATION);
    shownBeat = -1;
    playing = autoplay && t < DURATION;
    last = performance.now();
  }

  playBtn.addEventListener('click', () => {
    if (t >= DURATION) seek(0, true);
    else playing = !playing;
  });
  document.getElementById('demo-replay').addEventListener('click', () => seek(0, true));
  document.querySelectorAll('.demo-beat').forEach((button) => {
    button.addEventListener('click', () => {
      seek(Number(button.dataset.at), true);
    });
  });

  window.addEventListener('keydown', (event) => {
    const tag = event.target && event.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (event.key === ' ' || event.key === 'k') {
      event.preventDefault();
      playBtn.click();
    } else if (event.key === 'r' || event.key === 'R') {
      seek(0, true);
    }
  });

  function resize() {
    const width = root.clientWidth || window.innerWidth;
    const height = root.clientHeight || window.innerHeight;
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  resize();
  window.addEventListener('resize', resize);

  const observer = new IntersectionObserver((entries) => {
    onScreen = entries.some((entry) => entry.isIntersecting);
  }, { threshold: 0.05 });
  observer.observe(root);
  document.addEventListener('visibilitychange', () => {
    last = performance.now();
    pageVisible = !document.hidden;
  });

  if (reduced) showEndCopy();
  resize();
  apply(performance.now());
  renderer.setAnimationLoop(apply);
}

const demoHost = document.getElementById('demo-canvas');
if (demoHost) boot(demoHost);
