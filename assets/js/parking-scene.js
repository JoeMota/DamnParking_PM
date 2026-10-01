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
    new THREE.MeshBasicMaterial({ color: 0x121826, side: THREE.BackSide })
  );
  envScene.add(shell);

  const warm = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 7),
    new THREE.MeshBasicMaterial({ color: 0xffd9a8 })
  );
  warm.position.set(6, 5, 5);
  warm.lookAt(0, 0, 0);
  envScene.add(warm);

  const cool = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 9),
    new THREE.MeshBasicMaterial({ color: 0x7ea0ff })
  );
  cool.position.set(-7, 3.5, 1);
  cool.lookAt(0, 0, 0);
  envScene.add(cool);

  const overhead = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 10),
    new THREE.MeshBasicMaterial({ color: 0xe8eef8 })
  );
  overhead.position.set(0, 9, -1);
  overhead.rotation.x = Math.PI / 2;
  envScene.add(overhead);

  const groundBounce = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 16),
    new THREE.MeshBasicMaterial({ color: 0x2a3038 })
  );
  groundBounce.position.set(0, -2, 0);
  groundBounce.rotation.x = Math.PI / 2;
  envScene.add(groundBounce);

  const key = new THREE.PointLight(0xfff4e0, 520, 0, 0);
  key.position.set(4, 8, 5);
  envScene.add(key);
  const fill = new THREE.PointLight(0x88aaff, 240, 0, 0);
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
  scene.background = new THREE.Color(0x090b10);
  scene.fog = new THREE.FogExp2(0x0a0d14, 0.012);

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
  renderer.setClearColor(0x090b10, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.style.cursor = 'grab';

  scene.environment = makeStudioEnvironment(renderer);

  scene.add(new THREE.HemisphereLight(0xc5d4e8, 0x1a1612, 0.42));

  const key = new THREE.DirectionalLight(0xffe8c8, 1.55);
  key.position.set(14, 26, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 100;
  key.shadow.camera.left = -45;
  key.shadow.camera.right = 45;
  key.shadow.camera.top = 38;
  key.shadow.camera.bottom = -38;
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.035;
  key.shadow.radius = 2.5;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x7fa0d0, 0.38);
  fill.position.set(-14, 10, -8);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xdde8ff, 0.22);
  rim.position.set(0, 8, -18);
  scene.add(rim);

  // Soft ambient bounce over the lot (steady)
  const pool = new THREE.PointLight(0xffc98a, 10, 36, 2);
  pool.position.set(0, 9, 0);
  scene.add(pool);

  populateCityBlock(scene, renderer);

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

  // Soft street lamps with downward spot pools
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x2a2e36, metalness: 0.85, roughness: 0.35 });
  const lampGlowMat = new THREE.MeshStandardMaterial({
    color: 0xffe8c0,
    emissive: 0xffd090,
    emissiveIntensity: 0.85,
    roughness: 0.35,
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
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.7), lampMat);
    arm.position.set(lx + (lx < 0 ? 0.25 : -0.25), 5.15, lz);
    scene.add(arm);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 14), lampGlowMat);
    lamp.position.set(lx + (lx < 0 ? 0.45 : -0.45), 5.05, lz);
    scene.add(lamp);
    const spot = new THREE.SpotLight(0xffc98a, 28, 22, Math.PI / 4.2, 0.55, 1.4);
    spot.position.set(lx + (lx < 0 ? 0.45 : -0.45), 5.0, lz);
    spot.target.position.set(lx * 0.35, 0, lz * 0.35);
    scene.add(spot);
    scene.add(spot.target);
  });

  const carPalettes = [
    { body: 0x1a1d24, accent: 0x0a0a0c, glass: 0x6a8498 },
    { body: 0xd5d8de, accent: 0x8a8e96, glass: 0x7a96aa },
    { body: 0x7a1515, accent: 0x3a0a0a, glass: 0x5a7488 },
    { body: 0x1e2f42, accent: 0x101820, glass: 0x6a8498 },
    { body: 0xcfcabf, accent: 0x8a867c, glass: 0x88a0b0 },
    { body: 0x222222, accent: 0x0d0d0d, glass: 0x5a7488 },
    { body: 0x2f4a34, accent: 0x17241a, glass: 0x6a8498 },
    { body: 0xa05a28, accent: 0x5a3010, glass: 0x7a96aa },
  ];

  function makeCar(palette) {
    const car = new THREE.Group();
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: palette.body,
      roughness: 0.18,
      metalness: 0.85,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.35,
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: palette.accent,
      roughness: 0.35,
      metalness: 0.7,
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: palette.glass || 0x6a8498,
      roughness: 0.04,
      metalness: 0.2,
      transparent: true,
      opacity: 0.42,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      transmission: 0.35,
      thickness: 0.4,
      envMapIntensity: 1.4,
      ior: 1.4,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xd8dce2,
      roughness: 0.08,
      metalness: 1,
      envMapIntensity: 1.5,
    });
    const rubberMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.95,
      metalness: 0.02,
    });

    const rocker = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.18, 3.72), darkMat);
    rocker.position.y = 0.26;
    rocker.castShadow = true;

    const lower = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.5, 3.58), bodyMat);
    lower.position.y = 0.52;
    lower.castShadow = true;
    lower.receiveShadow = true;

    const belt = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.08, 3.4), bodyMat);
    belt.position.y = 0.78;
    belt.castShadow = true;

    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.1, 1.05), bodyMat);
    hood.position.set(0, 0.82, 1.0);
    hood.rotation.x = 0.04;
    hood.castShadow = true;

    const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.1, 0.7), bodyMat);
    trunk.position.set(0, 0.8, -1.35);
    trunk.castShadow = true;

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.5, 1.55), bodyMat);
    cabin.position.set(0, 1.02, -0.12);
    cabin.castShadow = true;

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.06, 1.25), bodyMat);
    roof.position.set(0, 1.3, -0.18);
    roof.castShadow = true;

    const aPillarL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.08), darkMat);
    aPillarL.position.set(-0.68, 1.02, 0.55);
    aPillarL.rotation.x = -0.35;
    const aPillarR = aPillarL.clone();
    aPillarR.position.x = 0.68;

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.46, 0.05), glassMat);
    windshield.position.set(0, 1.02, 0.62);
    windshield.rotation.x = -0.48;

    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.4, 0.05), glassMat);
    rearGlass.position.set(0, 1.0, -0.95);
    rearGlass.rotation.x = 0.38;

    const sideGlassL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.34, 1.05), glassMat);
    sideGlassL.position.set(-0.72, 1.02, -0.12);
    const sideGlassR = sideGlassL.clone();
    sideGlassR.position.x = 0.72;

    const hlMat = new THREE.MeshStandardMaterial({
      color: 0xfff8e8,
      emissive: 0xffe6a8,
      emissiveIntensity: 1.15,
      roughness: 0.2,
      metalness: 0.3,
    });
    const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.1), hlMat);
    hlL.position.set(-0.55, 0.5, 1.82);
    const hlR = hlL.clone();
    hlR.position.x = 0.55;

    const hlConeMat = new THREE.MeshBasicMaterial({
      color: 0xfff0c8,
      transparent: true,
      opacity: 0.05,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const hlConeL = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.4, 16, 1, true), hlConeMat);
    hlConeL.rotation.x = Math.PI / 2;
    hlConeL.position.set(-0.55, 0.45, 3.0);
    const hlConeR = hlConeL.clone();
    hlConeR.position.x = 0.55;

    const tlMat = new THREE.MeshStandardMaterial({
      color: 0xff1e1e,
      emissive: 0xff0000,
      emissiveIntensity: 0.85,
      roughness: 0.3,
    });
    const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.08), tlMat);
    tlL.position.set(-0.52, 0.56, -1.82);
    const tlR = tlL.clone();
    tlR.position.x = 0.52;

    const bumperF = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.18, 0.22), darkMat);
    bumperF.position.set(0, 0.28, 1.9);
    const bumperR = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.18, 0.22), darkMat);
    bumperR.position.set(0, 0.28, -1.9);

    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.06), chromeMat);
    grille.position.set(0, 0.42, 1.88);

    const mirrorL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.1), darkMat);
    mirrorL.position.set(-0.95, 0.9, 0.42);
    const mirrorGlassL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.02), chromeMat);
    mirrorGlassL.position.set(-1.02, 0.9, 0.42);
    const mirrorR = mirrorL.clone();
    mirrorR.position.x = 0.95;
    const mirrorGlassR = mirrorGlassL.clone();
    mirrorGlassR.position.x = 1.02;

    const wheels = [];
    const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 32);
    const hubGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.28, 20);
    const rimSpokeGeo = new THREE.BoxGeometry(0.04, 0.02, 0.22);
    const positions = [
      [-0.82, 0.34, 1.12],
      [0.82, 0.34, 1.12],
      [-0.82, 0.34, -1.12],
      [0.82, 0.34, -1.12],
    ];
    positions.forEach(([wx, wy, wz], idx) => {
      const wheel = new THREE.Group();
      const tire = new THREE.Mesh(wheelGeo, rubberMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      const hub = new THREE.Mesh(hubGeo, chromeMat);
      hub.rotation.z = Math.PI / 2;
      wheel.add(tire, hub);
      for (let s = 0; s < 5; s++) {
        const spoke = new THREE.Mesh(rimSpokeGeo, chromeMat);
        spoke.rotation.z = Math.PI / 2;
        spoke.rotation.x = (s / 5) * Math.PI * 2;
        wheel.add(spoke);
      }
      wheel.position.set(wx, wy, wz);
      wheel.userData.spin = tire;
      wheel.userData.isFront = idx < 2;
      car.add(wheel);
      wheels.push(wheel);
    });

    const contact = new THREE.Mesh(
      new THREE.CircleGeometry(1.05, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false })
    );
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = 0.02;

    car.add(
      rocker,
      lower,
      belt,
      hood,
      trunk,
      cabin,
      roof,
      aPillarL,
      aPillarR,
      windshield,
      rearGlass,
      sideGlassL,
      sideGlassR,
      hlL,
      hlR,
      hlConeL,
      hlConeR,
      tlL,
      tlR,
      bumperF,
      bumperR,
      grille,
      mirrorL,
      mirrorGlassL,
      mirrorR,
      mirrorGlassR,
      contact
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
      roughness: 0.72,
      metalness: 0.04,
    });
    const shirt = new THREE.MeshStandardMaterial({
      color: palette.shirt,
      roughness: 0.78,
      metalness: 0.02,
    });
    const pants = new THREE.MeshStandardMaterial({
      color: palette.pants,
      roughness: 0.84,
      metalness: 0.02,
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: palette.hair || 0x1a1410,
      roughness: 0.9,
    });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.5, 16), shirt);
    torso.position.y = 1.12;
    torso.castShadow = true;

    const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), shirt);
    shoulders.scale.set(1.15, 0.55, 0.75);
    shoulders.position.y = 1.34;
    shoulders.castShadow = true;

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 10), skin);
    neck.position.y = 1.46;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 18, 16), skin);
    head.position.y = 1.62;
    head.scale.set(0.95, 1.05, 0.92);
    head.castShadow = true;

    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 12), hairMat);
    hair.position.y = 1.68;
    hair.scale.set(1.0, 0.72, 1.05);

    const hip = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.15, 0.18, 12), pants);
    hip.position.y = 0.82;
    hip.castShadow = true;

    const armL = new THREE.Group();
    const upperArmL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.28, 10), shirt);
    upperArmL.position.y = -0.12;
    const foreArmL = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.038, 0.26, 10), skin);
    foreArmL.position.y = -0.36;
    const handL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), skin);
    handL.position.y = -0.5;
    armL.add(upperArmL, foreArmL, handL);
    armL.position.set(-0.24, 1.28, 0);

    const armR = armL.clone();
    armR.position.x = 0.24;

    const legL = new THREE.Group();
    const thighL = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.34, 10), pants);
    thighL.position.y = -0.14;
    const shinL = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.32, 10), pants);
    shinL.position.y = -0.44;
    const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.2), shoeMat);
    shoeL.position.set(0, -0.62, 0.03);
    legL.add(thighL, shinL, shoeL);
    legL.position.set(-0.09, 0.72, 0);

    const legR = legL.clone();
    legR.position.x = 0.09;

    person.add(torso, shoulders, neck, head, hair, hip, armL, armR, legL, legR);
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
    const hairColors = [0x1a1410, 0x2c1a10, 0x3b2a1a, 0x111111, 0x5a4030, 0xc8b08a];
    const person = makePerson({
      skin: skinTones[Math.floor(Math.random() * skinTones.length)],
      shirt: shirtColors[Math.floor(Math.random() * shirtColors.length)],
      pants: pantColors[Math.floor(Math.random() * pantColors.length)],
      hair: hairColors[Math.floor(Math.random() * hairColors.length)],
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

  for (let i = 0; i < 14; i++) spawnPerson(i % walkRoutes.length);

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

function finalizeTexture(tex, renderer, repeatX, repeatY = repeatX) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  const maxAniso = renderer.capabilities.getMaxAnisotropy?.() ?? 8;
  tex.anisotropy = Math.min(16, maxAniso);
  return tex;
}

function makeNightSkyTexture() {
  const w = 1024;
  const h = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#06080f');
  grad.addColorStop(0.45, '#0b1018');
  grad.addColorStop(1, '#0b0d12');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 420; i++) {
    const a = 0.25 + Math.random() * 0.75;
    const r = Math.random() * 1.4 + 0.2;
    ctx.fillStyle = `rgba(230,240,255,${a})`;
    ctx.beginPath();
    ctx.arc(Math.random() * w, Math.random() * h * 0.65, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addSkyDome(scene) {
  const skyTex = makeNightSkyTexture();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(130, 40, 24),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })
  );
  scene.add(sky);
}

function makeStreetTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#232830';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 12000; i++) {
    const g = 28 + Math.random() * 22;
    ctx.fillStyle = `rgba(${g},${g + 2},${g + 5},${0.08 + Math.random() * 0.2})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1);
  }
  for (let i = 0; i < 35; i++) {
    ctx.fillStyle = `rgba(10,12,16,${0.08 + Math.random() * 0.12})`;
    ctx.beginPath();
    ctx.ellipse(Math.random() * size, Math.random() * size, 8 + Math.random() * 18, 4 + Math.random() * 10, Math.random(), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * size, Math.random() * size);
    ctx.lineTo(Math.random() * size, Math.random() * size);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(c);
}

function makeSidewalkTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#6f6b65';
  ctx.fillRect(0, 0, size, size);
  const tile = 64;
  for (let y = 0; y < size; y += tile) {
    for (let x = 0; x < size; x += tile) {
      const n = 2 + Math.random() * 5;
      ctx.fillStyle = `rgb(${108 + n},${104 + n},${98 + n})`;
      ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= size; i += tile) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(c);
}

function makeFacadeTexture(tint, seed) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const r = (tint >> 16) & 255;
  const g = (tint >> 8) & 255;
  const b = tint & 255;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, size, size);
  const rng = (n) => {
    seed = (seed * 1103515245 + 12345 + n) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let y = 0; y < size; y += 16) {
    for (let x = 0; x < size; x += 32) {
      const d = (rng(x + y) - 0.5) * 18;
      ctx.fillStyle = `rgb(${Math.max(0, r + d)},${Math.max(0, g + d)},${Math.max(0, b + d)})`;
      ctx.fillRect(x, y, 30, 14);
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  for (let y = 16; y < size; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addCrosswalk(scene, x, z, span, width, alongX) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xeeeadf, roughness: 0.88, metalness: 0.02 });
  const stripes = 7;
  const gap = span / stripes;
  for (let i = 0; i < stripes; i += 2) {
    const stripe = new THREE.Mesh(
      alongX ? new THREE.BoxGeometry(gap * 0.55, 0.024, width) : new THREE.BoxGeometry(width, 0.024, gap * 0.55),
      mat
    );
    if (alongX) stripe.position.set(x - span / 2 + gap * (i + 0.5), 0.028, z);
    else stripe.position.set(x, 0.028, z - span / 2 + gap * (i + 0.5));
    stripe.receiveShadow = true;
    scene.add(stripe);
  }
}

function addStreetTree(scene, x, z) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.16, 1.6, 8),
    new THREE.MeshStandardMaterial({ color: 0x4a3428, roughness: 0.9 })
  );
  trunk.position.y = 0.8;
  trunk.castShadow = true;
  group.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f5a3a, roughness: 0.82, metalness: 0.02 });
  [[0, 2.1, 0, 0.85], [-0.35, 1.9, 0.2, 0.55], [0.3, 1.85, -0.25, 0.5]].forEach(([lx, ly, lz, s]) => {
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), leafMat);
    crown.position.set(lx, ly, lz);
    crown.castShadow = true;
    group.add(crown);
  });
  group.position.set(x, 0, z);
  scene.add(group);
}

function addBench(scene, x, z, rotY = 0) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x5c4a38, roughness: 0.85 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2e36, metalness: 0.8, roughness: 0.35 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.45), wood);
  seat.position.y = 0.52;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.52, 0.08), metal);
  legL.position.set(-0.55, 0.26, 0);
  const legR = legL.clone();
  legR.position.x = 0.55;
  g.add(seat, legL, legR);
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  scene.add(g);
}

function addHydrant(scene, x, z) {
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.14, 0.55, 10),
    new THREE.MeshStandardMaterial({ color: 0xb83232, roughness: 0.55, metalness: 0.2 })
  );
  body.position.set(x, 0.28, z);
  body.castShadow = true;
  scene.add(body);
}

function addParkingSign(scene, x, z, rotY = 0) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.07, 2.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a3f48, metalness: 0.75, roughness: 0.35 })
  );
  pole.position.y = 1.2;
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.9, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x1a5caa, roughness: 0.45, metalness: 0.15 })
  );
  board.position.y = 2.15;
  const pMark = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.45, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xf2f4f8, emissive: 0xdce6f5, emissiveIntensity: 0.25 })
  );
  pMark.position.set(0, 2.15, 0.04);
  g.add(pole, board, pMark);
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  scene.add(g);
}

function addBusShelter(scene, x, z, rotY = 0) {
  const g = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: 0x3a404a, metalness: 0.7, roughness: 0.35 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x9eb4c8,
    transparent: true,
    opacity: 0.45,
    roughness: 0.08,
    metalness: 0.35,
    clearcoat: 1,
  });
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 1.4), frame);
  roof.position.y = 2.35;
  const postL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.35, 0.08), frame);
  postL.position.set(-1.45, 1.17, 0.55);
  const postR = postL.clone();
  postR.position.x = 1.45;
  const panel = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 0.06), glass);
  panel.position.set(0, 1.25, 0.62);
  const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.35), new THREE.MeshStandardMaterial({ color: 0x5c4a38 }));
  bench.position.set(0, 0.55, 0.2);
  g.add(roof, postL, postR, panel, bench);
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  scene.add(g);
}

function populateCityBlock(scene, renderer) {
  const asphaltTex = finalizeTexture(makeAsphaltTexture(), renderer, 8, 8);
  const streetTex = finalizeTexture(makeStreetTexture(), renderer, 14, 10);
  const walkTex = finalizeTexture(makeSidewalkTexture(), renderer, 10, 10);

  addSkyDome(scene);

  const moon = new THREE.DirectionalLight(0xa8bdd8, 0.24);
  moon.position.set(-28, 42, -32);
  scene.add(moon);

  const cityGround = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 150),
    new THREE.MeshStandardMaterial({ color: 0x10141c, roughness: 0.98, metalness: 0.01 })
  );
  cityGround.rotation.x = -Math.PI / 2;
  cityGround.position.y = -0.03;
  cityGround.receiveShadow = true;
  scene.add(cityGround);

  const street = new THREE.Mesh(
    new THREE.PlaneGeometry(76, 58),
    new THREE.MeshStandardMaterial({ map: streetTex, color: 0xb8bcc4, roughness: 0.94, metalness: 0.03 })
  );
  street.rotation.x = -Math.PI / 2;
  street.position.y = 0.001;
  street.receiveShadow = true;
  scene.add(street);

  const lotPad = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 22),
    new THREE.MeshStandardMaterial({
      map: asphaltTex,
      color: 0xd0d4dc,
      roughness: 0.78,
      metalness: 0.12,
      envMapIntensity: 1.1,
    })
  );
  lotPad.rotation.x = -Math.PI / 2;
  lotPad.position.y = 0.018;
  lotPad.receiveShadow = true;
  scene.add(lotPad);

  // Subtle wet asphalt sheen (single plane, no z-fight stack)
  const wetSheen = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 22),
    new THREE.MeshPhysicalMaterial({
      color: 0x10141c,
      roughness: 0.18,
      metalness: 0.35,
      transparent: true,
      opacity: 0.18,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.2,
      depthWrite: false,
    })
  );
  wetSheen.rotation.x = -Math.PI / 2;
  wetSheen.position.y = 0.022;
  scene.add(wetSheen);

  const walkMat = new THREE.MeshStandardMaterial({ map: walkTex, roughness: 0.94, metalness: 0.0 });
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x8a857c, roughness: 0.88, metalness: 0.04 });

  function addWalkStrip(w, d, x, z) {
    const slab = new THREE.Mesh(new THREE.PlaneGeometry(w, d), walkMat);
    slab.rotation.x = -Math.PI / 2;
    slab.position.set(x, 0.042, z);
    slab.receiveShadow = true;
    scene.add(slab);
  }

  function addCurb(w, d, x, z) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, d), curbMat);
    curb.position.set(x, 0.07, z);
    curb.receiveShadow = true;
    curb.castShadow = true;
    scene.add(curb);
  }

  addWalkStrip(38, 2.2, 0, -12.3);
  addWalkStrip(38, 2.2, 0, 12.3);
  addWalkStrip(2.2, 22, -18, 0);
  addWalkStrip(2.2, 22, 18, 0);
  addWalkStrip(68, 2.0, 0, -26.2);
  addWalkStrip(68, 2.0, 0, 26.2);
  addWalkStrip(2.0, 52, -33.5, 0);
  addWalkStrip(2.0, 52, 33.5, 0);

  addCurb(38.4, 0.18, 0, -11.15);
  addCurb(38.4, 0.18, 0, 11.15);
  addCurb(0.18, 22.4, -17.05, 0);
  addCurb(0.18, 22.4, 17.05, 0);

  const laneMat = new THREE.MeshStandardMaterial({ color: 0xe8e2c8, roughness: 0.72, metalness: 0.04 });
  const centerLaneMat = new THREE.MeshStandardMaterial({ color: 0xd4b84a, roughness: 0.68, metalness: 0.05 });

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

  addLaneDashes('x', -19.2, -30, 30, 2.5, 1.15, centerLaneMat);
  addLaneDashes('x', 19.2, -30, 30, 2.5, 1.15, centerLaneMat);
  addLaneDashes('z', -24.8, -16, 16, 2.5, 1.15, centerLaneMat);
  addLaneDashes('z', 24.8, -16, 16, 2.5, 1.15, centerLaneMat);
  addLaneDashes('x', -13.6, -15, 15, 3.4, 1.5, laneMat);
  addLaneDashes('x', 13.6, -15, 15, 3.4, 1.5, laneMat);

  addCrosswalk(scene, -18, -19.4, 3.2, 2.0, true);
  addCrosswalk(scene, 18, -19.4, 3.2, 2.0, true);
  addCrosswalk(scene, -18, 19.4, 3.2, 2.0, true);
  addCrosswalk(scene, 18, 19.4, 3.2, 2.0, true);
  addCrosswalk(scene, -24.6, -8, 2.8, 2.0, false);
  addCrosswalk(scene, 24.6, 8, 2.8, 2.0, false);

  const buildingPalette = [
    { wall: 0x3a4250, accent: 0x262c36, glass: 0x9ec4d8, awning: 0x8b3a3a },
    { wall: 0x454c58, accent: 0x2d333d, glass: 0xa8cde0, awning: 0x2f5a8a },
    { wall: 0x4a433c, accent: 0x322c27, glass: 0xb0c6d4, awning: 0x3d6b45 },
    { wall: 0x3f4754, accent: 0x282f39, glass: 0x8eb6cc, awning: 0x7a4a8a },
    { wall: 0x4b515c, accent: 0x323740, glass: 0xa2c0d0, awning: 0x8a6a2a },
  ];

  function makeBuilding(spec) {
    const { w, h, d, x, z, p, style = 'office', rotY = 0 } = spec;
    const palette = buildingPalette[p % buildingPalette.length];
    const seed = ((x * 17) ^ (z * 31)) | 0;
    const group = new THREE.Group();
    const facade = makeFacadeTexture(palette.wall, seed);
    finalizeTexture(facade, renderer, 2, 2);

    const wallMat = new THREE.MeshStandardMaterial({
      map: facade,
      roughness: 0.82,
      metalness: 0.1,
      envMapIntensity: 0.65,
    });
    const accentMat = new THREE.MeshStandardMaterial({ color: palette.accent, roughness: 0.78, metalness: 0.12 });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: palette.glass,
      emissive: palette.glass,
      emissiveIntensity: 0.38,
      roughness: 0.18,
      metalness: 0.45,
      clearcoat: 0.6,
      transparent: true,
      opacity: 0.92,
    });

    const bodyH = style === 'shop' ? h * 0.72 : h;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, bodyH, d), wallMat);
    body.position.y = bodyH / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    if (style === 'tower') {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, h * 0.28, d * 0.72), accentMat);
      cap.position.y = bodyH + h * 0.14;
      cap.castShadow = true;
      group.add(cap);
    }

    if (style === 'shop') {
      const storefront = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, h * 0.55, 0.08), glassMat);
      storefront.position.set(0, h * 0.28, d / 2 + 0.05);
      group.add(storefront);
      const awning = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.92, 0.12, 0.9),
        new THREE.MeshStandardMaterial({ color: palette.awning, roughness: 0.75 })
      );
      awning.position.set(0, h * 0.58, d / 2 + 0.35);
      awning.rotation.x = -0.12;
      group.add(awning);
    }

    const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.38, d + 0.4), accentMat);
    base.position.y = 0.19;
    base.receiveShadow = true;
    group.add(base);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.24, d * 0.96), accentMat);
    roof.position.y = (style === 'tower' ? bodyH + h * 0.28 : bodyH) + 0.08;
    roof.castShadow = true;
    group.add(roof);

    for (let u = 0; u < 2; u++) {
      const ac = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 0.7), accentMat);
      ac.position.set(-w / 4 + u * (w / 2), roof.position.y + 0.35, 0);
      ac.castShadow = true;
      group.add(ac);
    }

    const cols = Math.max(3, Math.floor(w / 2.2));
    const rows = Math.max(3, Math.floor(bodyH / 2.4));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = (seed + r * 13 + c * 7) % 5 !== 0;
        if (!lit && style !== 'shop') continue;
        const win = new THREE.Mesh(
          new THREE.PlaneGeometry(Math.min(0.95, w / cols) * 0.68, Math.min(1.2, bodyH / rows) * 0.62),
          glassMat.clone()
        );
        if (!lit) {
          win.material.emissiveIntensity = 0.08;
          win.material.opacity = 0.35;
        }
        const wx = -w / 2 + 0.85 + c * ((w - 1.7) / Math.max(cols - 1, 1));
        const wy = 1.35 + r * ((bodyH - 2.2) / Math.max(rows - 1, 1));
        win.position.set(wx, wy, d / 2 + 0.03);
        group.add(win);
      }
    }

    group.position.set(x, 0, z);
    group.rotation.y = rotY;
    scene.add(group);
  }

  [
    { w: 16, h: 12, d: 8, x: -10, z: -32, p: 0, style: 'office' },
    { w: 12, h: 18, d: 8, x: 12, z: -33, p: 1, style: 'tower' },
    { w: 11, h: 8, d: 9, x: 28, z: -30, p: 2, style: 'shop' },
    { w: 12, h: 14, d: 8, x: 36, z: -12, p: 3, style: 'office' },
    { w: 10, h: 11, d: 8, x: 35, z: 8, p: 4, style: 'shop' },
    { w: 14, h: 13, d: 8, x: 28, z: 30, p: 0, style: 'office' },
    { w: 12, h: 11, d: 8, x: 8, z: 33, p: 1, style: 'shop' },
    { w: 12, h: 16, d: 8, x: -12, z: 33, p: 2, style: 'tower' },
    { w: 10, h: 10, d: 7, x: -28, z: 28, p: 3, style: 'office' },
    { w: 12, h: 12, d: 8, x: -36, z: 6, p: 4, style: 'office' },
    { w: 11, h: 17, d: 8, x: -35, z: -12, p: 0, style: 'tower' },
    { w: 10, h: 9, d: 7, x: -26, z: -30, p: 1, style: 'shop' },
    { w: 9, h: 14, d: 7, x: 40, z: 22, p: 2, style: 'office' },
    { w: 8, h: 10, d: 7, x: -40, z: -24, p: 3, style: 'shop' },
  ].forEach(makeBuilding);

  [-24, -8, 8, 24].forEach((tx) => addStreetTree(scene, tx, -27.8));
  [-20, 0, 20].forEach((tz) => addStreetTree(scene, -34.8, tz));
  [24, 8, -8, -24].forEach((tx) => addStreetTree(scene, tx, 27.8));
  [20, 0, -20].forEach((tz) => addStreetTree(scene, 34.8, tz));

  addBench(scene, -15.5, -12.8, 0);
  addBench(scene, 15.5, 12.8, Math.PI);
  addBench(scene, -33, 4, Math.PI / 2);
  addBench(scene, 33, -6, -Math.PI / 2);
  addHydrant(scene, -20.5, -13.2);
  addHydrant(scene, 20.5, 13.2);
  addHydrant(scene, -34.2, -10);
  addParkingSign(scene, -14, -11.2, 0);
  addParkingSign(scene, 14, 11.2, Math.PI);
  addBusShelter(scene, -30, -26.5, 0);
  addBusShelter(scene, 30, 26.5, Math.PI);
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
