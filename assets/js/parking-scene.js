/**
 * Damn Parking - cinematic parking lot
 * Path-driven cars, walking pedestrians, drag-to-orbit camera
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

const canvasHost = document.getElementById('parking-canvas');
if (canvasHost) bootScene(canvasHost);

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

function smootherstep(t) {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function bootScene(host) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0d12);
  scene.fog = new THREE.Fog(0x0b0d12, 70, 140);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 160);
  const camTarget = new THREE.Vector3(0, 0.35, 0);
  const camState = { theta: 0.85, phi: 0.88, radius: 34 };
  const camGoal = { theta: 0.85, phi: 0.88, radius: 34 };

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
  } catch (err) {
    console.warn('Damn Parking 3D lot unavailable:', err);
    host.innerHTML =
      '<p class="hero-orbit-hint" style="position:absolute;inset:auto 1rem 40%;text-align:center;width:calc(100% - 2rem)">3D lot preview needs WebGL in this browser.</p>';
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0b0d12, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.style.cursor = 'grab';

  scene.environment = makeStudioEnvironment(renderer);

  scene.add(new THREE.HemisphereLight(0xb0c4de, 0x1a1510, 0.58));

  const key = new THREE.DirectionalLight(0xfff2dd, 2.15);
  key.position.set(9, 18, 11);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 90;
  key.shadow.camera.left = -40;
  key.shadow.camera.right = 40;
  key.shadow.camera.top = 34;
  key.shadow.camera.bottom = -34;
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.03;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x8eb6ff, 0.45);
  fill.position.set(-12, 8, -6);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.28);
  rim.position.set(0, 6, -14);
  scene.add(rim);

  // Steady lot fill light (no pulsing)
  const pool = new THREE.PointLight(0xffc98a, 14, 34, 2);
  pool.position.set(0, 8, 0);
  scene.add(pool);

  const asphaltTex = makeAsphaltTexture();
  asphaltTex.wrapS = asphaltTex.wrapT = THREE.RepeatWrapping;
  asphaltTex.repeat.set(8, 8);

  // City block base
  const cityGround = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 140),
    new THREE.MeshStandardMaterial({
      color: 0x12151c,
      roughness: 0.96,
      metalness: 0.02,
    })
  );
  cityGround.rotation.x = -Math.PI / 2;
  cityGround.position.y = -0.02;
  cityGround.receiveShadow = true;
  scene.add(cityGround);

  // Street ring around the lot (solid asphalt, no stacked overlays)
  const streetMat = new THREE.MeshStandardMaterial({
    color: 0x2a2f38,
    roughness: 0.96,
    metalness: 0.02,
  });
  const street = new THREE.Mesh(new THREE.PlaneGeometry(72, 56), streetMat);
  street.rotation.x = -Math.PI / 2;
  street.position.y = 0.002;
  street.receiveShadow = true;
  scene.add(street);

  // Parking lot pad
  const lotPad = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 22),
    new THREE.MeshStandardMaterial({
      map: asphaltTex,
      color: 0xc8ccd4,
      roughness: 0.92,
      metalness: 0.04,
    })
  );
  lotPad.rotation.x = -Math.PI / 2;
  lotPad.position.y = 0.02;
  lotPad.receiveShadow = true;
  scene.add(lotPad);

  // Clean sidewalks: flat planes only (avoids z-fight flicker from stacked boxes)
  const walkMat = new THREE.MeshStandardMaterial({
    color: 0x6e6a64,
    roughness: 0.98,
    metalness: 0.0,
  });

  function addWalkStrip(w, d, x, z) {
    const slab = new THREE.Mesh(new THREE.PlaneGeometry(w, d), walkMat);
    slab.rotation.x = -Math.PI / 2;
    slab.position.set(x, 0.045, z);
    slab.receiveShadow = true;
    scene.add(slab);
  }

  // Inner sidewalk hugging the lot
  addWalkStrip(38, 2.2, 0, -12.3);
  addWalkStrip(38, 2.2, 0, 12.3);
  addWalkStrip(2.2, 22, -18, 0);
  addWalkStrip(2.2, 22, 18, 0);
  // Outer sidewalk across the street (building side)
  addWalkStrip(64, 2.0, 0, -26.2);
  addWalkStrip(64, 2.0, 0, 26.2);
  addWalkStrip(2.0, 50, -33.5, 0);
  addWalkStrip(2.0, 50, 33.5, 0);

  // Street lane markings (steady, non-emissive)
  const laneMat = new THREE.MeshStandardMaterial({
    color: 0xe8e2c8,
    roughness: 0.7,
    metalness: 0.05,
  });
  const centerLaneMat = new THREE.MeshStandardMaterial({
    color: 0xd4b84a,
    roughness: 0.65,
    metalness: 0.06,
  });

  function addLaneDashes(axis, fixed, start, end, step, len, colorMat) {
    for (let v = start; v <= end; v += step) {
      const dash =
        axis === 'x'
          ? new THREE.Mesh(new THREE.BoxGeometry(len, 0.02, 0.12), colorMat)
          : new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, len), colorMat);
      if (axis === 'x') dash.position.set(v, 0.02, fixed);
      else dash.position.set(fixed, 0.02, v);
      dash.receiveShadow = true;
      scene.add(dash);
    }
  }

  // North / south street center dashes
  addLaneDashes('x', -19.2, -28, 28, 2.6, 1.15, centerLaneMat);
  addLaneDashes('x', 19.2, -28, 28, 2.6, 1.15, centerLaneMat);
  // East / west street center dashes
  addLaneDashes('z', -24.8, -16, 16, 2.6, 1.15, centerLaneMat);
  addLaneDashes('z', 24.8, -16, 16, 2.6, 1.15, centerLaneMat);
  // Soft edge lines near lot sidewalks
  addLaneDashes('x', -13.6, -15, 15, 3.4, 1.5, laneMat);
  addLaneDashes('x', 13.6, -15, 15, 3.4, 1.5, laneMat);

  // Surrounding campus / street buildings
  const buildingPalette = [
    { wall: 0x3a4250, accent: 0x262c36, glass: 0x9ec4d8 },
    { wall: 0x454c58, accent: 0x2d333d, glass: 0xa8cde0 },
    { wall: 0x4a433c, accent: 0x322c27, glass: 0xb0c6d4 },
    { wall: 0x3f4754, accent: 0x282f39, glass: 0x8eb6cc },
    { wall: 0x4b515c, accent: 0x323740, glass: 0xa2c0d0 },
  ];

  function makeBuilding(w, h, d, x, z, palette, rotY = 0) {
    const group = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({
      color: palette.wall,
      roughness: 0.86,
      metalness: 0.08,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: palette.accent,
      roughness: 0.8,
      metalness: 0.1,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: palette.glass,
      emissive: palette.glass,
      emissiveIntensity: 0.32,
      roughness: 0.28,
      metalness: 0.4,
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.35, 0.35, d + 0.35), accentMat);
    base.position.y = 0.18;
    base.receiveShadow = true;
    group.add(base);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.22, d * 0.96), accentMat);
    roof.position.y = h + 0.05;
    roof.castShadow = true;
    group.add(roof);

    // Quiet window grid on the long faces
    const cols = Math.max(3, Math.floor(w / 2.4));
    const rows = Math.max(3, Math.floor(h / 2.6));
    const winW = Math.min(1.1, (w - 1.2) / cols);
    const winH = Math.min(1.35, (h - 2.2) / rows);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r + c) % 3 === 0) continue;
        const win = new THREE.Mesh(new THREE.PlaneGeometry(winW * 0.72, winH * 0.62), glassMat);
        const wx = -w / 2 + 0.9 + c * ((w - 1.8) / Math.max(cols - 1, 1));
        const wy = 1.4 + r * ((h - 2.4) / Math.max(rows - 1, 1));
        win.position.set(wx, wy, d / 2 + 0.02);
        group.add(win);
        const winBack = win.clone();
        winBack.position.z = -d / 2 - 0.02;
        winBack.rotation.y = Math.PI;
        group.add(winBack);
      }
    }

    group.position.set(x, 0, z);
    group.rotation.y = rotY;
    scene.add(group);
    return group;
  }

  const buildings = [
    { w: 16, h: 12, d: 8, x: -10, z: -32, p: 0 },
    { w: 12, h: 16, d: 8, x: 12, z: -33, p: 1 },
    { w: 10, h: 10, d: 7, x: 28, z: -30, p: 2 },
    { w: 12, h: 14, d: 8, x: 36, z: -12, p: 3 },
    { w: 10, h: 11, d: 8, x: 35, z: 8, p: 4 },
    { w: 14, h: 13, d: 8, x: 28, z: 30, p: 0 },
    { w: 12, h: 11, d: 8, x: 8, z: 33, p: 1 },
    { w: 12, h: 15, d: 8, x: -12, z: 33, p: 2 },
    { w: 10, h: 10, d: 7, x: -28, z: 28, p: 3 },
    { w: 12, h: 12, d: 8, x: -36, z: 6, p: 4 },
    { w: 11, h: 16, d: 8, x: -35, z: -12, p: 0 },
    { w: 10, h: 9, d: 7, x: -26, z: -30, p: 1 },
  ];
  buildings.forEach((b) => {
    makeBuilding(b.w, b.h, b.d, b.x, b.z, buildingPalette[b.p % buildingPalette.length]);
  });

  const lotGroup = new THREE.Group();
  scene.add(lotGroup);

  const ROWS = 2;
  const COLS = 8;
  const stallW = 2.35;
  const stallD = 4.6;
  const rowGap = 3.6;
  const aisleHalf = rowGap * 0.5;
  const stalls = [];

  const lineMat = new THREE.MeshStandardMaterial({
    color: 0xf2f0ea,
    roughness: 0.65,
    metalness: 0.04,
  });
  const aisleMat = new THREE.MeshStandardMaterial({
    color: 0xd4b84a,
    roughness: 0.6,
    metalness: 0.06,
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
        emissiveIntensity: 0.16,
        transparent: true,
        opacity: 0.14,
        roughness: 1,
        metalness: 0,
        depthWrite: false,
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
      x,
      z,
      occupied: false,
      busy: false,
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

  for (let i = -7; i <= 7; i++) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.018, 0.1), aisleMat);
    dash.position.set(i * 1.45, 0.02, 0);
    dash.receiveShadow = true;
    lotGroup.add(dash);
  }

  // Soft street lamps (steady intensity, no flicker)
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x2a2e36, metalness: 0.85, roughness: 0.35 });
  const lampGlowMat = new THREE.MeshStandardMaterial({
    color: 0xffe2b0,
    emissive: 0xffc98a,
    emissiveIntensity: 0.55,
    roughness: 0.4,
  });
  [
    [-17, -12.3],
    [17, -12.3],
    [-17, 12.3],
    [17, 12.3],
    [-24, -19.2],
    [24, -19.2],
    [-24, 19.2],
    [24, 19.2],
  ].forEach(([lx, lz]) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 5.2, 12), lampMat);
    pole.position.set(lx, 2.6, lz);
    pole.castShadow = true;
    scene.add(pole);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), lampGlowMat);
    lamp.position.set(lx, 5.3, lz);
    scene.add(lamp);
    const lampLight = new THREE.PointLight(0xffc98a, 6.5, 18, 2);
    lampLight.position.set(lx, 5.1, lz);
    scene.add(lampLight);
  });

  const carPalettes = [
    { body: 0x1c1f26, accent: 0x0a0a0c, glass: 0x8aa4b8 },
    { body: 0xc9ccd1, accent: 0x8a8e96, glass: 0x9bb4c8 },
    { body: 0x8b1e1e, accent: 0x4a0f0f, glass: 0x7a96aa },
    { body: 0x243447, accent: 0x15202c, glass: 0x8aa4b8 },
    { body: 0xd4d0c8, accent: 0x9a968c, glass: 0xa8c0d0 },
    { body: 0x2e2e2e, accent: 0x111111, glass: 0x7a96aa },
    { body: 0x3d5a40, accent: 0x1f3022, glass: 0x8aa4b8 },
    { body: 0xb87333, accent: 0x6b4218, glass: 0x9bb4c8 },
  ];

  function makeCar(palette) {
    const car = new THREE.Group();
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: palette.body,
      roughness: 0.22,
      metalness: 0.78,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      envMapIntensity: 1.15,
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: palette.accent,
      roughness: 0.4,
      metalness: 0.65,
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: palette.glass || 0x9bb4c8,
      roughness: 0.06,
      metalness: 0.4,
      transparent: true,
      opacity: 0.52,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.2,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe8e8e8,
      roughness: 0.12,
      metalness: 1,
    });
    const rubberMat = new THREE.MeshStandardMaterial({
      color: 0x151515,
      roughness: 0.92,
      metalness: 0.04,
    });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.16, 3.7), darkMat);
    chassis.position.y = 0.28;
    chassis.castShadow = true;

    const lower = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.46, 3.55), bodyMat);
    lower.position.y = 0.48;
    lower.castShadow = true;
    lower.receiveShadow = true;

    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.12, 0.95), bodyMat);
    hood.position.set(0, 0.74, 0.95);
    hood.castShadow = true;

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.46, 1.65), bodyMat);
    cabin.position.set(0, 0.86, -0.18);
    cabin.castShadow = true;

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.08, 1.35), bodyMat);
    roof.position.set(0, 1.12, -0.18);
    roof.castShadow = true;

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.42, 0.06), glassMat);
    windshield.position.set(0, 0.88, 0.68);
    windshield.rotation.x = -0.42;

    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.36, 0.06), glassMat);
    rearGlass.position.set(0, 0.86, -1.02);
    rearGlass.rotation.x = 0.32;

    const sideGlassL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 1.2), glassMat);
    sideGlassL.position.set(-0.74, 0.88, -0.15);
    const sideGlassR = sideGlassL.clone();
    sideGlassR.position.x = 0.74;

    const hlMat = new THREE.MeshStandardMaterial({
      color: 0xfff5d6,
      emissive: 0xffe6a0,
      emissiveIntensity: 0.95,
      roughness: 0.25,
    });
    const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.08), hlMat);
    hlL.position.set(-0.52, 0.46, 1.8);
    const hlR = hlL.clone();
    hlR.position.x = 0.52;

    const tlMat = new THREE.MeshStandardMaterial({
      color: 0xff2a2a,
      emissive: 0xff0000,
      emissiveIntensity: 0.7,
      roughness: 0.35,
    });
    const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.06), tlMat);
    tlL.position.set(-0.5, 0.52, -1.8);
    const tlR = tlL.clone();
    tlR.position.x = 0.5;

    const bumperF = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 0.18), darkMat);
    bumperF.position.set(0, 0.3, 1.86);
    const bumperR = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 0.18), darkMat);
    bumperR.position.set(0, 0.3, -1.86);

    const mirrorGeo = new THREE.BoxGeometry(0.18, 0.1, 0.08);
    const mirrorL = new THREE.Mesh(mirrorGeo, darkMat);
    mirrorL.position.set(-0.92, 0.78, 0.45);
    const mirrorR = mirrorL.clone();
    mirrorR.position.x = 0.92;

    const wheels = [];
    const wheelGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.28, 28);
    const hubGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.3, 18);
    const positions = [
      [-0.8, 0.33, 1.1],
      [0.8, 0.33, 1.1],
      [-0.8, 0.33, -1.1],
      [0.8, 0.33, -1.1],
    ];
    positions.forEach(([wx, wy, wz], idx) => {
      const wheel = new THREE.Group();
      const tire = new THREE.Mesh(wheelGeo, rubberMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      const hub = new THREE.Mesh(hubGeo, chromeMat);
      hub.rotation.z = Math.PI / 2;
      wheel.add(tire, hub);
      wheel.position.set(wx, wy, wz);
      wheel.userData.spin = tire;
      wheel.userData.isFront = idx < 2;
      car.add(wheel);
      wheels.push(wheel);
    });

    car.add(
      chassis,
      lower,
      hood,
      cabin,
      roof,
      windshield,
      rearGlass,
      sideGlassL,
      sideGlassR,
      hlL,
      hlR,
      tlL,
      tlR,
      bumperF,
      bumperR,
      mirrorL,
      mirrorR
    );
    car.userData.wheels = wheels;
    car.userData.bodyMat = bodyMat;
    return car;
  }

  function setStallVisual(stall, occupied, instant = false) {
    stall.occupied = occupied;
    stall.glowTarget.set(occupied ? 0xc62828 : 0x12a15c);
    stall.glowOpacityTarget = occupied ? 0.1 : 0.16;
    if (instant) {
      stall.glowColor.copy(stall.glowTarget);
      stall.glowOpacity = stall.glowOpacityTarget;
      stall.glow.material.color.copy(stall.glowColor);
      stall.glow.material.emissive.copy(stall.glowColor);
      stall.glow.material.opacity = stall.glowOpacity;
    }
  }

  stalls.forEach((s, i) => {
    const occ = Math.random() > 0.4;
    if (occ) {
      const car = makeCar(carPalettes[i % carPalettes.length]);
      car.rotation.y = s.iy === 0 ? 0 : Math.PI;
      s.group.add(car);
      s.car = car;
    }
    setStallVisual(s, occ, true);
  });

  // Camera poles
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

  // -- Pedestrians --
  const people = [];
  const skinTones = [0xe8c4a8, 0xd4a574, 0xc68642, 0x8d5524, 0xf1c27d];
  const shirtColors = [0x2b4c7e, 0xc0392b, 0x27ae60, 0xf39c12, 0x8e44ad, 0x34495e, 0xffffff, 0x1abc9c];
  const pantColors = [0x2c3e50, 0x1a1a1a, 0x4a5568, 0x3d405b];

  function makePerson(palette) {
    const person = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({
      color: palette.skin,
      roughness: 0.75,
      metalness: 0.05,
    });
    const shirt = new THREE.MeshStandardMaterial({
      color: palette.shirt,
      roughness: 0.7,
      metalness: 0.05,
    });
    const pants = new THREE.MeshStandardMaterial({
      color: palette.pants,
      roughness: 0.8,
      metalness: 0.04,
    });

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.48, 14), shirt);
    torso.position.y = 1.08;
    torso.castShadow = true;

    const shoulders = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.18), shirt);
    shoulders.position.y = 1.3;
    shoulders.castShadow = true;

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.08, 8), skin);
    neck.position.y = 1.4;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), skin);
    head.position.y = 1.55;
    head.castShadow = true;

    const hip = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.2), pants);
    hip.position.y = 0.8;
    hip.castShadow = true;

    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.46, 8), shirt);
    armL.position.set(-0.24, 1.05, 0);
    armL.castShadow = true;
    const armR = armL.clone();
    armR.position.x = 0.24;

    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.58, 8), pants);
    legL.position.set(-0.09, 0.42, 0);
    legL.castShadow = true;
    const legR = legL.clone();
    legR.position.x = 0.09;

    const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.16), new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.9,
    }));
    shoeL.position.set(-0.09, 0.05, 0.03);
    const shoeR = shoeL.clone();
    shoeR.position.x = 0.09;

    person.add(torso, shoulders, neck, head, hip, armL, armR, legL, legR, shoeL, shoeR);
    person.userData.armL = armL;
    person.userData.armR = armR;
    person.userData.legL = legL;
    person.userData.legR = legR;
    person.userData.phase = Math.random() * Math.PI * 2;
    person.userData.speed = 0.9 + Math.random() * 0.55;
    return person;
  }

  // Pedestrian routes stay on sidewalks (not in the street)
  const walkRoutes = [
    // Inner lot sidewalk loop
    [
      new THREE.Vector3(-17, 0, -12.4),
      new THREE.Vector3(-6, 0, -12.4),
      new THREE.Vector3(6, 0, -12.4),
      new THREE.Vector3(17, 0, -12.4),
      new THREE.Vector3(18.2, 0, -6),
      new THREE.Vector3(18.2, 0, 0),
      new THREE.Vector3(18.2, 0, 6),
      new THREE.Vector3(17, 0, 12.4),
      new THREE.Vector3(6, 0, 12.4),
      new THREE.Vector3(-6, 0, 12.4),
      new THREE.Vector3(-17, 0, 12.4),
      new THREE.Vector3(-18.2, 0, 6),
      new THREE.Vector3(-18.2, 0, 0),
      new THREE.Vector3(-18.2, 0, -6),
      new THREE.Vector3(-17, 0, -12.4),
    ],
      // Outer north sidewalk by buildings
    [
      new THREE.Vector3(-24, 0, -26.2),
      new THREE.Vector3(-8, 0, -26.2),
      new THREE.Vector3(8, 0, -26.2),
      new THREE.Vector3(24, 0, -26.2),
      new THREE.Vector3(8, 0, -26.2),
      new THREE.Vector3(-8, 0, -26.2),
      new THREE.Vector3(-24, 0, -26.2),
    ],
    // Outer south sidewalk
    [
      new THREE.Vector3(24, 0, 26.2),
      new THREE.Vector3(8, 0, 26.2),
      new THREE.Vector3(-8, 0, 26.2),
      new THREE.Vector3(-24, 0, 26.2),
      new THREE.Vector3(-8, 0, 26.2),
      new THREE.Vector3(8, 0, 26.2),
      new THREE.Vector3(24, 0, 26.2),
    ],
    // Outer east sidewalk
    [
      new THREE.Vector3(33.5, 0, -16),
      new THREE.Vector3(33.5, 0, -2),
      new THREE.Vector3(33.5, 0, 10),
      new THREE.Vector3(33.5, 0, 18),
      new THREE.Vector3(33.5, 0, 10),
      new THREE.Vector3(33.5, 0, -2),
      new THREE.Vector3(33.5, 0, -16),
    ],
  ];

  function spawnPerson(routeIndex) {
    const route = walkRoutes[routeIndex % walkRoutes.length];
    const person = makePerson({
      skin: skinTones[Math.floor(Math.random() * skinTones.length)],
      shirt: shirtColors[Math.floor(Math.random() * shirtColors.length)],
      pants: pantColors[Math.floor(Math.random() * pantColors.length)],
    });
    const seg = Math.floor(Math.random() * (route.length - 1));
    const a = route[seg];
    const b = route[seg + 1];
    const u = Math.random();
    person.position.set(lerp(a.x, b.x, u), 0, lerp(a.z, b.z, u));
    scene.add(person);
    people.push({
      mesh: person,
      route,
      seg,
      t: u,
      wait: 0,
    });
  }

  for (let i = 0; i < 9; i++) spawnPerson(i % walkRoutes.length);

  function updatePeople(dt) {
    people.forEach((p) => {
      if (p.wait > 0) {
        p.wait -= dt;
        // Idle sway
        p.mesh.userData.armL.rotation.x *= 0.9;
        p.mesh.userData.armR.rotation.x *= 0.9;
        p.mesh.userData.legL.rotation.x *= 0.9;
        p.mesh.userData.legR.rotation.x *= 0.9;
        return;
      }

      const a = p.route[p.seg];
      const b = p.route[(p.seg + 1) % p.route.length];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      const speed = p.mesh.userData.speed;
      p.t += (dt * speed) / dist;

      if (p.t >= 1) {
        p.t = 0;
        p.seg = (p.seg + 1) % p.route.length;
        if (Math.random() < 0.12) p.wait = 0.6 + Math.random() * 1.4;
      }

      const a2 = p.route[p.seg];
      const b2 = p.route[(p.seg + 1) % p.route.length];
      const e = smootherstep(p.t);
      p.mesh.position.x = lerp(a2.x, b2.x, e);
      p.mesh.position.z = lerp(a2.z, b2.z, e);

      const facing = Math.atan2(b2.x - a2.x, b2.z - a2.z);
      let yaw = p.mesh.rotation.y;
      let diff = facing - yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      p.mesh.rotation.y = yaw + diff * Math.min(1, dt * 6);

      const walk = Math.sin(clock.elapsedTime * 7.5 * speed + p.mesh.userData.phase);
      p.mesh.userData.legL.rotation.x = walk * 0.55;
      p.mesh.userData.legR.rotation.x = -walk * 0.55;
      p.mesh.userData.armL.rotation.x = -walk * 0.4;
      p.mesh.userData.armR.rotation.x = walk * 0.4;
      p.mesh.position.y = Math.abs(walk) * 0.02;
    });
  }

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

  // Car animation: multi-waypoint world-space paths
  let anim = null;
  let cruise = null;
  let nextEventAt = 1.6;
  let nextCruiseAt = 4.5;
  const clock = new THREE.Clock();
  const movingCars = new THREE.Group();
  scene.add(movingCars);

  function stallWorldPos(stall) {
    return new THREE.Vector3(stall.x, 0, stall.z);
  }

  function spinWheels(car, amount) {
    const wheels = car.userData.wheels || [];
    wheels.forEach((w) => {
      if (w.userData.spin) w.userData.spin.rotation.x += amount;
    });
  }

  function steerFront(car, angle) {
    const wheels = car.userData.wheels || [];
    wheels.forEach((w) => {
      if (w.userData.isFront) w.rotation.y = angle;
    });
  }

  function buildLeavePath(stall) {
    const parkYaw = stall.iy === 0 ? 0 : Math.PI;
    const outSign = stall.iy === 0 ? 1 : -1;
    const park = stallWorldPos(stall);
    const aislePoint = new THREE.Vector3(stall.x, 0, outSign * aisleHalf * 0.15);
    const turnPoint = new THREE.Vector3(stall.x + (stall.ix < COLS / 2 ? -1.2 : 1.2), 0, 0);
    const exitX = stall.ix < COLS / 2 ? -18 : 18;
    const exit = new THREE.Vector3(exitX, 0, 0);
    const exitYaw = exitX < 0 ? -Math.PI / 2 : Math.PI / 2;

    return {
      type: 'leave',
      stall,
      points: [
        { pos: park.clone(), yaw: parkYaw, dur: 0.01 },
        { pos: aislePoint, yaw: parkYaw, dur: 1.35 },
        { pos: turnPoint, yaw: exitYaw, dur: 1.1 },
        { pos: exit, yaw: exitYaw, dur: 2.2 },
      ],
    };
  }

  function buildArrivePath(stall) {
    const parkYaw = stall.iy === 0 ? 0 : Math.PI;
    const outSign = stall.iy === 0 ? 1 : -1;
    const entryX = Math.random() < 0.5 ? -18 : 18;
    const entryYaw = entryX < 0 ? Math.PI / 2 : -Math.PI / 2;
    const entry = new THREE.Vector3(entryX, 0, 0);
    const approach = new THREE.Vector3(stall.x + (entryX < 0 ? -1.4 : 1.4), 0, 0);
    const aislePoint = new THREE.Vector3(stall.x, 0, outSign * aisleHalf * 0.2);
    const park = stallWorldPos(stall);

    return {
      type: 'arrive',
      stall,
      points: [
        { pos: entry, yaw: entryYaw, dur: 0.01 },
        { pos: approach, yaw: entryYaw, dur: 2.0 },
        { pos: aislePoint, yaw: parkYaw, dur: 1.15 },
        { pos: park, yaw: parkYaw, dur: 1.4 },
      ],
    };
  }

  function beginPathAnim(path, car) {
    movingCars.add(car);
    car.position.copy(path.points[0].pos);
    car.rotation.y = path.points[0].yaw;
    anim = {
      ...path,
      car,
      seg: 0,
      t: 0,
    };
  }

  function startLeave(stall) {
    if (!stall.car || stall.busy) return;
    const car = stall.car;
    stall.group.remove(car);
    stall.car = null;
    stall.busy = true;
    const path = buildLeavePath(stall);
    beginPathAnim(path, car);
    setStallVisual(stall, false);
    syncHud(`Bay ${stall.ix + 1}${stall.iy ? 'B' : 'A'} opening`);
  }

  function startArrive(stall) {
    if (stall.busy || stall.car) return;
    const car = makeCar(carPalettes[Math.floor(Math.random() * carPalettes.length)]);
    const path = buildArrivePath(stall);
    stall.busy = true;
    stall.car = car;
    beginPathAnim(path, car);
    syncHud(`Parking · bay ${stall.ix + 1}${stall.iy ? 'B' : 'A'}`);
  }

  function startCruise() {
    if (cruise || anim) return;
    const car = makeCar(carPalettes[Math.floor(Math.random() * carPalettes.length)]);
    const fromLeft = Math.random() < 0.5;
    const z = (Math.random() - 0.5) * 0.6;
    const start = new THREE.Vector3(fromLeft ? -20 : 20, 0, z);
    const end = new THREE.Vector3(fromLeft ? 20 : -20, 0, z);
    const yaw = fromLeft ? Math.PI / 2 : -Math.PI / 2;
    car.position.copy(start);
    car.rotation.y = yaw;
    movingCars.add(car);
    cruise = {
      car,
      start,
      end,
      yaw,
      t: 0,
      dur: 5.5 + Math.random() * 1.5,
    };
    syncHud('Vehicle passing');
  }

  function pickEvent() {
    const occupied = stalls.filter((s) => s.occupied && s.car && !s.busy);
    const open = stalls.filter((s) => !s.occupied && !s.car && !s.busy);
    if (Math.random() < 0.55 && occupied.length) {
      startLeave(occupied[Math.floor(Math.random() * occupied.length)]);
    } else if (open.length) {
      startArrive(open[Math.floor(Math.random() * open.length)]);
    } else if (occupied.length) {
      startLeave(occupied[Math.floor(Math.random() * occupied.length)]);
    }
  }

  function updateAnim(dt) {
    if (!anim) return;
    const a = anim.points[anim.seg];
    const b = anim.points[anim.seg + 1];
    if (!b) {
      finishAnim();
      return;
    }

    anim.t += dt;
    const p = Math.min(anim.t / Math.max(b.dur, 0.01), 1);
    const e = smootherstep(p);

    anim.car.position.x = lerp(a.pos.x, b.pos.x, e);
    anim.car.position.z = lerp(a.pos.z, b.pos.z, e);

    let yawA = a.yaw;
    let yawB = b.yaw;
    let dyaw = yawB - yawA;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    anim.car.rotation.y = yawA + dyaw * e;

    const speed = Math.sin(p * Math.PI);
    anim.car.position.y = speed * 0.02;
    anim.car.rotation.z = Math.sin(p * Math.PI) * dyaw * 0.04;
    spinWheels(anim.car, dt * 10 * (0.25 + speed));
    steerFront(anim.car, THREE.MathUtils.clamp(dyaw * (1 - p) * 0.35, -0.45, 0.45));

    if (p >= 1) {
      anim.seg += 1;
      anim.t = 0;
      if (anim.seg >= anim.points.length - 1) finishAnim();
    }
  }

  function finishAnim() {
    if (!anim) return;
    const { type, stall, car } = anim;
    if (type === 'leave') {
      movingCars.remove(car);
      disposeObject(car);
      stall.car = null;
      stall.busy = false;
      syncHud('Spot available');
    } else {
      movingCars.remove(car);
      car.position.set(0, 0, 0);
      car.rotation.set(0, stall.iy === 0 ? 0 : Math.PI, 0);
      car.scale.setScalar(1);
      steerFront(car, 0);
      stall.group.add(car);
      stall.car = car;
      stall.busy = false;
      setStallVisual(stall, true);
      syncHud('Occupied');
    }
    anim = null;
    nextEventAt = clock.elapsedTime + 2.2 + Math.random() * 2.4;
  }

  function updateCruise(dt) {
    if (!cruise) return;
    cruise.t += dt;
    const p = Math.min(cruise.t / cruise.dur, 1);
    const e = smootherstep(p);
    cruise.car.position.x = lerp(cruise.start.x, cruise.end.x, e);
    cruise.car.position.z = lerp(cruise.start.z, cruise.end.z, e);
    cruise.car.position.y = Math.sin(p * Math.PI) * 0.015;
    spinWheels(cruise.car, dt * 12);
    if (p >= 1) {
      movingCars.remove(cruise.car);
      disposeObject(cruise.car);
      cruise = null;
      nextCruiseAt = clock.elapsedTime + 3.5 + Math.random() * 4;
      syncHud('Live occupancy');
    }
  }

  function disposeObject(obj) {
    obj.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    });
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

  // Interactive orbit: drag to look, wheel to zoom
  const drag = {
    active: false,
    x: 0,
    y: 0,
    moved: false,
  };
  let autoOrbit = true;
  let resumeAutoAt = 0;

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    drag.active = true;
    drag.moved = false;
    drag.x = e.clientX;
    drag.y = e.clientY;
    autoOrbit = false;
    renderer.domElement.style.cursor = 'grabbing';
    renderer.domElement.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    if (!drag.active) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    drag.x = e.clientX;
    drag.y = e.clientY;
    camGoal.theta -= dx * 0.0055;
    camGoal.phi = THREE.MathUtils.clamp(camGoal.phi + dy * 0.004, 0.35, 1.25);
    resumeAutoAt = clock.elapsedTime + 4.5;
  }

  function onPointerUp(e) {
    drag.active = false;
    renderer.domElement.style.cursor = 'grab';
    try {
      renderer.domElement.releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function onWheel(e) {
    e.preventDefault();
    autoOrbit = false;
    camGoal.radius = THREE.MathUtils.clamp(camGoal.radius + e.deltaY * 0.012, 14, 48);
    resumeAutoAt = clock.elapsedTime + 4.5;
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointercancel', onPointerUp);
  renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

  function placeCamera(dt) {
    if (reduced) {
      camera.position.set(16, 11, 18);
      camera.lookAt(camTarget);
      return;
    }

    if (autoOrbit && !drag.active) {
      camGoal.theta = 0.85 + Math.sin(clock.elapsedTime * 0.09) * 0.45;
      camGoal.phi = 0.86 + Math.sin(clock.elapsedTime * 0.06) * 0.04;
      camGoal.radius = 34 + Math.sin(clock.elapsedTime * 0.05) * 1.8;
    } else if (!drag.active && clock.elapsedTime > resumeAutoAt) {
      autoOrbit = true;
    }

    const damp = 1 - Math.exp(-dt * 2.2);
    camState.theta += (camGoal.theta - camState.theta) * damp;
    camState.phi += (camGoal.phi - camState.phi) * damp;
    camState.radius += (camGoal.radius - camState.radius) * damp;

    const phi = THREE.MathUtils.clamp(camState.phi, 0.35, 1.25);
    camera.position.set(
      Math.cos(camState.theta) * Math.sin(phi) * camState.radius,
      Math.cos(phi) * camState.radius * 0.95 + 2.2,
      Math.sin(camState.theta) * Math.sin(phi) * camState.radius + 1.5
    );
    camera.lookAt(camTarget);
  }

  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    placeCamera(dt);

    stalls.forEach((s) => {
      s.glowColor.lerp(s.glowTarget, 1 - Math.exp(-dt * 3));
      s.glowOpacity += (s.glowOpacityTarget - s.glowOpacity) * (1 - Math.exp(-dt * 3));
      s.glow.material.color.copy(s.glowColor);
      s.glow.material.emissive.copy(s.glowColor);
      s.glow.material.emissiveIntensity = 0.16;
      s.glow.material.opacity = s.glowOpacity;
    });

    if (!reduced) {
      updatePeople(dt);

      if (!anim && t > nextEventAt) pickEvent();
      if (!cruise && !anim && t > nextCruiseAt) startCruise();

      updateAnim(dt);
      updateCruise(dt);
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

  for (let i = 0; i < 9000; i++) {
    const shade = 18 + Math.random() * 28;
    ctx.fillStyle = `rgba(${shade},${shade + 2},${shade + 6},${0.15 + Math.random() * 0.35})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1);
  }

  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 20; i++) {
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
