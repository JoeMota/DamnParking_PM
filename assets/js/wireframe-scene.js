/**
 * Damn Parking - 3D wireframe of a possible phone UI flow.
 * Login and sign up on the left, available spots in the middle, notify on the right.
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

const PHONE = { w: 1.9, h: 3.72, d: 0.18 };
const FACE = PHONE.d / 2 + 0.02;

const COL = {
  body: 0xd5deea,
  screen: 0x93a0b3,
  field: 0xb7c3d4,
  title: 0x8eb6ff,
  titleCss: '#8eb6ff',
  textCss: '#d5deea',
  mutedCss: '#b7c3d4',
  banner: 0x3ddc84,
  bannerCss: '#c9f7dc',
  check: 0x3ddc84,
  pin: 0xff4d4d,
  button: 0x5eb6ff,
  flow: 0x7aa2ff,
  dash: 0x69b2ff,
  floor: 0x2a3548,
  labelCss: '#b9d0ff',
};

const DEFAULT_THETA = 0.38;
const DEFAULT_PHI = 1.16;
const MIN_RADIUS = 5;
const MAX_RADIUS = 48;

function boot(root) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x121722);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.08, 500);
  const target = new THREE.Vector3();
  const homeTarget = new THREE.Vector3();
  const camState = { theta: DEFAULT_THETA, phi: DEFAULT_PHI, radius: 18 };
  const camGoal = { theta: DEFAULT_THETA, phi: DEFAULT_PHI, radius: 18 };

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      failIfMajorPerformanceCaveat: false,
    });
  } catch (err) {
    console.warn('Damn Parking wireframe unavailable:', err);
    showFallback(root, '3D wireframe needs WebGL in this browser. The flat flowchart is shown instead.');
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x121722, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  root.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.style.cursor = 'grab';
  renderer.domElement.setAttribute('data-wireframe-gl', '1');

  const fitRoot = new THREE.Group();
  fitRoot.name = 'wireframe-flow';
  scene.add(fitRoot);

  const phones = {};
  const specs = [
    { key: 'login', label: 'Login', x: -5.05, y: 2.4, z: 0.45, build: buildLogin },
    { key: 'signup', label: 'Sign up', x: -5.15, y: -2.9, z: -0.55, build: buildSignup, captionX: -1.25 },
    { key: 'spots', label: 'Available spots', x: 0.15, y: 2.5, z: 0.75, build: buildSpots },
    { key: 'augmented', label: 'Augmented view', x: 0.05, y: -2.75, z: -0.2, build: buildAugmented, captionX: -1.7 },
    { key: 'notify', label: 'Notify', x: 5.25, y: 0.05, z: 0.25, build: buildNotify },
  ];

  specs.forEach((spec) => {
    const phone = makePhone();
    phone.name = spec.key;
    phone.position.set(spec.x, spec.y, spec.z);
    spec.build(phone);
    caption(phone, spec.label, spec.captionX || 0);
    fitRoot.add(phone);
    phones[spec.key] = phone;
  });

  fitRoot.updateMatrixWorld(true);
  layoutArrows(fitRoot, phones);
  addFloor(scene);

  const fitBox = new THREE.Box3().setFromObject(fitRoot);
  const fitSphere = fitBox.getBoundingSphere(new THREE.Sphere());
  homeTarget.copy(fitSphere.center);
  target.copy(homeTarget);

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = motionQuery.matches;
  const onMotion = (event) => {
    reduced = event.matches;
  };
  if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotion);
  else if (motionQuery.addListener) motionQuery.addListener(onMotion);

  let userDragged = false;
  let zoomTouched = false;
  const pointers = new Map();
  const drag = { active: false, x: 0, y: 0, pan: false };
  let pinchDist = 0;

  function fitRadius() {
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const aspect = Math.max(camera.aspect, 0.45);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const half = Math.min(vFov, hFov) / 2;
    return THREE.MathUtils.clamp((fitSphere.radius / Math.sin(half)) * 0.96, MIN_RADIUS, MAX_RADIUS);
  }

  function applyFit(force) {
    const next = fitRadius();
    if (force || !zoomTouched) {
      camGoal.radius = next;
      camState.radius = next;
    }
  }

  function resize() {
    const width = root.clientWidth;
    const height = root.clientHeight;
    if (width < 2 || height < 2) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    applyFit(false);
  }

  function zoomBy(factor) {
    zoomTouched = true;
    const next = THREE.MathUtils.clamp(camState.radius * factor, MIN_RADIUS, MAX_RADIUS);
    camGoal.radius = next;
    camState.radius = next;
  }

  function resetView() {
    userDragged = false;
    zoomTouched = false;
    camGoal.theta = DEFAULT_THETA;
    camGoal.phi = DEFAULT_PHI;
    camState.theta = DEFAULT_THETA;
    camState.phi = DEFAULT_PHI;
    target.copy(homeTarget);
    applyFit(true);
  }

  function panBy(dx, dy) {
    const forward = target.clone().sub(camera.position);
    if (forward.lengthSq() < 1e-6) return;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();
    const scale = camera.position.distanceTo(target) * 0.0015;
    target.addScaledVector(right, -dx * scale);
    target.addScaledVector(up, dy * scale);
  }

  function pointerSpan() {
    const pts = [...pointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  function onPointerDown(event) {
    if (event.button !== undefined && event.button > 2) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2) {
      drag.active = false;
      pinchDist = pointerSpan();
      return;
    }
    drag.active = true;
    drag.x = event.clientX;
    drag.y = event.clientY;
    drag.pan = event.shiftKey || event.altKey || event.button === 1 || event.button === 2;
    renderer.domElement.style.cursor = 'grabbing';
    try {
      renderer.domElement.setPointerCapture(event.pointerId);
    } catch (err) {
      /* Untrusted events have no active pointer. Real drags still capture. */
    }
  }

  function onPointerMove(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2) {
      const dist = pointerSpan();
      if (pinchDist > 0 && dist > 0) {
        zoomTouched = true;
        const next = THREE.MathUtils.clamp(camState.radius * (pinchDist / dist), MIN_RADIUS, MAX_RADIUS);
        camGoal.radius = next;
        camState.radius = next;
      }
      pinchDist = dist;
      return;
    }
    if (!drag.active) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (Math.abs(dx) + Math.abs(dy) < 1) return;
    userDragged = true;
    if (drag.pan) {
      panBy(dx, dy);
      return;
    }
    camGoal.theta -= dx * 0.0052;
    camGoal.phi = THREE.MathUtils.clamp(camGoal.phi + dy * 0.004, 0.35, 2.35);
  }

  function onPointerUp(event) {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinchDist = 0;
    if (pointers.size === 0) {
      drag.active = false;
      renderer.domElement.style.cursor = 'grab';
    }
    try {
      renderer.domElement.releasePointerCapture(event.pointerId);
    } catch (err) {
      /* ignore */
    }
  }

  function onWheel(event) {
    event.preventDefault();
    zoomTouched = true;
    const delta = Math.sign(event.deltaY) * Math.min(Math.abs(event.deltaY), 90);
    const next = THREE.MathUtils.clamp(camState.radius + delta * 0.014, MIN_RADIUS, MAX_RADIUS);
    camGoal.radius = next;
    camState.radius = next;
  }

  function onKeyDown(event) {
    const step = 0.09;
    if (event.key === 'ArrowLeft') {
      userDragged = true;
      camGoal.theta += step;
    } else if (event.key === 'ArrowRight') {
      userDragged = true;
      camGoal.theta -= step;
    } else if (event.key === 'ArrowUp') {
      userDragged = true;
      camGoal.phi = THREE.MathUtils.clamp(camGoal.phi - step, 0.35, 2.35);
    } else if (event.key === 'ArrowDown') {
      userDragged = true;
      camGoal.phi = THREE.MathUtils.clamp(camGoal.phi + step, 0.35, 2.35);
    } else if (event.key === '+' || event.key === '=') {
      zoomBy(0.78);
    } else if (event.key === '-' || event.key === '_') {
      zoomBy(1.28);
    } else if (event.key === '0' || event.key === 'Home') {
      resetView();
    } else {
      return;
    }
    event.preventDefault();
  }

  function onContextMenu(event) {
    event.preventDefault();
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointercancel', onPointerUp);
  renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
  renderer.domElement.addEventListener('contextmenu', onContextMenu);
  root.tabIndex = 0;
  root.addEventListener('keydown', onKeyDown);

  document.getElementById('wireframe-zoom-in')?.addEventListener('click', () => zoomBy(0.78));
  document.getElementById('wireframe-zoom-out')?.addEventListener('click', () => zoomBy(1.28));
  document.getElementById('wireframe-reset')?.addEventListener('click', () => resetView());

  resize();
  const observer = new ResizeObserver(() => resize());
  observer.observe(root);
  window.addEventListener('resize', resize);

  window.__wireframeView = () => ({
    radius: camState.radius,
    theta: camState.theta,
    phi: camState.phi,
    x: camera.position.x,
    y: camera.position.y,
    z: camera.position.z,
    tx: target.x,
    ty: target.y,
    tz: target.z,
  });

  const clock = new THREE.Clock();

  function placeCamera(dt) {
    if (!reduced && !userDragged && !drag.active && pointers.size < 2) {
      camGoal.theta += dt * 0.12;
    }
    const damp = 1 - Math.exp(-dt * 7);
    camState.theta += (camGoal.theta - camState.theta) * damp;
    camState.phi += (camGoal.phi - camState.phi) * damp;
    camState.radius += (camGoal.radius - camState.radius) * damp;

    const sinPhi = Math.sin(camState.phi);
    camera.position.set(
      target.x + camState.radius * sinPhi * Math.sin(camState.theta),
      target.y + camState.radius * Math.cos(camState.phi),
      target.z + camState.radius * sinPhi * Math.cos(camState.theta)
    );
    camera.lookAt(target);
    root.dataset.radius = camState.radius.toFixed(3);
    root.dataset.theta = camState.theta.toFixed(3);
  }

  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);
    placeCamera(dt);
    renderer.render(scene, camera);
    window.requestAnimationFrame(tick);
  }
  tick();
}

