/**
 * Damn Parking — cinematic 3D parking lot
 * Camera-vision aesthetic: stalls, cars arriving/leaving, CV frustum cones
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

const canvasHost = document.getElementById('parking-canvas');
if (!canvasHost) {
  // Not on home page
} else {
  bootScene(canvasHost);
}

function bootScene(host) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0c0e12, 0.028);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
  camera.position.set(14, 11, 16);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0c0e12, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  // Lights
  scene.add(new THREE.AmbientLight(0x3a4258, 0.55));
  const sodium = new THREE.PointLight(0xf0a020, 80, 40, 2);
  sodium.position.set(0, 8, 0);
  scene.add(sodium);
  const fill = new THREE.DirectionalLight(0x3de0c8, 0.35);
  fill.position.set(-8, 12, -4);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xf5c76a, 0.4);
  rim.position.set(10, 6, 8);
  scene.add(rim);

  // Ground asphalt
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(48, 36),
    new THREE.MeshStandardMaterial({ color: 0x1a1e28, roughness: 0.92, metalness: 0.05 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Subtle asphalt grain via second plane
  const grain = new THREE.Mesh(
    new THREE.PlaneGeometry(48, 36),
    new THREE.MeshBasicMaterial({
      color: 0x0c0e12,
      transparent: true,
      opacity: 0.25,
      wireframe: false,
    })
  );
  grain.rotation.x = -Math.PI / 2;
  grain.position.y = 0.01;
  scene.add(grain);

  const lotGroup = new THREE.Group();
  scene.add(lotGroup);

  // Stall layout: 2 rows × 8 stalls
  const ROWS = 2;
  const COLS = 8;
  const stallW = 2.2;
  const stallD = 4.4;
  const rowGap = 3.2;
  const stalls = [];

  const lineMat = new THREE.MeshBasicMaterial({ color: 0xe8e4d8 });
  const openGlowMat = new THREE.MeshBasicMaterial({
    color: 0x3de0c8,
    transparent: true,
    opacity: 0.22,
  });
  const occGlowMat = new THREE.MeshBasicMaterial({
    color: 0xe85d4c,
    transparent: true,
    opacity: 0.12,
  });

  function makeStall(ix, iy) {
    const g = new THREE.Group();
    const x = (ix - (COLS - 1) / 2) * stallW;
    const z = (iy - (ROWS - 1) / 2) * (stallD + rowGap);

    // Paint lines (U shape)
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, stallD), lineMat);
    left.position.set(-stallW / 2 + 0.1, 0.02, 0);
    const right = left.clone();
    right.position.x = stallW / 2 - 0.1;
    const back = new THREE.Mesh(new THREE.BoxGeometry(stallW - 0.1, 0.03, 0.08), lineMat);
    back.position.set(0, 0.02, -stallD / 2 + 0.1);
    g.add(left, right, back);

    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(stallW - 0.35, stallD - 0.35),
      openGlowMat.clone()
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.03;
    g.add(glow);

    g.position.set(x, 0, z);
    lotGroup.add(g);

    return {
      group: g,
      glow,
      ix,
      iy,
      occupied: Math.random() > 0.45,
      car: null,
      targetOcc: null,
    };
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      stalls.push(makeStall(c, r));
    }
  }

  // Center drive aisle paint
  const aisle = new THREE.Mesh(
    new THREE.BoxGeometry(COLS * stallW + 1, 0.02, 0.35),
    new THREE.MeshBasicMaterial({ color: 0xf0a020, transparent: true, opacity: 0.55 })
  );
  aisle.position.set(0, 0.025, 0);
  lotGroup.add(aisle);

  // Dashed center dashes along aisle
  for (let i = -6; i <= 6; i++) {
    const dash = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.03, 0.12),
      new THREE.MeshBasicMaterial({ color: 0xe8e4d8 })
    );
    dash.position.set(i * 1.4, 0.04, 0);
    lotGroup.add(dash);
  }

  function makeCar(colorHex) {
    const car = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, 0.45, 3.2),
      new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.35, metalness: 0.55 })
    );
    body.position.y = 0.45;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 0.4, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x1a2030, roughness: 0.2, metalness: 0.7 })
    );
    cabin.position.set(0, 0.82, -0.15);
    const lightL = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.12, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xffe6a0 })
    );
    lightL.position.set(-0.45, 0.4, 1.62);
    const lightR = lightL.clone();
    lightR.position.x = 0.45;
    const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.22, 12);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const positions = [
      [-0.75, 0.28, 0.95],
      [0.75, 0.28, 0.95],
      [-0.75, 0.28, -0.95],
      [0.75, 0.28, -0.95],
    ];
    positions.forEach(([wx, wy, wz]) => {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, wy, wz);
      car.add(w);
    });
    car.add(body, cabin, lightL, lightR);
    return car;
  }

  const carColors = [0x2a3348, 0xc45c3e, 0xe8e4d8, 0x3a6b8c, 0xf0a020, 0x4a5568];

  stalls.forEach((s, i) => {
    if (s.occupied) {
      const car = makeCar(carColors[i % carColors.length]);
      car.position.set(0, 0, 0);
      car.rotation.y = s.iy === 0 ? 0 : Math.PI;
      s.group.add(car);
      s.car = car;
      s.glow.material = occGlowMat.clone();
    } else {
      s.glow.material = openGlowMat.clone();
    }
  });

  // Camera poles + CV frustums
  const camPoles = [
    { x: -10, z: -8, lookAt: new THREE.Vector3(-4, 0, -4) },
    { x: 10, z: 8, lookAt: new THREE.Vector3(4, 0, 4) },
    { x: -10, z: 8, lookAt: new THREE.Vector3(-3, 0, 3) },
  ];

  const frustumMat = new THREE.MeshBasicMaterial({
    color: 0x3de0c8,
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const frustumEdgeMat = new THREE.LineBasicMaterial({
    color: 0x3de0c8,
    transparent: true,
    opacity: 0.45,
  });

  camPoles.forEach((p) => {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, 5.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x2a303c, metalness: 0.6, roughness: 0.4 })
    );
    pole.position.set(p.x, 2.75, p.z);
    scene.add(pole);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.3, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x1a1e28, metalness: 0.7, roughness: 0.3 })
    );
    head.position.set(p.x, 5.5, p.z);
    head.lookAt(p.lookAt.x, 1, p.lookAt.z);
    scene.add(head);

    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x3de0c8 })
    );
    led.position.copy(head.position);
    led.position.y -= 0.05;
    scene.add(led);

    // Simple pyramid frustum toward lot
    const tip = new THREE.Vector3(p.x, 5.4, p.z);
    const target = p.lookAt.clone();
    target.y = 0.05;
    const dir = target.clone().sub(tip).normalize();
    const dist = 9;
    const end = tip.clone().add(dir.multiplyScalar(dist));
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(dir, up).normalize();
    const realUp = new THREE.Vector3().crossVectors(right, dir).normalize();
    const spread = 2.8;
    const corners = [
      end.clone().add(right.clone().multiplyScalar(spread)).add(realUp.clone().multiplyScalar(spread * 0.55)),
      end.clone().add(right.clone().multiplyScalar(-spread)).add(realUp.clone().multiplyScalar(spread * 0.55)),
      end.clone().add(right.clone().multiplyScalar(-spread)).add(realUp.clone().multiplyScalar(-spread * 0.35)),
      end.clone().add(right.clone().multiplyScalar(spread)).add(realUp.clone().multiplyScalar(-spread * 0.35)),
    ];

    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array([
      tip.x, tip.y, tip.z, corners[0].x, corners[0].y, corners[0].z, corners[1].x, corners[1].y, corners[1].z,
      tip.x, tip.y, tip.z, corners[1].x, corners[1].y, corners[1].z, corners[2].x, corners[2].y, corners[2].z,
      tip.x, tip.y, tip.z, corners[2].x, corners[2].y, corners[2].z, corners[3].x, corners[3].y, corners[3].z,
      tip.x, tip.y, tip.z, corners[3].x, corners[3].y, corners[3].z, corners[0].x, corners[0].y, corners[0].z,
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    scene.add(new THREE.Mesh(geo, frustumMat));

    const edgePts = [tip, corners[0], tip, corners[1], tip, corners[2], tip, corners[3]];
    const edgeGeo = new THREE.BufferGeometry().setFromPoints(edgePts);
    scene.add(new THREE.LineSegments(edgeGeo, frustumEdgeMat));
  });

  // Floating occupancy markers (billboards simplified as sprites via canvas)
  function makeLabelTexture(text, color) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = 'rgba(12,14,18,0.75)';
    ctx.fillRect(8, 8, 240, 48);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 240, 48);
    ctx.font = '600 22px Manrope, sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }

  const statusSpriteMat = new THREE.SpriteMaterial({
    map: makeLabelTexture('CV TRACKING', '#3de0c8'),
    transparent: true,
    depthWrite: false,
  });
  const statusSprite = new THREE.Sprite(statusSpriteMat);
  statusSprite.scale.set(4.5, 1.1, 1);
  statusSprite.position.set(0, 6.5, 0);
  scene.add(statusSprite);

  // HUD DOM bindings
  const elOpen = document.getElementById('hud-open');
  const elOcc = document.getElementById('hud-occ');
  const elEvent = document.getElementById('hud-event');

  function syncHud(eventText) {
    const open = stalls.filter((s) => !s.occupied).length;
    const occ = stalls.length - open;
    if (elOpen) elOpen.textContent = String(open);
    if (elOcc) elOcc.textContent = String(occ);
    if (elEvent && eventText) elEvent.textContent = eventText;
  }
  syncHud('Scanning lot…');

  // Animation state machine for cars entering/leaving
  let anim = null;
  let nextEventAt = 2.5;
  const clock = new THREE.Clock();

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function startLeave(stall) {
    if (!stall.car) return;
    const car = stall.car;
    const startZ = 0;
    const endZ = stall.iy === 0 ? stallD + 2.5 : -(stallD + 2.5);
    anim = {
      type: 'leave',
      stall,
      car,
      t: 0,
      dur: 2.4,
      startZ,
      endZ,
    };
    syncHud(`Bay ${stall.ix + 1}${stall.iy ? 'B' : 'A'} freeing…`);
  }

  function startArrive(stall) {
    const car = makeCar(carColors[Math.floor(Math.random() * carColors.length)]);
    const startZ = stall.iy === 0 ? stallD + 3 : -(stallD + 3);
    car.position.z = startZ;
    car.rotation.y = stall.iy === 0 ? 0 : Math.PI;
    car.scale.setScalar(0.98);
    stall.group.add(car);
    stall.car = car;
    anim = {
      type: 'arrive',
      stall,
      car,
      t: 0,
      dur: 2.6,
      startZ,
      endZ: 0,
    };
    syncHud(`Vehicle → bay ${stall.ix + 1}${stall.iy ? 'B' : 'A'}`);
  }

  function pickEvent() {
    const occupied = stalls.filter((s) => s.occupied && s.car);
    const open = stalls.filter((s) => !s.occupied && !s.car);
    const roll = Math.random();
    if (roll < 0.55 && occupied.length) {
      startLeave(occupied[Math.floor(Math.random() * occupied.length)]);
    } else if (open.length) {
      startArrive(open[Math.floor(Math.random() * open.length)]);
    } else if (occupied.length) {
      startLeave(occupied[Math.floor(Math.random() * occupied.length)]);
    }
  }

  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  resize();
  window.addEventListener('resize', resize);

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let camAngle = 0.35;

  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    if (!reduced) {
      camAngle = 0.35 + Math.sin(t * 0.15) * 0.35;
      const radius = 20;
      camera.position.x = Math.cos(camAngle) * radius;
      camera.position.z = Math.sin(camAngle) * radius + 4;
      camera.position.y = 10 + Math.sin(t * 0.2) * 0.6;
      camera.lookAt(0, 0.5, 0);

      sodium.intensity = 70 + Math.sin(t * 1.5) * 8;
      statusSprite.material.opacity = 0.75 + Math.sin(t * 2) * 0.2;

      if (!anim && t > nextEventAt) {
        pickEvent();
      }

      if (anim) {
        anim.t += dt;
        const p = Math.min(anim.t / anim.dur, 1);
        const e = easeInOut(p);
        anim.car.position.z = anim.startZ + (anim.endZ - anim.startZ) * e;
        // slight bob
        anim.car.position.y = Math.sin(e * Math.PI) * 0.04;

        if (p >= 1) {
          if (anim.type === 'leave') {
            anim.stall.group.remove(anim.car);
            anim.stall.car = null;
            anim.stall.occupied = false;
            anim.stall.glow.material = openGlowMat.clone();
            syncHud('Spot open — routed');
          } else {
            anim.stall.occupied = true;
            anim.stall.glow.material = occGlowMat.clone();
            syncHud('Spot claimed');
          }
          anim = null;
          nextEventAt = t + 2.2 + Math.random() * 2.5;
        }
      }
    } else {
      camera.position.set(14, 11, 16);
      camera.lookAt(0, 0.5, 0);
    }

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
