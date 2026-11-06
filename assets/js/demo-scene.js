/**
 * Playable UTEP campus. Roads, buildings, and parking outlines are real
 * coordinates at 1 meter = 1 meter. Drive to stall A4 and the lot marks it filled.
 * Portal demonstration, not a live camera and not a released app.
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

const M_PER_LAT = 110540;
const root = document.getElementById('demo-canvas');

function inside(x, z, pts) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const xi = pts[i][0];
    const zi = pts[i][1];
    const xj = pts[j][0];
    const zj = pts[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

function stallsFor(pts, limit) {
  let best = 0;
  let ang = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > best) {
      best = len;
      ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    }
  }
  const c = Math.cos(-ang);
  const s = Math.sin(-ang);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  pts.forEach(([x, z]) => {
    const lx = x * c - z * s;
    const lz = x * s + z * c;
    minX = Math.min(minX, lx);
    maxX = Math.max(maxX, lx);
    minZ = Math.min(minZ, lz);
    maxZ = Math.max(maxZ, lz);
  });
  const stalls = [];
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  for (let lz = minZ + 3.1; lz < maxZ - 3.1 && stalls.length < limit; lz += 7.4) {
    for (let lx = minX + 1.7; lx < maxX - 1.7 && stalls.length < limit; lx += 2.75) {
      const x = lx * cos - lz * sin;
      const z = lx * sin + lz * cos;
      if (inside(x, z, pts)) stalls.push({ x, z, yaw: ang });
    }
  }
  if (!stalls.length && pts.length) {
    const x = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
    const z = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
    stalls.push({ x, z, yaw: ang });
  }
  return stalls;
}

function shapeFrom(pts) {
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], -pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) shape.lineTo(pts[i][0], -pts[i][1]);
  shape.closePath();
  return shape;
}

function extrude(pts, height) {
  const geo = new THREE.ExtrudeGeometry(shapeFrom(pts), { depth: height, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function ribbon(roads) {
  const positions = [];
  const normals = [];
  const indices = [];
  roads.forEach((road) => {
    const half = road.w / 2;
    const pts = road.p;
    for (let i = 0; i < pts.length - 1; i += 1) {
      const ax = pts[i][0];
      const az = pts[i][1];
      const bx = pts[i + 1][0];
      const bz = pts[i + 1][1];
      let dx = bx - ax;
      let dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 0.35) continue;
      dx /= len;
      dz /= len;
      const px = -dz * half;
      const pz = dx * half;
      const y = 0.05;
      const base = positions.length / 3;
      positions.push(ax + px, y, az + pz, ax - px, y, az - pz, bx + px, y, bz + pz, bx - px, y, bz - pz);
      for (let n = 0; n < 4; n += 1) normals.push(0, 1, 0);
      indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  return geo;
}

function makeCar() {
  const car = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0xff8200, roughness: 0.35, metalness: 0.45 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.45, metalness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9ec4d8, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.55 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.55, 4.4), paint);
  body.position.y = 0.62;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.48, 2.1), glass);
  cabin.position.set(0, 1.05, -0.25);
  car.add(body, cabin);
  const tire = new THREE.CylinderGeometry(0.34, 0.34, 0.22, 16);
  tire.rotateZ(Math.PI / 2);
  [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]].forEach(([x, z]) => {
    const wheel = new THREE.Mesh(tire, dark);
    wheel.position.set(x, 0.34, z);
    car.add(wheel);
  });
  return car;
}

function labelSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(12,14,19,0.72)';
  ctx.fillRect(0, 24, 512, 80);
  ctx.fillStyle = '#f4f4f4';
  ctx.font = '600 42px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(28, 7, 1);
  return sprite;
}

function boot(campus) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const phone = document.getElementById('demo-phone');
  const title = document.getElementById('demo-title');
  const caption = document.getElementById('demo-caption');
  const openEl = document.getElementById('demo-open');
  const capacityEl = document.getElementById('demo-capacity');
  const lotEl = document.getElementById('demo-lot');
  const statusEl = document.getElementById('demo-status');
  const systemEl = document.getElementById('demo-system');
  const systemText = document.getElementById('demo-system-text');
  const speedEl = document.getElementById('demo-speed');
  const hood = document.querySelector('.demo-hood');
  const pillars = document.querySelectorAll('.demo-pillar');
  const stallGrid = document.getElementById('demo-stalls');
  const mapCanvas = document.getElementById('demo-map');
  const mapsLink = document.getElementById('demo-maps');
  const viewBtn = document.getElementById('demo-view');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (err) {
    console.warn('Damn Parking campus demo unavailable:', err);
    root.innerHTML = '<p class="demo-fallback">This browser cannot start the 3D demo. The story is listed under the player.</p>';
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.setClearColor(0xcfe6f4, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  root.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc5dff2);
  scene.fog = new THREE.Fog(0xd7c4ae, 240, 1200);
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 4000);
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x8a7a68, 1.15));
  const sun = new THREE.DirectionalLight(0xfff1d6, 1.35);
  sun.position.set(-180, 320, 90);
  scene.add(sun);

  const bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  function grow(x, z) {
    bounds.minX = Math.min(bounds.minX, x);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.minZ = Math.min(bounds.minZ, z);
    bounds.maxZ = Math.max(bounds.maxZ, z);
  }
  campus.buildings.forEach((b) => b.p.forEach(([x, z]) => grow(x, z)));

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(bounds.maxX - bounds.minX + 240, bounds.maxZ - bounds.minZ + 240),
    new THREE.MeshLambertMaterial({ color: 0xc6ad86 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2);
  scene.add(ground);

  scene.add(new THREE.Mesh(ribbon(campus.roads), new THREE.MeshLambertMaterial({ color: 0x2b3036 })));

  const wallMat = new THREE.MeshLambertMaterial({ color: 0xf4efe6 });
  const tallMat = new THREE.MeshLambertMaterial({ color: 0x22304a });
  campus.buildings.forEach((building) => {
    try {
      const mesh = new THREE.Mesh(extrude(building.p, building.h), building.h >= 24 ? tallMat : wallMat);
      scene.add(mesh);
    } catch (err) {
      console.warn('Skipped a building outline', err);
    }
  });

  const asphalt = new THREE.MeshLambertMaterial({ color: 0x2a2e34 });
  const deckMat = new THREE.MeshLambertMaterial({ color: 0x343942 });
  const columnMat = new THREE.MeshLambertMaterial({ color: 0xc8c2b8 });
  const buildingBoxes = campus.buildings.map((building) => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    building.p.forEach(([x, z]) => {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    });
    return { pts: building.p, minX, maxX, minZ, maxZ };
  });

  const lots = campus.lots.map((lot) => {
    try {
      const pad = new THREE.Mesh(extrude(lot.p, 0.04), asphalt);
      pad.position.y = 0.03;
      scene.add(pad);
    } catch (err) {
      console.warn('Skipped a lot outline', err);
    }
    if (lot.kind === 'garage') {
      try {
        const deck = new THREE.Mesh(extrude(lot.p, 0.4), deckMat);
        deck.position.y = 3.5;
        scene.add(deck);
        const c = lot.c;
        [[-8, -8], [8, -8], [-8, 8], [8, 8]].forEach(([dx, dz]) => {
          const column = new THREE.Mesh(new THREE.BoxGeometry(0.45, 3.5, 0.45), columnMat);
          column.position.set(c[0] + dx, 1.75, c[1] + dz);
          scene.add(column);
        });
      } catch (err) {
        console.warn('Skipped a garage deck', err);
      }
    }
    const named = lot.name && lot.name !== 'Parking';
    const stalls = named ? stallsFor(lot.p, lot.kind === 'garage' ? 16 : 12) : [];
    if (named) {
      const sprite = labelSprite(lot.name);
      sprite.position.set(lot.c[0], lot.kind === 'garage' ? 9 : 4.5, lot.c[1]);
      scene.add(sprite);
    }
    return {
      name: lot.name,
      kind: lot.kind,
      sampleId: lot.sampleId,
      capacity: lot.capacity,
      open: lot.open,
      baseOpen: lot.open,
      pts: lot.p,
      stalls,
    };
  });

  const heroLot = lots.find((lot) => lot.sampleId === 'SBG') || lots.find((lot) => /sun bowl parking garage/i.test(lot.name));
  let hero = null;
  const stallRecords = [];
  lots.forEach((lot) => {
    lot.stalls.forEach((stall, index) => {
      const record = {
        lot,
        x: stall.x,
        z: stall.z,
        yaw: stall.yaw,
        code: 'A' + ((index % 8) + 1),
        open: index % 3 !== 0,
      };
      if (lot === heroLot && (hero === null || stall.z < hero.z)) {
        record.code = 'A4';
        record.open = true;
        hero = record;
      }
      stallRecords.push(record);
    });
  });
  if (hero) hero.open = true;
  stallRecords.forEach((stall) => {
    if (stall !== hero && stall.lot === heroLot && stall.code === 'A4') stall.code = 'A5';
  });

  const stallMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(2.2, 0.08, 4.7),
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
    Math.max(1, stallRecords.length)
  );
  const dummy = new THREE.Object3D();
  const openColor = new THREE.Color(0x1f8a4c);
  const takenColor = new THREE.Color(0x7a3030);
  const heroColor = new THREE.Color(0x39e07a);
  function paintStalls() {
    stallRecords.forEach((stall, index) => {
      dummy.position.set(stall.x, 0.12, stall.z);
      dummy.rotation.set(0, -stall.yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      stallMesh.setMatrixAt(index, dummy.matrix);
      stallMesh.setColorAt(index, stall === hero && stall.open ? heroColor : stall.open ? openColor : takenColor);
    });
    stallMesh.instanceMatrix.needsUpdate = true;
    if (stallMesh.instanceColor) stallMesh.instanceColor.needsUpdate = true;
  }
  paintStalls();
  scene.add(stallMesh);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.45, 14, 12),
    new THREE.MeshBasicMaterial({ color: 0x39e07a, transparent: true, opacity: 0.85 })
  );
  if (hero) beam.position.set(hero.x, 7.2, hero.z);
  scene.add(beam);

  const parked = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.7, 0.7, 3.8),
    new THREE.MeshLambertMaterial({ color: 0xd9dde3 }),
    Math.max(1, stallRecords.filter((stall) => !stall.open).length)
  );
  let parkedIndex = 0;
  stallRecords.forEach((stall) => {
    if (stall.open) return;
    dummy.position.set(stall.x, 0.55, stall.z);
    dummy.rotation.set(0, -stall.yaw, 0);
    dummy.updateMatrix();
    parked.setMatrixAt(parkedIndex, dummy.matrix);
    parkedIndex += 1;
  });
  parked.count = parkedIndex;
  parked.instanceMatrix.needsUpdate = true;
  scene.add(parked);

  campus.streets.forEach((street) => {
    if (!/schuster|mesa|oregon|glory|hawthorne|university|rim|sun bowl/i.test(street.name)) return;
    const sprite = labelSprite(street.name);
    sprite.scale.set(36, 9, 1);
    sprite.position.set(street.x, 6, street.z);
    scene.add(sprite);
  });

  const car = makeCar();
  scene.add(car);
  const driver = {
    x: campus.spawn.x,
    z: campus.spawn.z,
    yaw: campus.spawn.yaw,
    speed: 0,
  };
  const keys = new Set();
  let overhead = false;
  let filled = false;

  function latLon(x, z) {
    const lat = campus.origin.lat + z / M_PER_LAT;
    const lon = campus.origin.lon + x / (111320 * Math.cos((campus.origin.lat * Math.PI) / 180));
    return { lat, lon };
  }

  function blocked(x, z) {
    if (heroLot && inside(x, z, heroLot.pts)) return false;
    for (let i = 0; i < buildingBoxes.length; i += 1) {
      const box = buildingBoxes[i];
      if (x < box.minX || x > box.maxX || z < box.minZ || z > box.maxZ) continue;
      if (inside(x, z, box.pts)) return true;
    }
    return false;
  }

  function paintPhone() {
    const lot = hero ? hero.lot : heroLot;
    if (!lot) return;
    lotEl.textContent = lot.name;
    openEl.textContent = String(lot.open);
    capacityEl.textContent = String(lot.capacity);
    stallGrid.innerHTML = '';
    for (let i = 0; i < 8; i += 1) {
      const code = 'A' + (i + 1);
      const cell = document.createElement('div');
      const isHero = hero && code === hero.code;
      const open = isHero ? hero.open : false;
      cell.className = 'demo-stall' + (open ? ' is-open' : ' is-taken') + (isHero ? ' is-target' : '');
      cell.textContent = code;
      stallGrid.appendChild(cell);
    }
    if (hero && hero.open) {
      statusEl.textContent = 'Stall A4 is open. Park here.';
      title.textContent = 'Drive to stall A4';
      const dist = Math.hypot(driver.x - hero.x, driver.z - hero.z);
      caption.textContent = lot.name + ' is holding stall A4. ' + Math.round(dist) + ' meters ahead.';
    } else {
      statusEl.textContent = 'Stall A4 is filled.';
      title.textContent = 'Spot filled';
      caption.textContent = 'The lot camera marked stall A4 taken. Open stalls dropped by one.';
    }
  }

  function markFilled() {
    if (!hero || !hero.open) return;
    hero.open = false;
    hero.lot.open = Math.max(0, hero.lot.open - 1);
    filled = true;
    paintStalls();
    beam.visible = false;
    systemEl.hidden = false;
    systemText.textContent = 'Stall A4 filled · ' + hero.lot.open + ' open';
    paintPhone();
  }

  function placeCar(x, z, yaw) {
    driver.x = x;
    driver.z = z;
    driver.yaw = yaw;
    driver.speed = 0;
    car.position.set(x, 0, z);
    car.rotation.y = yaw;
  }

  function reset() {
    if (hero) {
      hero.open = true;
      hero.lot.open = hero.lot.baseOpen;
    }
    filled = false;
    beam.visible = true;
    systemEl.hidden = true;
    overhead = false;
    viewBtn.setAttribute('aria-pressed', 'false');
    viewBtn.textContent = 'Overhead';
    const startZ = hero ? hero.z - 18 : campus.spawn.z;
    const startX = hero ? hero.x : campus.spawn.x;
    placeCar(startX, startZ, 0);
    paintStalls();
    paintPhone();
  }

  function goToStall() {
    if (!hero) return;
    const yaw = hero.yaw + Math.PI / 2;
    placeCar(hero.x - Math.sin(yaw) * 1.2, hero.z - Math.cos(yaw) * 1.2, yaw);
    markFilled();
  }

  const mapCtx = mapCanvas.getContext('2d');
  const staticMap = document.createElement('canvas');
  staticMap.width = mapCanvas.width;
  staticMap.height = mapCanvas.height;
  const sctx = staticMap.getContext('2d');
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ);
  function mapPoint(x, z) {
    const u = (x - bounds.minX) / span;
    const v = (bounds.maxZ - z) / span;
    return [12 + u * (staticMap.width - 24), 12 + v * (staticMap.height - 24)];
  }
  sctx.fillStyle = '#d2c0a4';
  sctx.fillRect(0, 0, staticMap.width, staticMap.height);
  sctx.strokeStyle = '#3c4148';
  sctx.lineWidth = 1;
  campus.roads.forEach((road) => {
    if (road.w < 7) return;
    sctx.beginPath();
    road.p.forEach((pt, index) => {
      const [mx, my] = mapPoint(pt[0], pt[1]);
      if (index === 0) sctx.moveTo(mx, my);
      else sctx.lineTo(mx, my);
    });
    sctx.stroke();
  });
  sctx.fillStyle = 'rgba(31,138,76,0.55)';
  campus.lots.forEach((lot) => {
    if (!lot.name || lot.name === 'Parking') return;
    sctx.beginPath();
    lot.p.forEach((pt, index) => {
      const [mx, my] = mapPoint(pt[0], pt[1]);
      if (index === 0) sctx.moveTo(mx, my);
      else sctx.lineTo(mx, my);
    });
    sctx.closePath();
    sctx.fill();
  });

  function drawMap() {
    mapCtx.drawImage(staticMap, 0, 0);
    const [mx, my] = mapPoint(driver.x, driver.z);
    mapCtx.fillStyle = '#ff8200';
    mapCtx.beginPath();
    mapCtx.arc(mx, my, 5, 0, Math.PI * 2);
    mapCtx.fill();
    if (hero && hero.open) {
      const [hx, hy] = mapPoint(hero.x, hero.z);
      mapCtx.fillStyle = '#39e07a';
      mapCtx.fillRect(hx - 3, hy - 3, 6, 6);
    }
  }

  function pressed(name) {
    return keys.has(name);
  }

  document.querySelectorAll('.demo-pad button').forEach((button) => {
    const name = button.getAttribute('data-drive');
    const down = (event) => {
      event.preventDefault();
      keys.add(name);
    };
    const up = () => keys.delete(name);
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointerleave', up);
    button.addEventListener('pointercancel', up);
  });
  window.addEventListener('keydown', (event) => {
    const map = { ArrowUp: 'forward', KeyW: 'forward', ArrowDown: 'back', KeyS: 'back', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
    if (map[event.code]) {
      event.preventDefault();
      keys.add(map[event.code]);
    } else if (event.code === 'KeyR') reset();
    else if (event.code === 'KeyV') viewBtn.click();
  });
  window.addEventListener('keyup', (event) => {
    const map = { ArrowUp: 'forward', KeyW: 'forward', ArrowDown: 'back', KeyS: 'back', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
    if (map[event.code]) keys.delete(map[event.code]);
  });
  document.getElementById('demo-reset').addEventListener('click', reset);
  viewBtn.addEventListener('click', () => {
    overhead = !overhead;
    viewBtn.setAttribute('aria-pressed', overhead ? 'true' : 'false');
    viewBtn.textContent = overhead ? 'Driver' : 'Overhead';
    hood.classList.toggle('is-clear', overhead);
    pillars.forEach((pillar) => pillar.classList.toggle('is-clear', overhead));
  });
  document.getElementById('demo-phone-btn').addEventListener('click', () => {
    phone.classList.toggle('is-up');
    phone.classList.toggle('is-docked');
  });
  document.getElementById('demo-fill').addEventListener('click', () => {
    overhead = true;
    viewBtn.setAttribute('aria-pressed', 'true');
    viewBtn.textContent = 'Driver';
    hood.classList.add('is-clear');
    pillars.forEach((pillar) => pillar.classList.add('is-clear'));
    goToStall();
  });

  function resize() {
    const width = root.clientWidth || window.innerWidth;
    const height = root.clientHeight || window.innerHeight;
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  window.addEventListener('resize', resize);
  resize();

  reset();
  if (reduced && hero) {
    overhead = true;
    hood.classList.add('is-clear');
    pillars.forEach((pillar) => pillar.classList.add('is-clear'));
    goToStall();
  }

  let last = performance.now();
  let mapTimer = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!reduced) {
      const drive = (pressed('forward') ? 1 : 0) - (pressed('back') ? 1 : 0);
      const steer = (pressed('left') ? 1 : 0) - (pressed('right') ? 1 : 0);
      const accel = drive > 0 ? 9 : drive < 0 ? -7 : 0;
      driver.speed += accel * dt;
      driver.speed *= Math.pow(0.45, dt);
      if (drive === 0) driver.speed *= Math.pow(0.02, dt);
      driver.speed = Math.max(-5, Math.min(13, driver.speed));
      const steerRate = 1.7 / (1 + Math.abs(driver.speed) * 0.08);
      driver.yaw += steer * steerRate * dt * (driver.speed >= 0 ? 1 : -1);
      const nx = driver.x + Math.sin(driver.yaw) * driver.speed * dt;
      const nz = driver.z + Math.cos(driver.yaw) * driver.speed * dt;
      if (!blocked(nx, nz)) {
        driver.x = nx;
        driver.z = nz;
      } else {
        driver.speed *= 0.2;
      }
      car.position.set(driver.x, 0, driver.z);
      car.rotation.y = driver.yaw;
      if (hero && hero.open && Math.hypot(driver.x - hero.x, driver.z - hero.z) < 2.2) {
        driver.speed = 0;
        driver.x = hero.x;
        driver.z = hero.z;
        car.position.set(driver.x, 0, driver.z);
        markFilled();
      }
    }
    const look = overhead ? 220 : 1.45;
    const back = overhead ? 0.2 : 6.2;
    camera.position.set(
      driver.x - Math.sin(driver.yaw) * back,
      look,
      driver.z - Math.cos(driver.yaw) * back + (overhead ? 0.2 : 0)
    );
    camera.lookAt(driver.x + Math.sin(driver.yaw) * (overhead ? 0 : 12), overhead ? 0 : 1.1, driver.z + Math.cos(driver.yaw) * (overhead ? 0 : 12));
    const mph = Math.abs(driver.speed) * 2.237;
    speedEl.textContent = Math.round(mph) + ' mph';
    mapTimer += dt;
    if (mapTimer > 0.12) {
      mapTimer = 0;
      drawMap();
      const spot = latLon(driver.x, driver.z);
      mapsLink.href = 'https://www.google.com/maps/@' + spot.lat.toFixed(6) + ',' + spot.lon.toFixed(6) + ',18z';
      if (hero && hero.open) {
        const dist = Math.hypot(driver.x - hero.x, driver.z - hero.z);
        caption.textContent = hero.lot.name + ' is holding stall A4. ' + Math.round(dist) + ' meters ahead.';
      }
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  drawMap();
  requestAnimationFrame(frame);
}

fetch('/assets/data/utep-campus.json')
  .then((response) => {
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  })
  .then((campus) => boot(campus))
  .catch((err) => {
    console.warn('UTEP campus map did not load', err);
    root.innerHTML = '<p class="demo-fallback">The campus map did not load. The story is listed under the player.</p>';
  });