function showFallback(root, message) {
  root.classList.add('is-fallback');
  root.innerHTML = '';
  const img = document.createElement('img');
  img.src = '/assets/img/ui/wireframe.png';
  img.alt = 'Flat Damn Parking wireframe flowchart of the login, signup, available spots, and notify phones.';
  const note = document.createElement('p');
  note.textContent = message + ' This is a possible UI wireframe model, not a released app.';
  root.append(img, note);
}

function makePhone() {
  const group = new THREE.Group();
  const body = new THREE.BoxGeometry(PHONE.w, PHONE.h, PHONE.d);
  const edges = new THREE.EdgesGeometry(body, 1);
  group.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: COL.body })));
  body.dispose();
  addRect(group, 0, -0.04, PHONE.w - 0.16, PHONE.h - 0.46, COL.screen, FACE - 0.012);
  addCircle(group, 0, PHONE.h / 2 - 0.16, FACE, 0.045, COL.body);
  return group;
}

function caption(group, label, x = 0) {
  text(group, label, x, PHONE.h / 2 + 0.36, FACE + 0.08, {
    worldHeight: 0.28,
    color: COL.labelCss,
    weight: 650,
  });
}

function buildLogin(group) {
  const z = FACE;
  text(group, 'DAMNPARKING!', 0, 1.2, z, { worldHeight: 0.2, color: COL.titleCss });
  text(group, 'Login', 0, 0.78, z, { worldHeight: 0.16, color: COL.textCss });
  field(group, 0, 0.36, z, 'Username');
  field(group, 0, -0.04, z, 'Password');
  text(group, 'Are you new?', 0, -0.5, z, { worldHeight: 0.13, color: COL.mutedCss });
  text(group, 'Sign Up Here', 0, -0.74, z, { worldHeight: 0.14, color: COL.titleCss });
  addLine(group, [-0.38, -0.86, z, 0.38, -0.86, z], COL.title);
  parkingMark(group, 0, -1.28, z);
}

