/* Zoom, pan, and reset for the Sprint 4 wireframe diagram only. */
(function () {
  var root = document.querySelector("[data-wireframe-zoom]");
  if (!root) return;

  var viewport = root.querySelector(".wireframe-zoom-viewport");
  var stage = root.querySelector(".wireframe-zoom-stage");
  var zoomInButton = root.querySelector("[data-zoom-in]");
  var zoomOutButton = root.querySelector("[data-zoom-out]");
  var resetButton = root.querySelector("[data-zoom-reset]");
  if (!viewport || !stage || !zoomInButton || !zoomOutButton || !resetButton) return;

  var MIN_SCALE = 1;
  var MAX_SCALE = 6;
  var BUTTON_STEP = 1.25;
  var scale = 1;
  var x = 0;
  var y = 0;
  var pointers = new Map();
  var drag = null;
  var pinch = null;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function clampPan() {
    var width = viewport.clientWidth;
    var height = viewport.clientHeight;
    if (scale <= MIN_SCALE) {
      scale = MIN_SCALE;
      x = 0;
      y = 0;
      return;
    }
    var minX = width - width * scale;
    var minY = height - height * scale;
    x = clamp(x, minX, 0);
    y = clamp(y, minY, 0);
  }

  function apply() {
    clampPan();
    stage.style.transform =
      "translate(" + x + "px, " + y + "px) scale(" + scale + ")";
    var zoomed = scale > MIN_SCALE + 0.001;
    viewport.classList.toggle("is-zoomed", zoomed);
    root.dataset.scale = String(scale);
  }

  function zoomAt(nextScale, clientX, clientY) {
    var rect = viewport.getBoundingClientRect();
    var pointX = clientX - rect.left;
    var pointY = clientY - rect.top;
    var contentX = (pointX - x) / scale;
    var contentY = (pointY - y) / scale;
    scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    x = pointX - contentX * scale;
    y = pointY - contentY * scale;
    apply();
  }

  function zoomBy(factor) {
    var rect = viewport.getBoundingClientRect();
    zoomAt(scale * factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  function reset() {
    scale = MIN_SCALE;
    x = 0;
    y = 0;
    apply();
  }

  zoomInButton.addEventListener("click", function () {
    zoomBy(BUTTON_STEP);
  });
  zoomOutButton.addEventListener("click", function () {
    zoomBy(1 / BUTTON_STEP);
  });
  resetButton.addEventListener("click", reset);

  viewport.addEventListener(
    "wheel",
    function (event) {
      event.preventDefault();
      var delta = event.deltaY;
      if (event.deltaMode === 1) delta *= 16;
      else if (event.deltaMode === 2) delta *= viewport.clientHeight || 1;
      var factor = Math.exp(-delta * 0.0018);
      zoomAt(scale * factor, event.clientX, event.clientY);
    },
    { passive: false }
  );

  viewport.addEventListener("pointerdown", function (event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try {
      viewport.setPointerCapture(event.pointerId);
    } catch (err) {
      /* Untrusted events have no active pointer. Real drags still capture. */
    }

    if (pointers.size >= 2) {
      drag = null;
      viewport.classList.remove("is-panning");
      var points = Array.from(pointers.values());
      pinch = {
        dist: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) || 1,
        scale: scale,
      };
      return;
    }

    if (scale <= MIN_SCALE + 0.001) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    viewport.classList.add("is-panning");
  });

  viewport.addEventListener("pointermove", function (event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size >= 2 && pinch) {
      var points = Array.from(pointers.values());
      var dist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) || 1;
      var midX = (points[0].x + points[1].x) / 2;
      var midY = (points[0].y + points[1].y) / 2;
      zoomAt(pinch.scale * (dist / pinch.dist), midX, midY);
      return;
    }

    if (!drag || drag.id !== event.pointerId) return;
    x += event.clientX - drag.x;
    y += event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    apply();
  });

  function endPointer(event) {
    pointers.delete(event.pointerId);
    if (drag && drag.id === event.pointerId) drag = null;
    if (pointers.size < 2) pinch = null;
    viewport.classList.toggle("is-panning", Boolean(drag));
  }

  viewport.addEventListener("pointerup", endPointer);
  viewport.addEventListener("pointercancel", endPointer);

  viewport.addEventListener("keydown", function (event) {
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomBy(BUTTON_STEP);
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      zoomBy(1 / BUTTON_STEP);
    } else if (event.key === "0") {
      event.preventDefault();
      reset();
    }
  });

  apply();
})();
