/**
 * Damn Parking — premium cinematic parking lot
 * Soft shadows, PBR paints, smooth cinematic camera, eased vehicle motion
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

const canvasHost = document.getElementById('parking-canvas');
if (canvasHost) bootScene(canvasHost);

/**
 * RoomEnvironment from three/examples cannot be imported from a CDN without an
 * import map — it uses the bare specifier `from 'three'`, which browsers reject.
 * Build a compact studio capture locally so PBR paints still get reflections.
 */
function makeStudioEnvironment(renderer) {
  const envScene = new THREE.Scene();

  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(12, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x1c2230, side: THREE.BackSide })
  );
  envScene.add(shell);

  const warm = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe4c4 })
  );
  warm.position.set(5, 6, 4);
  warm.lookAt(0, 0, 0);
  envScene.add(warm);

  const cool = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 8),
    new THREE.MeshBasicMaterial({ color: 0x6f8cff })
  );
  cool.position.set(-6, 3.5, 1);
  cool.lookAt(0, 0, 0);
  envScene.add(cool);

  const overhead = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 8),
    new THREE.MeshBasicMaterial({ color: 0xdce6f5 })
  );
  overhead.position.set(0, 9, -1);
  overhead.rotation.x = Math.PI / 2;
  envScene.add(overhead);

  const key = new THREE.PointLight(0xfff4e0, 420, 0, 0);
  key.position.set(4, 8, 5);
  envScene.add(key);
  const fill = new THREE.PointLight(0x88aaff, 180, 0, 0);
  fill.position.set(-6, 3, -3);
  envScene.add(fill);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(envScene, 0.06).texture;
  pmrem.dispose();
  envScene.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });
  return tex;
}