function buildSignup(group) {
  const z = FACE;
  text(group, 'WELCOME TO', 0, 1.38, z, { worldHeight: 0.13, color: COL.titleCss });
  text(group, 'DAMNPARKING!', 0, 1.14, z, { worldHeight: 0.18, color: COL.titleCss });
  text(group, 'Sign Up', 0, 0.78, z, { worldHeight: 0.15, color: COL.textCss });
  field(group, 0, 0.4, z, 'Email');
  field(group, 0, 0.02, z, 'Username');
  field(group, 0, -0.36, z, 'Password');
  text(group, 'Do you have an account?', 0, -0.78, z, { worldHeight: 0.12, color: COL.mutedCss });
  text(group, 'Login Here', 0, -1.02, z, { worldHeight: 0.14, color: COL.titleCss });
  addLine(group, [-0.32, -1.14, z, 0.32, -1.14, z], COL.title);
  parkingMark(group, 0, -1.46, z);
}

function buildSpots(group) {
  const z = FACE;
  banner(group, z);
  field(group, 0, 0.7, z, 'Search');
  text(group, 'Mike Loya Available Spots', 0, 0.38, z, { worldHeight: 0.12, color: COL.textCss });
  stallGrid(group, z, -0.22, false);
  bottomBar(group, z, 'Change to augmented view');
}

