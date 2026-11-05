/**
 * Damn Parking - 3D wireframe of a possible phone UI flow.
 * Login and sign up on the left, available spots in the middle, notify on the right.
 * Black, white, and gray only. This is a possible UI model, not a released app.
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

const PHONE = { w: 1.9, h: 3.72, d: 0.18 };
const FACE = PHONE.d / 2 + 0.02;

const INK = {
  edge: 0xffffff,
  line: 0xd4d4d4,
  face: 0x0c0c0c,
  text: '#f2f2f2',
  muted: '#c8c8c8',
  labelBg: '#f2f2f2',
  labelInk: '#111111',
};

const SCREENS = [
  { key: 'login', label: 'Login', x: -5.05, y: 2.4, z: 0.45, build: buildLogin },
  { key: 'signup', label: 'Sign up', x: -5.15, y: -2.9, z: -0.55, build: buildSignup },
  { key: 'spots', label: 'Available spots', x: 0.15, y: 2.5, z: 0.75, build: buildSpots },
  { key: 'augmented', label: 'Augmented view', x: 0.05, y: -2.75, z: -0.2, build: buildAugmented },
  { key: 'notify', label: 'Notify', x: 5.25, y: 0.05, z: 0.25, build: buildNotify },
];

const FLOW = 0xbdbdbd;
const DASH = 0x8f8f8f;
const FLOOR = 0x2e2e2e;

const DEFAULT_THETA = 0.38;
const DEFAULT_PHI = 1.16;
const MIN_RADIUS = 4.2;
const MAX_RADIUS = 48;
const PHI_MIN = 0.28;
const PHI_MAX = 2.45;

const lineMaterials = new Map();
const dashedMaterials = new Map();
const fillMaterials = new Map();
const hitMaterial = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
  colorWrite: false,
});

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const tmpForward = new THREE.Vector3();
const tmpHit = new THREE.Vector3();
const tmpRight = new THREE.Vector3();
const tmpUp = new THREE.Vector3();
const tmpDelta = new THREE.Vector3();
const tmpCenter = new THREE.Vector3();

function boot(root) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x121212);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.08, 500);
  const target = new THREE.Vector3();
  const homeTarget = new THREE.Vector3();
  const camState = { theta: DEFAULT_THETA, phi: DEFAULT_PHI, radius: 16 };
  const clock = new THREE.Clock();

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false,
    });
  } catch (err) {
    console.warn('Damn Parking wireframe unavailable:', err);
    showFallback(root, '3D wireframe needs WebGL in this browser. The flat flowchart is shown instead.');
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x121212, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  root.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.style.cursor = 'grab';
  renderer.domElement.setAttribute('data-wireframe-gl', '1');

  const fitRoot = new THREE.Group();
  fitRoot.name = 'wireframe-flow';
  scene.add(fitRoot);

  const phones = {};
  const phoneHits = [];

  SCREENS.forEach((spec) => {
    const phone = makePhone(spec);
    phone.name = spec.key;
    phone.position.set(spec.x, spec.y, spec.z);
    spec.build(phone);
    caption(phone, spec.label);
    const hit = phone.getObjectByName('phone-hit');
    if (hit) phoneHits.push(hit);
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
    if (reduced) stopLoop();
    else if (!interacted) startLoop();
    syncCamera();
  };
  if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotion);
  else if (motionQuery.addListener) motionQuery.addListener(onMotion);

  let interacted = false;
  let keepRadius = false;
  let visible = document.visibilityState !== 'hidden';
  let onScreen = true;
  let running = false;
  let frameId = 0;
  const pointers = new Map();
  const drag = { active: false, x: 0, y: 0, pan: false };
  const gesture = { x: 0, y: 0, moved: false };
  const tap = { t: 0, x: 0, y: 0 };
  let pinchDist = 0;
  let lastFrameAt = 0;

  function fitRadius() {
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const aspect = Math.max(camera.aspect, 0.45);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const half = Math.min(vFov, hFov) / 2;
    return THREE.MathUtils.clamp((fitSphere.radius / Math.sin(half)) * 0.86, MIN_RADIUS, MAX_RADIUS);
  }

  function phoneFrameRadius() {
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const aspect = Math.max(camera.aspect, 0.45);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const half = Math.min(vFov, hFov) / 2;
    const halfH = PHONE.h / 2 + 0.95;
    const halfW = Math.max(PHONE.w / 2 + 0.4, 1.7);
    const radius = Math.hypot(halfW, halfH);
    return THREE.MathUtils.clamp((radius / Math.sin(half)) * 1.08, MIN_RADIUS, MAX_RADIUS);
  }

  function applyFit(force) {
    const next = fitRadius();
    if (force || !keepRadius) camState.radius = next;
  }

  function placeCamera() {
    const sinPhi = Math.sin(camState.phi);
    camera.position.set(
      target.x + camState.radius * sinPhi * Math.sin(camState.theta),
      target.y + camState.radius * Math.cos(camState.phi),
      target.z + camState.radius * sinPhi * Math.cos(camState.theta)
    );
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
    root.dataset.radius = camState.radius.toFixed(3);
    root.dataset.theta = camState.theta.toFixed(3);
    root.dataset.phi = camState.phi.toFixed(3);
  }

  function syncCamera() {
    placeCamera();
    if (visible && onScreen) renderer.render(scene, camera);
  }

  function needsContinuous() {
    return visible && onScreen && !reduced && !interacted;
  }

  function stopLoop() {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    running = false;
  }

  function startLoop() {
    if (running || !needsContinuous()) return;
    running = true;
    clock.getDelta();
    frameId = window.requestAnimationFrame(tick);
  }

  function markInteracted() {
    if (!interacted) {
      interacted = true;
      stopLoop();
    }
  }

  function resize() {
    const width = root.clientWidth;
    const height = root.clientHeight;
    if (width < 2 || height < 2) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(width, height, false);
    applyFit(false);
    syncCamera();
  }

  function zoomAt(factor, clientX, clientY) {
    markInteracted();
    if (!Number.isFinite(factor) || factor <= 0) return;
    const oldRadius = camState.radius;
    const newRadius = THREE.MathUtils.clamp(oldRadius * factor, MIN_RADIUS, MAX_RADIUS);
    if (Math.abs(newRadius - oldRadius) < 1e-4) return;
    keepRadius = true;
    if (clientX != null && clientY != null) dollyTarget(oldRadius, newRadius, clientX, clientY);
    camState.radius = newRadius;
    syncCamera();
  }

  function dollyTarget(oldRadius, newRadius, clientX, clientY) {
    placeCamera();
    clientToNdc(clientX, clientY);
    raycaster.setFromCamera(ndc, camera);
    tmpForward.copy(target).sub(camera.position);
    if (tmpForward.lengthSq() < 1e-8) return;
    tmpForward.normalize();
    const denom = raycaster.ray.direction.dot(tmpForward);
    if (denom < 1e-4) return;
    const distance = tmpForward.dot(tmpHit.copy(target).sub(camera.position)) / denom;
    if (distance <= 0) return;
    raycaster.ray.at(distance, tmpHit);
    const scale = 1 - newRadius / oldRadius;
    tmpDelta.copy(tmpHit).sub(target);
    target.addScaledVector(tmpDelta, scale);
    const span = Math.max(fitSphere.radius * 2.4, 8);
    target.x = THREE.MathUtils.clamp(target.x, homeTarget.x - span, homeTarget.x + span);
    target.y = THREE.MathUtils.clamp(target.y, homeTarget.y - span, homeTarget.y + span);
    target.z = THREE.MathUtils.clamp(target.z, homeTarget.z - span, homeTarget.z + span);
  }

  function clientToNdc(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    const width = rect.width || 1;
    const height = rect.height || 1;
    ndc.x = ((clientX - rect.left) / width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / height) * 2 + 1;
  }

  function resetView() {
    markInteracted();
    keepRadius = false;
    camState.theta = DEFAULT_THETA;
    camState.phi = DEFAULT_PHI;
    target.copy(homeTarget);
    applyFit(true);
    syncCamera();
  }

  function fitAll() {
    markInteracted();
    keepRadius = false;
    target.copy(homeTarget);
    applyFit(true);
    syncCamera();
  }

  function framePhone(group) {
    markInteracted();
    keepRadius = true;
    group.getWorldPosition(tmpCenter);
    tmpCenter.y += 0.32;
    target.copy(tmpCenter);
    camState.radius = phoneFrameRadius();
    syncCamera();
  }

  function frameAt(clientX, clientY) {
    const now = performance.now();
    if (now - lastFrameAt < 400) return;
    lastFrameAt = now;
    markInteracted();
    clientToNdc(clientX, clientY);
    placeCamera();
    fitRoot.updateMatrixWorld(true);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(phoneHits, false);
    if (hits.length) framePhone(hits[0].object.parent);
    else fitAll();
  }

  function panBy(dx, dy) {
    tmpForward.copy(target).sub(camera.position);
    if (tmpForward.lengthSq() < 1e-8) return;
    tmpForward.normalize();
    tmpRight.crossVectors(tmpForward, camera.up).normalize();
    tmpUp.crossVectors(tmpRight, tmpForward).normalize();
    const scale = camState.radius * 0.0017;
    target.addScaledVector(tmpRight, -dx * scale);
    target.addScaledVector(tmpUp, dy * scale);
  }

  function pointerSpan() {
    const pts = [...pointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  function pinchCenter() {
    const pts = [...pointers.values()];
    return {
      x: (pts[0].x + pts[1].x) / 2,
      y: (pts[0].y + pts[1].y) / 2,
    };
  }

  function onPointerDown(event) {
    if (event.button !== undefined && event.button > 2) return;
    markInteracted();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2) {
      drag.active = false;
      gesture.moved = true;
      pinchDist = pointerSpan();
      return;
    }
    drag.active = true;
    drag.x = event.clientX;
    drag.y = event.clientY;
    drag.pan = event.shiftKey || event.altKey || event.button === 1 || event.button === 2;
    gesture.x = event.clientX;
    gesture.y = event.clientY;
    gesture.moved = false;
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
        const center = pinchCenter();
        zoomAt(pinchDist / dist, center.x, center.y);
      }
      pinchDist = dist || pinchDist;
      return;
    }
    if (!drag.active) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (dx === 0 && dy === 0) return;
    if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 3) gesture.moved = true;
    if (drag.pan || event.shiftKey) panBy(dx, dy);
    else {
      camState.theta -= dx * 0.0072;
      camState.phi = THREE.MathUtils.clamp(camState.phi + dy * 0.0052, PHI_MIN, PHI_MAX);
    }
    syncCamera();
  }

  function onPointerUp(event) {
    const wasDrag = gesture.moved;
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
    if (wasDrag || pointers.size > 0) return;
    if (event.button !== undefined && event.button !== 0) return;
    const now = performance.now();
    const dist = Math.hypot(event.clientX - tap.x, event.clientY - tap.y);
    if (tap.t && now - tap.t < 360 && dist < 24) {
      tap.t = 0;
      frameAt(event.clientX, event.clientY);
    } else {
      tap.t = now;
      tap.x = event.clientX;
      tap.y = event.clientY;
    }
  }

  function onWheel(event) {
    event.preventDefault();
    let dy = event.deltaY;
    if (event.deltaMode === 1) dy *= 32;
    else if (event.deltaMode === 2) dy *= 800;
    if (!dy) return;
    const factor = Math.pow(1.18, dy / 100);
    zoomAt(factor, event.clientX, event.clientY);
  }

  function onDoubleClick(event) {
    event.preventDefault();
    frameAt(event.clientX, event.clientY);
  }

  function onKeyDown(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const tag = (event.target && event.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target?.isContentEditable) return;
    const step = 0.1;
    if (event.key === 'ArrowLeft') {
      markInteracted();
      camState.theta += step;
    } else if (event.key === 'ArrowRight') {
      markInteracted();
      camState.theta -= step;
    } else if (event.key === 'ArrowUp') {
      markInteracted();
      camState.phi = THREE.MathUtils.clamp(camState.phi - step, PHI_MIN, PHI_MAX);
    } else if (event.key === 'ArrowDown') {
      markInteracted();
      camState.phi = THREE.MathUtils.clamp(camState.phi + step, PHI_MIN, PHI_MAX);
    } else if (event.key === '+' || event.key === '=' || event.code === 'NumpadAdd') {
      zoomAt(0.78, null, null);
    } else if (event.key === '-' || event.key === '_' || event.code === 'NumpadSubtract') {
      zoomAt(1.28, null, null);
    } else if (event.key === '0' || event.code === 'Numpad0' || event.key === 'r' || event.key === 'R') {
      resetView();
    } else {
      return;
    }
    event.preventDefault();
    syncCamera();
  }

  function onContextMenu(event) {
    event.preventDefault();
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointercancel', onPointerUp);
  renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
  renderer.domElement.addEventListener('dblclick', onDoubleClick);
  renderer.domElement.addEventListener('contextmenu', onContextMenu);
  root.tabIndex = 0;
  window.addEventListener('keydown', onKeyDown);

  document.getElementById('wireframe-zoom-in')?.addEventListener('click', () => {
    zoomAt(0.78, null, null);
  });
  document.getElementById('wireframe-zoom-out')?.addEventListener('click', () => {
    zoomAt(1.28, null, null);
  });
  document.getElementById('wireframe-fit')?.addEventListener('click', () => {
    fitAll();
  });
  document.getElementById('wireframe-reset')?.addEventListener('click', () => {
    resetView();
  });

  document.addEventListener('visibilitychange', () => {
    visible = document.visibilityState !== 'hidden';
    if (needsContinuous()) startLoop();
    else {
      stopLoop();
      if (visible && onScreen) syncCamera();
    }
  });

  const seen = new IntersectionObserver((entries) => {
    onScreen = entries.some((entry) => entry.isIntersecting);
    if (needsContinuous()) startLoop();
    else {
      stopLoop();
      if (visible && onScreen) syncCamera();
    }
  }, { threshold: 0 });
  seen.observe(root);

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
    interacted,
  });

  function tick() {
    frameId = 0;
    if (!needsContinuous()) {
      running = false;
      return;
    }
    const dt = Math.min(clock.getDelta(), 0.05);
    camState.theta += dt * 0.12;
    syncCamera();
    frameId = window.requestAnimationFrame(tick);
  }

  syncCamera();
  startLoop();
}

function showFallback(root, message) {
  root.classList.add('is-fallback');
  root.innerHTML = '';
  const img = document.createElement('img');
  img.src = '/assets/img/ui/wireframe.webp';
  img.width = 1124;
  img.height = 1544;
  img.alt = 'Flat Damn Parking wireframe flowchart of the login, signup, available spots, and notify phones.';
  const note = document.createElement('p');
  note.textContent = message + ' This is a possible UI wireframe model, not a released app.';
  root.append(img, note);
}

function lineMat(color) {
  let mat = lineMaterials.get(color);
  if (!mat) {
    mat = new THREE.LineBasicMaterial({ color });
    lineMaterials.set(color, mat);
  }
  return mat;
}

function dashedMat(color) {
  let mat = dashedMaterials.get(color);
  if (!mat) {
    mat = new THREE.LineDashedMaterial({ color, dashSize: 0.16, gapSize: 0.1 });
    dashedMaterials.set(color, mat);
  }
  return mat;
}

function fillMat(color) {
  let mat = fillMaterials.get(color);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({ color });
    fillMaterials.set(color, mat);
  }
  return mat;
}

function makePhone(spec) {
  const group = new THREE.Group();
  const body = new THREE.BoxGeometry(PHONE.w, PHONE.h, PHONE.d);
  group.add(new THREE.LineSegments(new THREE.EdgesGeometry(body, 1), lineMat(INK.edge)));
  body.dispose();

  const screenW = PHONE.w - 0.2;
  const screenH = PHONE.h - 0.5;
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(screenW, screenH), fillMat(INK.face));
  fill.position.set(0, -0.04, FACE - 0.045);
  group.add(fill);
  addRect(group, 0, -0.04, screenW, screenH, INK.edge, FACE - 0.01);
  addRect(group, 0, -0.04, screenW - 0.08, screenH - 0.08, INK.line, FACE);
  addCircle(group, 0, PHONE.h / 2 - 0.16, FACE, 0.045, INK.edge);

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(PHONE.w + 1.7, PHONE.h + 1.25, 1.15),
    hitMaterial
  );
  hit.name = 'phone-hit';
  hit.position.set(0, 0.46, 0);
  hit.userData.key = spec.key;
  group.add(hit);
  return group;
}

function caption(group, label) {
  const worldHeight = label.length > 12 ? 0.58 : 0.68;
  const sprite = makeTextSprite(label, {
    color: INK.labelInk,
    background: INK.labelBg,
    worldHeight,
    weight: 700,
    fontSize: 120,
  });
  sprite.position.set(0, PHONE.h / 2 + worldHeight * 0.72, FACE + 0.1);
  sprite.renderOrder = 4;
  sprite.material.depthTest = false;
  group.add(sprite);
}

function buildLogin(group) {
  const z = FACE;
  text(group, 'DAMNPARKING!', 0, 1.2, z, { worldHeight: 0.2, color: INK.text });
  text(group, 'Login', 0, 0.78, z, { worldHeight: 0.18, color: INK.text });
  field(group, 0, 0.36, z, 'Username');
  field(group, 0, -0.04, z, 'Password');
  text(group, 'Are you new?', 0, -0.5, z, { worldHeight: 0.13, color: INK.muted });
  text(group, 'Sign Up Here', 0, -0.74, z, { worldHeight: 0.15, color: INK.text });
  addLine(group, [-0.42, -0.86, z, 0.42, -0.86, z], INK.edge);
  parkingMark(group, 0, -1.28, z);
}

function buildSignup(group) {
  const z = FACE;
  text(group, 'WELCOME TO', 0, 1.38, z, { worldHeight: 0.13, color: INK.text });
  text(group, 'DAMNPARKING!', 0, 1.14, z, { worldHeight: 0.18, color: INK.text });
  text(group, 'Sign Up', 0, 0.78, z, { worldHeight: 0.16, color: INK.text });
  field(group, 0, 0.4, z, 'Email');
  field(group, 0, 0.02, z, 'Username');
  field(group, 0, -0.36, z, 'Password');
  text(group, 'Do you have an account?', 0, -0.78, z, { worldHeight: 0.12, color: INK.muted });
  text(group, 'Login Here', 0, -1.02, z, { worldHeight: 0.15, color: INK.text });
  addLine(group, [-0.34, -1.14, z, 0.34, -1.14, z], INK.edge);
  parkingMark(group, 0, -1.46, z);
}

function buildSpots(group) {
  const z = FACE;
  banner(group, z);
  field(group, 0, 0.7, z, 'Search');
  text(group, 'Mike Loya Available Spots', 0, 0.38, z, { worldHeight: 0.12, color: INK.text });
  stallGrid(group, z, -0.22, false);
  bottomBar(group, z, 'Change to augmented view');
}

function buildAugmented(group) {
  const z = FACE;
  banner(group, z);
  field(group, 0, 0.7, z, 'Search');
  text(group, 'Mike Loya Available Spots', 0, 0.38, z, { worldHeight: 0.12, color: INK.text });
  augmentedLot(group, z);
  bottomBar(group, z, 'Change to map');
}

function buildNotify(group) {
  const z = FACE;
  text(group, 'Notify others', 0, 1.38, z, { worldHeight: 0.17, color: INK.text });
  text(group, 'you are leaving your spot', 0, 1.14, z, { worldHeight: 0.12, color: INK.muted });
  field(group, 0, 0.74, z, 'Spot Place');
  addRect(group, 0, 0.32, 1.48, 0.32, INK.edge, z);
  text(group, 'Turn On Your Location', 0, 0.32, z + 0.02, { worldHeight: 0.11, color: INK.text });
  addLine(group, [-0.72, 0.04, z, 0.72, 0.04, z], INK.line);
  text(group, 'Notifying other drivers,', 0, -0.18, z, { worldHeight: 0.12, color: INK.text });
  text(group, 'you are leaving this Spot', 0, -0.38, z, { worldHeight: 0.11, color: INK.muted });
  stallGrid(group, z, -1.05, true);
}

function banner(parent, z) {
  addRect(parent, 0, 1.28, 1.55, 0.52, INK.edge, z);
  text(parent, 'Joe Mota just left his spot', 0, 1.36, z + 0.02, { worldHeight: 0.11, color: INK.text });
  text(parent, 'Schuster 1', 0, 1.18, z + 0.02, { worldHeight: 0.11, color: INK.text });
}

function field(parent, x, y, z, label) {
  addRect(parent, x, y, 1.42, 0.3, INK.line, z);
  text(parent, label, x, y, z + 0.02, { worldHeight: 0.13, color: INK.text });
}

function bottomBar(parent, z, label) {
  addRect(parent, 0, -1.46, 1.52, 0.3, INK.edge, z);
  text(parent, label, 0, -1.46, z + 0.02, { worldHeight: 0.11, color: INK.text });
}

function stallGrid(parent, z, y0, withPin) {
  const cols = [-0.46, 0, 0.46];
  const rows = [0.28, -0.12, -0.52];
  rows.forEach((row, ri) => {
    cols.forEach((col, ci) => {
      const pinHere = withPin && ri === 0 && ci === 1;
      addCar(parent, col + 0.06, y0 + row, z, 0.72, INK.line);
      if (pinHere) addPin(parent, col - 0.12, y0 + row, z + 0.02);
      else addCheck(parent, col - 0.16, y0 + row, z, INK.edge);
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
    addRect(parent, 0, row.y, row.w, row.h, INK.line, z);
    addCar(parent, -row.w * 0.22, row.y, z + 0.01, row.s, INK.edge);
    addCar(parent, row.w * 0.22, row.y, z + 0.01, row.s, INK.edge);
  });
}

function parkingMark(parent, x, y, z) {
  const w = 0.82;
  const h = 0.42;
  addRect(parent, x, y, w, h, INK.edge, z);
  addLine(parent, [x - w / 6, y - h / 2, z, x - w / 6, y + h / 2, z], INK.line);
  addLine(parent, [x + w / 6, y - h / 2, z, x + w / 6, y + h / 2, z], INK.line);
  const stemX = x - 0.07;
  addLine(parent, [stemX, y - 0.13, z, stemX, y + 0.13, z], INK.edge);
  const arc = [];
  const cx = x - 0.02;
  const cy = y + 0.045;
  for (let i = 0; i <= 12; i += 1) {
    const a = Math.PI / 2 - (i / 12) * Math.PI;
    arc.push(new THREE.Vector3(cx + Math.cos(a) * 0.09, cy + Math.sin(a) * 0.085, z));
  }
  arc.unshift(new THREE.Vector3(stemX, y + 0.13, z));
  arc.push(new THREE.Vector3(stemX, y - 0.04, z));
  addPolyline(parent, arc, INK.edge);
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
  addLine(parent, [x, y - 0.02, z, x, y + 0.16, z], INK.edge);
  addCircle(parent, x, y + 0.2, z, 0.05, INK.edge);
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
  parent.add(new THREE.LineSegments(geo, lineMat(FLOOR)));
}

function layoutArrows(parent, phones) {
  const right = (group) => group.localToWorld(new THREE.Vector3(PHONE.w / 2, 0, 0));
  const left = (group) => group.localToWorld(new THREE.Vector3(-PHONE.w / 2, 0, 0));
  const bottom = (group) => group.localToWorld(new THREE.Vector3(0, -PHONE.h / 2, 0));
  const top = (group) => group.localToWorld(new THREE.Vector3(0, PHONE.h / 2, 0));

  connect(parent, bottom(phones.login), top(phones.signup), DASH, {
    dashed: true,
    head: true,
    lift: 0.15,
  });

  const stem = right(phones.login).lerp(left(phones.spots), 0.38);
  stem.y = phones.login.position.y;
  connect(parent, right(phones.login), stem, FLOW, { head: false, lift: 0.12 });
  connect(parent, stem.clone(), left(phones.spots), FLOW, { head: true, lift: 0.28 });
  connect(parent, stem.clone(), left(phones.augmented), FLOW, { head: true, lift: 0.28 });

  const merge = right(phones.spots).lerp(left(phones.notify), 0.58);
  merge.y = phones.notify.position.y;
  connect(parent, right(phones.spots), merge, FLOW, { head: false, lift: 0.22 });
  connect(parent, right(phones.augmented), merge.clone(), FLOW, { head: false, lift: 0.22 });
  connect(parent, merge.clone(), left(phones.notify), FLOW, { head: true, lift: 0.12 });
}

function connect(parent, from, to, color, { dashed = false, head = true, lift = 0.3 } = {}) {
  const mid = from.clone().lerp(to, 0.5);
  mid.z += lift;
  const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
  const points = curve.getPoints(28);
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(geo, dashed ? dashedMat(color) : lineMat(color));
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
  parent.add(new THREE.LineSegments(geo, lineMat(color)));
}

function text(parent, value, x, y, z, opts = {}) {
  const sprite = makeTextSprite(value, opts);
  sprite.position.set(x, y, z);
  sprite.renderOrder = opts.renderOrder ?? 2;
  parent.add(sprite);
  return sprite;
}

function makeTextSprite(value, {
  color = '#e8e8e8',
  background = '',
  worldHeight = 0.2,
  weight = 600,
  fontSize = 64,
} = {}) {
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `${weight} ${fontSize}px sans-serif`;
  const textWidth = Math.ceil(measure.measureText(value).width);
  const padX = background ? Math.round(fontSize * 0.42) : 16;
  const padY = background ? Math.round(fontSize * 0.28) : 8;
  const width = Math.max(32, textWidth + padX * 2);
  const height = Math.ceil(fontSize + padY * 2);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (background) {
    traceRoundRect(ctx, 1, 1, width - 2, height - 2, height / 2);
    ctx.fillStyle = background;
    ctx.fill();
  }
  ctx.font = `${weight} ${fontSize}px sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(value, width / 2, height / 2 + fontSize * 0.04);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
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

function traceRoundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
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
  const line = new THREE.LineSegments(geo, lineMat(color));
  parent.add(line);
  return line;
}

function addPolyline(parent, points, color) {
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  parent.add(new THREE.Line(geo, lineMat(color)));
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