function bootScene(host) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07080a);
  scene.fog = new THREE.Fog(0x07080a, 28, 58);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  const camTarget = new THREE.Vector3(0, 0.4, 0);
  const camState = { theta: 0.55, phi: 0.72, radius: 22 };
  const camGoal = { theta: 0.55, phi: 0.72, radius: 22 };

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x07080a, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);

  scene.environment = makeStudioEnvironment(renderer);

  // —— Lighting (soft studio + cool fill) ——
  scene.add(new THREE.HemisphereLight(0xb0c4de, 0x1a1510, 0.55));

  const key = new THREE.DirectionalLight(0xfff2dd, 2.1);
  key.position.set(8, 18, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 50;
  key.shadow.camera.left = -20;
  key.shadow.camera.right = 20;
  key.shadow.camera.top = 16;
  key.shadow.camera.bottom = -16;
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.03;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x8eb6ff, 0.55);
  fill.position.set(-12, 8, -6);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.35);
  rim.position.set(0, 6, -14);
  scene.add(rim);

  // Soft sodium pool over aisle
  const pool = new THREE.PointLight(0xffc98a, 18, 28, 2);
  pool.position.set(0, 7, 0);
  scene.add(pool);

  // —— Asphalt with canvas detail ——
  const asphaltTex = makeAsphaltTexture();
  asphaltTex.wrapS = asphaltTex.wrapT = THREE.RepeatWrapping;
  asphaltTex.repeat.set(4, 3);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(56, 40),
    new THREE.MeshStandardMaterial({
      map: asphaltTex,
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0.04,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Subtle reflective wet sheen strip
  const sheen = new THREE.Mesh(
    new THREE.PlaneGeometry(56, 40),
    new THREE.MeshStandardMaterial({
      color: 0x111318,
      roughness: 0.35,
      metalness: 0.15,
      transparent: true,
      opacity: 0.25,
    })
  );
  sheen.rotation.x = -Math.PI / 2;
  sheen.position.y = 0.008;
  sheen.receiveShadow = true;
  scene.add(sheen);

  const lotGroup = new THREE.Group();
  scene.add(lotGroup);

  const ROWS = 2;
  const COLS = 8;
  const stallW = 2.35;
  const stallD = 4.6;
  const rowGap = 3.4;
  const stalls = [];

  const lineMat = new THREE.MeshStandardMaterial({
    color: 0xf2f0ea,
    roughness: 0.55,
    metalness: 0.05,
    emissive: 0xf2f0ea,
    emissiveIntensity: 0.08,
  });
  const aisleMat = new THREE.MeshStandardMaterial({
    color: 0xe6b422,
    roughness: 0.5,
    metalness: 0.1,
    emissive: 0xe6b422,
    emissiveIntensity: 0.12,
  });

  function makeStall(ix, iy) {
    const g = new THREE.Group();
    const x = (ix - (COLS - 1) / 2) * stallW;
    const z = (iy - (ROWS - 1) / 2) * (stallD + rowGap);

    const left = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, stallD * 0.92), lineMat);
    left.position.set(-stallW / 2 + 0.12, 0.015, 0);
    left.receiveShadow = true;
    const right = left.clone();
    right.position.x = stallW / 2 - 0.12;
    const back = new THREE.Mesh(new THREE.BoxGeometry(stallW - 0.2, 0.02, 0.06), lineMat);
    back.position.set(0, 0.015, -stallD / 2 + 0.12);
    g.add(left, right, back);

    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(stallW - 0.4, stallD - 0.45),
      new THREE.MeshStandardMaterial({
        color: 0x12a15c,
        emissive: 0x12a15c,
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.18,
        roughness: 1,
        metalness: 0,
      })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.02;
    g.add(glow);

    g.position.set(x, 0, z);
    lotGroup.add(g);

    return {
      group: g,
      glow,
      ix,
      iy,
      occupied: false,
      car: null,
      glowColor: new THREE.Color(0x12a15c),
      glowTarget: new THREE.Color(0x12a15c),
      glowOpacity: 0.18,
      glowOpacityTarget: 0.18,
    };
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) stalls.push(makeStall(c, r));
  }

  // Center aisle dashes
  for (let i = -7; i <= 7; i++) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.018, 0.1), aisleMat);
    dash.position.set(i * 1.45, 0.02, 0);
    dash.receiveShadow = true;
    lotGroup.add(dash);
  }

  const carPalettes = [
    { body: 0x1c1f26, accent: 0x0a0a0c },
    { body: 0xc9ccd1, accent: 0x8a8e96 },
    { body: 0x8b1e1e, accent: 0x4a0f0f },
    { body: 0x243447, accent: 0x15202c },
    { body: 0xd4d0c8, accent: 0x9a968c },
    { body: 0x2e2e2e, accent: 0x111111 },
  ];

  function roundedBox(w, h, d, r, seg = 3) {
    // Approximate premium body with box + slight taper via scale groups
    return new THREE.BoxGeometry(w, h, d, seg, 1, seg);
  }

  function makeCar(palette) {
    const car = new THREE.Group();
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: palette.body,
      roughness: 0.28,
      metalness: 0.72,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1,
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: palette.accent,
      roughness: 0.4,
      metalness: 0.6,
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x9bb4c8,
      roughness: 0.08,
      metalness: 0.35,
      transparent: true,
      opacity: 0.55,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xd8d8d8,
      roughness: 0.15,
      metalness: 1,
    });
    const rubberMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.9,
      metalness: 0.05,
    });

    const lower = new THREE.Mesh(roundedBox(1.72, 0.42, 3.55), bodyMat);
    lower.position.y = 0.42;
    lower.castShadow = true;
    lower.receiveShadow = true;

    const cabin = new THREE.Mesh(roundedBox(1.52, 0.42, 1.75), bodyMat);
    cabin.position.set(0, 0.78, -0.12);
    cabin.castShadow = true;

    const roofGlass = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.06, 1.45), glassMat);
    roofGlass.position.set(0, 1.02, -0.12);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.38, 0.08), glassMat);
    windshield.position.set(0, 0.78, 0.78);
    windshield.rotation.x = -0.35;

    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.32, 0.08), glassMat);
    rearGlass.position.set(0, 0.76, -0.98);
    rearGlass.rotation.x = 0.28;

    // Headlights
    const hlMat = new THREE.MeshStandardMaterial({
      color: 0xfff5d6,
      emissive: 0xffe6a0,
      emissiveIntensity: 0.85,
      roughness: 0.3,
    });
    const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.06), hlMat);
    hlL.position.set(-0.52, 0.42, 1.78);
    const hlR = hlL.clone();
    hlR.position.x = 0.52;

    // Taillights
    const tlMat = new THREE.MeshStandardMaterial({
      color: 0xff2a2a,
      emissive: 0xff0000,
      emissiveIntensity: 0.6,
      roughness: 0.4,
    });
    const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.05), tlMat);
    tlL.position.set(-0.5, 0.48, -1.78);
    const tlR = tlL.clone();
    tlR.position.x = 0.5;

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.26, 24);
    const hubGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.28, 16);
    const positions = [
      [-0.78, 0.32, 1.05],
      [0.78, 0.32, 1.05],
      [-0.78, 0.32, -1.05],
      [0.78, 0.32, -1.05],
    ];
    positions.forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Group();
      const tire = new THREE.Mesh(wheelGeo, rubberMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      const hub = new THREE.Mesh(hubGeo, chromeMat);
      hub.rotation.z = Math.PI / 2;
      wheel.add(tire, hub);
      wheel.position.set(wx, wy, wz);
      car.add(wheel);
    });

    // Side skirt
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.08, 3.2), darkMat);
    skirt.position.y = 0.22;

    car.add(lower, cabin, roofGlass, windshield, rearGlass, hlL, hlR, tlL, tlR, skirt);
    car.userData.wheels = car.children.filter((c) => c.type === 'Group' && c.children.length === 2);
    return car;
  }

  function setStallVisual(stall, occupied, instant = false) {
    stall.occupied = occupied;
    stall.glowTarget.set(occupied ? 0xc62828 : 0x12a15c);
    stall.glowOpacityTarget = occupied ? 0.12 : 0.22;
    if (instant) {
      stall.glowColor.copy(stall.glowTarget);
      stall.glowOpacity = stall.glowOpacityTarget;
      stall.glow.material.color.copy(stall.glowColor);
      stall.glow.material.emissive.copy(stall.glowColor);
      stall.glow.material.opacity = stall.glowOpacity;
    }
  }

  stalls.forEach((s, i) => {
    const occ = Math.random() > 0.42;
    if (occ) {
      const car = makeCar(carPalettes[i % carPalettes.length]);
      car.rotation.y = s.iy === 0 ? 0 : Math.PI;
      s.group.add(car);
      s.car = car;
    }
    setStallVisual(s, occ, true);
  });

  // Camera poles — sleeker
  const camPoles = [
    { x: -11.5, z: -9, look: new THREE.Vector3(-3, 0, -3) },
    { x: 11.5, z: 9, look: new THREE.Vector3(3, 0, 3) },
    { x: -11.5, z: 9, look: new THREE.Vector3(-2, 0, 2) },
  ];

  const frustumMat = new THREE.MeshBasicMaterial({
    color: 0x5ec8ff,
    transparent: true,
    opacity: 0.045,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const frustumEdgeMat = new THREE.LineBasicMaterial({
    color: 0x8ed8ff,
    transparent: true,
    opacity: 0.28,
  });

  camPoles.forEach((p) => {
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x2a2e36,
      metalness: 0.85,
      roughness: 0.35,
    });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 6.2, 16), poleMat);
    pole.position.set(p.x, 3.1, p.z);
    pole.castShadow = true;
    scene.add(pole);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.28, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x111318, metalness: 0.7, roughness: 0.25 })
    );
    head.position.set(p.x, 6.15, p.z);
    head.lookAt(p.look.x, 1.2, p.look.z);
    head.castShadow = true;
    scene.add(head);

    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 12, 12),
      new THREE.MeshStandardMaterial({
        color: 0x5ec8ff,
        emissive: 0x5ec8ff,
        emissiveIntensity: 1.4,
      })
    );
    led.position.copy(head.position);
    scene.add(led);

    const tip = new THREE.Vector3(p.x, 6.05, p.z);
    const target = p.look.clone();
    target.y = 0.05;
    const dir = target.clone().sub(tip).normalize();
    const end = tip.clone().add(dir.clone().multiplyScalar(10));
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    const realUp = new THREE.Vector3().crossVectors(right, dir).normalize();
    const spread = 3.1;
    const corners = [
      end.clone().add(right.clone().multiplyScalar(spread)).add(realUp.clone().multiplyScalar(spread * 0.5)),
      end.clone().add(right.clone().multiplyScalar(-spread)).add(realUp.clone().multiplyScalar(spread * 0.5)),
      end.clone().add(right.clone().multiplyScalar(-spread)).add(realUp.clone().multiplyScalar(-spread * 0.3)),
      end.clone().add(right.clone().multiplyScalar(spread)).add(realUp.clone().multiplyScalar(-spread * 0.3)),
    ];
    const verts = new Float32Array([
      tip.x, tip.y, tip.z, corners[0].x, corners[0].y, corners[0].z, corners[1].x, corners[1].y, corners[1].z,
      tip.x, tip.y, tip.z, corners[1].x, corners[1].y, corners[1].z, corners[2].x, corners[2].y, corners[2].z,
      tip.x, tip.y, tip.z, corners[2].x, corners[2].y, corners[2].z, corners[3].x, corners[3].y, corners[3].z,
      tip.x, tip.y, tip.z, corners[3].x, corners[3].y, corners[3].z, corners[0].x, corners[0].y, corners[0].z,
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    scene.add(new THREE.Mesh(geo, frustumMat));
    const edgePts = [tip, corners[0], tip, corners[1], tip, corners[2], tip, corners[3]];
    scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(edgePts), frustumEdgeMat));
  });

  // HUD
  const elOpen = document.getElementById('hud-open');
  const elOcc = document.getElementById('hud-occ');
  const elEvent = document.getElementById('hud-event');

  function syncHud(eventText) {
    const open = stalls.filter((s) => !s.occupied).length;
    if (elOpen) elOpen.textContent = String(open);
    if (elOcc) elOcc.textContent = String(stalls.length - open);
    if (elEvent && eventText) elEvent.textContent = eventText;
  }
  syncHud('Live occupancy');

  // Smooth animation state
  let anim = null;
  let nextEventAt = 1.8;
  const clock = new THREE.Clock();

  function smootherstep(t) {
    const x = Math.min(Math.max(t, 0), 1);
    return x * x * x * (x * (x * 6 - 15) + 10);
  }

  function startLeave(stall) {
    if (!stall.car) return;
    const startZ = 0;
    const endZ = stall.iy === 0 ? stallD + 3.2 : -(stallD + 3.2);
    anim = {
      type: 'leave',
      stall,
      car: stall.car,
      t: 0,
      dur: 3.2,
      startZ,
      endZ,
      startRot: stall.car.rotation.y,
    };
    syncHud(`Bay ${stall.ix + 1}${stall.iy ? 'B' : 'A'} opening`);
  }

  function startArrive(stall) {
    const car = makeCar(carPalettes[Math.floor(Math.random() * carPalettes.length)]);
    const startZ = stall.iy === 0 ? stallD + 3.6 : -(stallD + 3.6);
    car.position.z = startZ;
    car.rotation.y = stall.iy === 0 ? 0 : Math.PI;
    stall.group.add(car);
    stall.car = car;
    anim = {
      type: 'arrive',
      stall,
      car,
      t: 0,
      dur: 3.4,
      startZ,
      endZ: 0,
      startRot: car.rotation.y,
    };
    syncHud(`Parking · bay ${stall.ix + 1}${stall.iy ? 'B' : 'A'}`);
  }

  function pickEvent() {
    const occupied = stalls.filter((s) => s.occupied && s.car);
    const open = stalls.filter((s) => !s.occupied && !s.car);
    if (Math.random() < 0.55 && occupied.length) {
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

  // Pointer parallax (subtle)
  let pointerX = 0;
  let pointerY = 0;
  window.addEventListener('pointermove', (e) => {
    pointerX = (e.clientX / window.innerWidth - 0.5) * 2;
    pointerY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  function placeCamera(dt) {
    if (reduced) {
      camera.position.set(16, 11, 18);
      camera.lookAt(camTarget);
      return;
    }
    camGoal.theta = 0.55 + Math.sin(clock.elapsedTime * 0.12) * 0.55 + pointerX * 0.08;
    camGoal.phi = 0.68 + Math.sin(clock.elapsedTime * 0.09) * 0.06 + pointerY * 0.04;
    camGoal.radius = 21.5 + Math.sin(clock.elapsedTime * 0.07) * 1.2;

    const damp = 1 - Math.exp(-dt * 1.8);
    camState.theta += (camGoal.theta - camState.theta) * damp;
    camState.phi += (camGoal.phi - camState.phi) * damp;
    camState.radius += (camGoal.radius - camState.radius) * damp;

    const phi = THREE.MathUtils.clamp(camState.phi, 0.35, 1.2);
    camera.position.set(
      Math.cos(camState.theta) * Math.sin(phi) * camState.radius,
      Math.cos(phi) * camState.radius * 0.95 + 2.5,
      Math.sin(camState.theta) * Math.sin(phi) * camState.radius + 2
    );
    camera.lookAt(camTarget);
  }

  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    placeCamera(dt);

    // Soft light breathing
    pool.intensity = 16 + Math.sin(t * 0.8) * 2.5;

    // Glow lerp
    stalls.forEach((s) => {
      s.glowColor.lerp(s.glowTarget, 1 - Math.exp(-dt * 3));
      s.glowOpacity += (s.glowOpacityTarget - s.glowOpacity) * (1 - Math.exp(-dt * 3));
      s.glow.material.color.copy(s.glowColor);
      s.glow.material.emissive.copy(s.glowColor);
      s.glow.material.emissiveIntensity = 0.25 + Math.sin(t * 2 + s.ix) * 0.05;
      s.glow.material.opacity = s.glowOpacity;
    });

    if (!reduced) {
      if (!anim && t > nextEventAt) pickEvent();

      if (anim) {
        anim.t += dt;
        const p = Math.min(anim.t / anim.dur, 1);
        const e = smootherstep(p);
        anim.car.position.z = anim.startZ + (anim.endZ - anim.startZ) * e;

        // Gentle settle + wheel spin feel
        const speed = Math.sin(p * Math.PI);
        anim.car.position.y = speed * 0.025;
        anim.car.rotation.x = Math.sin(p * Math.PI) * 0.015 * (anim.type === 'arrive' ? -1 : 1);
        anim.car.traverse((child) => {
          if (child.isMesh && child.geometry?.type === 'CylinderGeometry') {
            child.rotation.x += dt * 8 * speed;
          }
        });

        // Fade scale on leave near end
        if (anim.type === 'leave' && p > 0.85) {
          const fade = 1 - (p - 0.85) / 0.15;
          anim.car.scale.setScalar(0.92 + fade * 0.08);
        }

        if (p >= 1) {
          if (anim.type === 'leave') {
            anim.stall.group.remove(anim.car);
            anim.stall.car = null;
            setStallVisual(anim.stall, false);
            syncHud('Spot available');
          } else {
            anim.car.position.y = 0;
            anim.car.rotation.x = 0;
            anim.car.scale.setScalar(1);
            setStallVisual(anim.stall, true);
            syncHud('Occupied');
          }
          anim = null;
          nextEventAt = t + 2.4 + Math.random() * 2.2;
        }
      }
    }

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function makeAsphaltTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#15181f';
  ctx.fillRect(0, 0, size, size);

  // Speckle
  for (let i = 0; i < 8000; i++) {
    const shade = 18 + Math.random() * 28;
    ctx.fillStyle = `rgba(${shade},${shade + 2},${shade + 6},${0.15 + Math.random() * 0.35})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1);
  }

  // Subtle cracks
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 18; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * size, Math.random() * size);
    ctx.quadraticCurveTo(
      Math.random() * size,
      Math.random() * size,
      Math.random() * size,
      Math.random() * size
    );
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