function buildAugmented(group) {
  const z = FACE;
  banner(group, z);
  field(group, 0, 0.7, z, 'Search');
  text(group, 'Mike Loya Available Spots', 0, 0.38, z, { worldHeight: 0.12, color: COL.textCss });
  augmentedLot(group, z);
  bottomBar(group, z, 'Change to map');
}

function buildNotify(group) {
  const z = FACE;
  text(group, 'Notify others', 0, 1.38, z, { worldHeight: 0.16, color: COL.titleCss });
  text(group, 'you are leaving your spot', 0, 1.14, z, { worldHeight: 0.12, color: COL.mutedCss });
  field(group, 0, 0.74, z, 'Spot Place');
  addRect(group, 0, 0.32, 1.42, 0.3, COL.button, z);
  text(group, 'Turn On Your Location', 0, 0.32, z + 0.02, { worldHeight: 0.11, color: '#d7ecff' });
  addLine(group, [-0.72, 0.04, z, 0.72, 0.04, z], COL.screen);
  text(group, 'Notifying other drivers,', 0, -0.18, z, { worldHeight: 0.12, color: COL.textCss });
  text(group, 'you are leaving this Spot', 0, -0.38, z, { worldHeight: 0.11, color: COL.mutedCss });
  stallGrid(group, z, -1.05, true);
}

function banner(parent, z) {
  addRect(parent, 0, 1.28, 1.55, 0.52, COL.banner, z);
  text(parent, 'Joe Mota just left his spot', 0, 1.36, z + 0.02, { worldHeight: 0.11, color: COL.bannerCss });
  text(parent, 'Schuster 1', 0, 1.18, z + 0.02, { worldHeight: 0.11, color: COL.bannerCss });
}

function field(parent, x, y, z, label) {
  addRect(parent, x, y, 1.4, 0.28, COL.field, z);
  text(parent, label, x, y, z + 0.02, { worldHeight: 0.12, color: COL.textCss });
}

function bottomBar(parent, z, label) {
  addRect(parent, 0, -1.46, 1.5, 0.28, COL.field, z);
  text(parent, label, 0, -1.46, z + 0.02, { worldHeight: 0.11, color: COL.textCss });
}

function stallGrid(parent, z, y0, withPin) {
  const cols = [-0.46, 0, 0.46];
  const rows = [0.28, -0.12, -0.52];
  rows.forEach((row, ri) => {
    cols.forEach((col, ci) => {
      const pinHere = withPin && ri === 0 && ci === 1;
      addCar(parent, col + 0.06, y0 + row, z, 0.72, COL.field);
      if (pinHere) addPin(parent, col - 0.12, y0 + row, z + 0.02);
      else addCheck(parent, col - 0.16, y0 + row, z, COL.check);
    });
  });
}

function augmentedLot(parent, z) {
  const rows = [
    { y: 0.08, w: 1.2, h: 0.22, s: 0.5 },
    { y: -0.28, w: 1.38, h: 0.28, s: 0.66 },
    { y: -0.72, w: 1.52, h: 0.32, s: 0.82 },
  ];
  rows.forEach((row) => {
    addRect(parent, 0, row.y, row.w, row.h, COL.field, z);
    addCar(parent, -row.w * 0.22, row.y, z + 0.01, row.s, COL.body);
    addCar(parent, row.w * 0.22, row.y, z + 0.01, row.s, COL.body);
  });
}

function parkingMark(parent, x, y, z) {
  const w = 0.82;
  const h = 0.42;
  addRect(parent, x, y, w, h, COL.body, z);
  addLine(parent, [x - w / 6, y - h / 2, z, x - w / 6, y + h / 2, z], COL.body);
  addLine(parent, [x + w / 6, y - h / 2, z, x + w / 6, y + h / 2, z], COL.body);
  const stemX = x - 0.07;
  addLine(parent, [stemX, y - 0.13, z, stemX, y + 0.13, z], COL.title);
  const arc = [];
  const cx = x - 0.02;
  const cy = y + 0.045;
  for (let i = 0; i <= 12; i += 1) {
    const a = Math.PI / 2 - (i / 12) * Math.PI;
    arc.push(new THREE.Vector3(cx + Math.cos(a) * 0.09, cy + Math.sin(a) * 0.085, z));
  }
  arc.unshift(new THREE.Vector3(stemX, y + 0.13, z));
  arc.push(new THREE.Vector3(stemX, y - 0.04, z));
  addPolyline(parent, arc, COL.title);
}

function addCar(parent, x, y, z, scale, color) {
  addRect(parent, x, y, 0.24 * scale, 0.36 * scale, color, z);
  addRect(parent, x, y + 0.03 * scale, 0.12 * scale, 0.12 * scale, color, z);
}

function addCheck(parent, x, y, z, color) {
  addLine(parent, [x - 0.06, y, z, x - 0.015, y - 0.05, z], color);
  addLine(parent, [x - 0.015, y - 0.05, z, x + 0.07, y + 0.06, z], color);
}

function addPin(parent, x, y, z) {
  addLine(parent, [x, y - 0.02, z, x, y + 0.16, z], COL.pin);
  addCircle(parent, x, y + 0.2, z, 0.05, COL.pin);
}

function addFloor(parent) {
  const positions = [];
  const y = -4.85;
  const extent = 8;
  for (let i = -extent; i <= extent; i += 1) {
    positions.push(-extent, y, i, extent, y, i, i, y, -extent, i, y, extent);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  parent.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: COL.floor })));
}

function layoutArrows(parent, phones) {
  const right = (group) => group.localToWorld(new THREE.Vector3(PHONE.w / 2, 0, 0));
  const left = (group) => group.localToWorld(new THREE.Vector3(-PHONE.w / 2, 0, 0));
  const bottom = (group) => group.localToWorld(new THREE.Vector3(0, -PHONE.h / 2, 0));
  const top = (group) => group.localToWorld(new THREE.Vector3(0, PHONE.h / 2, 0));

  connect(parent, bottom(phones.login), top(phones.signup), COL.dash, {
    dashed: true,
    head: true,
    lift: 0.15,
  });

  const stem = right(phones.login).lerp(left(phones.spots), 0.38);
  stem.y = phones.login.position.y;
  connect(parent, right(phones.login), stem, COL.flow, { head: false, lift: 0.12 });
  connect(parent, stem.clone(), left(phones.spots), COL.flow, { head: true, lift: 0.28 });
  connect(parent, stem.clone(), left(phones.augmented), COL.flow, { head: true, lift: 0.28 });

  const merge = right(phones.spots).lerp(left(phones.notify), 0.58);
  merge.y = phones.notify.position.y;
  connect(parent, right(phones.spots), merge, COL.flow, { head: false, lift: 0.22 });
  connect(parent, right(phones.augmented), merge.clone(), COL.flow, { head: false, lift: 0.22 });
  connect(parent, merge.clone(), left(phones.notify), COL.flow, { head: true, lift: 0.12 });
}

function connect(parent, from, to, color, { dashed = false, head = true, lift = 0.3 } = {}) {
  const mid = from.clone().lerp(to, 0.5);
  mid.z += lift;
  const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
  const points = curve.getPoints(28);
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = dashed
    ? new THREE.LineDashedMaterial({ color, dashSize: 0.16, gapSize: 0.1 })
    : new THREE.LineBasicMaterial({ color });
  const line = new THREE.Line(geo, mat);
  if (dashed) line.computeLineDistances();
  parent.add(line);
  if (!head) return;
  arrowHead(parent, points[points.length - 4], points[points.length - 1], color);
}

function arrowHead(parent, prev, tip, color) {
  const dir = tip.clone().sub(prev);
  if (dir.lengthSq() < 1e-8) return;
  dir.normalize();
  const ref = Math.abs(dir.y) > 0.92 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3().crossVectors(dir, ref).normalize();
  const back = tip.clone().addScaledVector(dir, -0.22);
  const a = back.clone().addScaledVector(side, 0.09);
  const b = back.clone().addScaledVector(side, -0.09);
  const geo = new THREE.BufferGeometry().setFromPoints([a, tip, tip, b]);
  parent.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color })));
}

function text(parent, value, x, y, z, opts = {}) {
  const sprite = makeTextSprite(value, opts);
  sprite.position.set(x, y, z);
  parent.add(sprite);
  return sprite;
}

function makeTextSprite(value, { color = '#d5deea', worldHeight = 0.2, weight = 600 } = {}) {
  const fontSize = 64;
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `${weight} ${fontSize}px sans-serif`;
  const textWidth = Math.ceil(measure.measureText(value).width);
  const width = Math.max(32, textWidth + 32);
  const height = Math.ceil(fontSize * 1.35);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.font = `${weight} ${fontSize}px sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(value, width / 2, height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  const aspect = width / height;
  sprite.scale.set(worldHeight * aspect, worldHeight, 1);
  return sprite;
}

function addRect(parent, x, y, w, h, color, z) {
  const hw = w / 2;
  const hh = h / 2;
  addLine(parent, [
    x - hw, y - hh, z, x + hw, y - hh, z,
    x + hw, y - hh, z, x + hw, y + hh, z,
    x + hw, y + hh, z, x - hw, y + hh, z,
    x - hw, y + hh, z, x - hw, y - hh, z,
  ], color);
}

function addLine(parent, positions, color) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const line = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color }));
  parent.add(line);
  return line;
}

function addPolyline(parent, points, color) {
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  parent.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color })));
}

function addCircle(parent, x, y, z, radius, color, segments = 20) {
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, z));
  }
  addPolyline(parent, points, color);
}

const host = document.getElementById('wireframe-canvas');
if (host && host.dataset.booted !== '1') {
  host.dataset.booted = '1';
  boot(host);
}
