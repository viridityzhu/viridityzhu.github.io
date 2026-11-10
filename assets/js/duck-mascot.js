const vertexSource = `
  attribute vec3 position;
  attribute vec3 normal;
  attribute vec3 pigment;
  attribute float headWeight;

  uniform vec4 orientation;
  uniform vec4 faceRotation;
  uniform float bob;
  uniform vec2 aspect;

  varying vec3 color;

  vec3 rotate(vec3 point, vec4 rotation) {
    vec3 axis = rotation.xyz;
    return point + 2.0 * cross(axis, cross(axis, point) + rotation.w * point);
  }

  void main() {
    vec3 faceNormal = mix(normal, rotate(normal, faceRotation), headWeight);
    vec3 surface = normalize(rotate(faceNormal, orientation));
    float key = max(dot(surface, normalize(vec3(-0.42, 0.78, 0.65))), 0.0);
    float fill = max(dot(surface, normalize(vec3(0.78, 0.12, 0.48))), 0.0);
    color = pigment * (0.54 + 0.52 * key + 0.14 * fill);
    vec3 base = position / 4096.0;
    vec3 neckPivot = vec3(-0.04, 0.13, 0.27);
    vec3 tiltedHead = rotate(base - neckPivot, faceRotation) + neckPivot;
    vec3 point = rotate(mix(base, tiltedHead, headWeight), orientation);
    gl_Position = vec4((point.xy + vec2(0.0, bob)) * aspect * 0.67, -point.z * 0.38, 1.0);
  }
`;

const fragmentSource = `
  precision mediump float;
  varying vec3 color;

  void main() {
    gl_FragColor = vec4(color, 1.0);
  }
`;

function axisRotation([x, y, z], angle) {
  const sine = Math.sin(angle / 2);
  return [x * sine, y * sine, z * sine, Math.cos(angle / 2)];
}

function multiply([ax, ay, az, aw], [bx, by, bz, bw]) {
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

function normalize(vector) {
  const length = Math.hypot(...vector);
  return vector.map(value => value / length);
}

function easeRotation(start, end, progress) {
  const sign = start.reduce((dot, component, i) => dot + component * end[i], 0) < 0 ? -1 : 1;
  return normalize(start.map((component, i) => component * (1 - progress) + end[i] * sign * progress));
}

function dragVector(drag, dx, dy, shiftKey) {
  if (shiftKey) return [0, 0, Math.abs(dx) >= Math.abs(dy) ? dx : -dy];

  const radialX = drag.x - drag.centerX;
  const radialY = drag.y - drag.centerY;
  const radius = Math.hypot(radialX, radialY);
  if (!drag.onRim || radius < 1) return [dy, dx, 0];

  // A rim gesture rolls along the tangent and still tilts along the radius.
  const x = radialX / radius;
  const y = radialY / radius;
  const radial = dx * x + dy * y;
  return [radial * y, radial * x, dx * y - dy * x];
}

const shakeDistanceScale = 2;

function newShake(time = -Infinity) {
  return [{ x: 0, y: 0, distance: 0, time }];
}

// Like KDE's shake-to-find, compare recent travel with the trail's footprint.
// Positions are relative to the duck frame, so the same gesture works on touch.
function recordShake(trail, dx, dy, time) {
  const previous = trail[trail.length - 1];
  const point = {
    x: previous.x + dx,
    y: previous.y + dy,
    distance: previous.distance + Math.hypot(dx, dy),
    time,
  };
  trail.push(point);
  const cutoff = time - 380;
  while (trail[0].time < cutoff) trail.shift();

  const travel = point.distance - trail[0].distance;
  if (travel < 0.23 * shakeDistanceScale) return false;

  let left = point.x;
  let right = point.x;
  let top = point.y;
  let bottom = point.y;
  for (const sample of trail) {
    left = Math.min(left, sample.x);
    right = Math.max(right, sample.x);
    top = Math.min(top, sample.y);
    bottom = Math.max(bottom, sample.y);
  }
  const spread = Math.hypot(right - left, bottom - top);
  return spread >= 0.56 * shakeDistanceScale ||
    (spread >= 0.045 * shakeDistanceScale && travel >= 1.65 * spread);
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

function createRenderer(gl, mesh) {
  // Layout matches the packed triangle corners in _art/duck/build.py.
  const stride = 14;
  if (!mesh.byteLength || mesh.byteLength % (3 * stride) !== 0) {
    throw new Error("Invalid duck mesh");
  }

  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW);

  for (const [name, size, type, normalized, offset] of [
    ["position", 3, gl.SHORT, false, 0],
    ["normal", 3, gl.BYTE, true, 6],
    ["pigment", 3, gl.UNSIGNED_BYTE, true, 9],
    ["headWeight", 1, gl.UNSIGNED_BYTE, true, 12],
  ]) {
    const attribute = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, size, type, normalized, stride, offset);
  }

  const orientation = gl.getUniformLocation(program, "orientation");
  const face = gl.getUniformLocation(program, "faceRotation");
  const bob = gl.getUniformLocation(program, "bob");
  const aspect = gl.getUniformLocation(program, "aspect");
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 0);

  return (width, height, rotation, look, lift) => {
    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform4fv(orientation, rotation);
    gl.uniform4fv(face, look);
    gl.uniform1f(bob, lift);
    gl.uniform2f(aspect, Math.min(1, height / width), Math.min(1, width / height));
    gl.drawArrays(gl.TRIANGLES, 0, mesh.byteLength / stride);
  };
}

async function mountDuck(mascot) {
  const turn = mascot.querySelector(".duck-turn");
  const motion = mascot.querySelector(".duck-motion");
  const poster = mascot.querySelector(".duck-poster");
  const canvas = turn.querySelector("canvas");
  const gl = canvas.getContext("webgl", { alpha: true, antialias: true });
  if (!gl) return;

  const response = await fetch(mascot.dataset.duckMesh);
  if (!response.ok) return;
  const draw = createRenderer(gl, await response.arrayBuffer());

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const horizontalAxis = [0, 1, 0];
  const verticalAxis = [-1, 0, 0];
  const rollAxis = [0, 0, 1];
  let orientation = multiply(axisRotation(verticalAxis, -0.25), axisRotation(horizontalAxis, -0.56));
  let displayedOrientation = orientation;
  const boardPose = multiply(axisRotation(verticalAxis, -0.12), axisRotation(horizontalAxis, -0.27));
  const straightAhead = [0, 0, 0, 1];
  let lastPose = orientation;
  let loose = null;
  let active = !reducedMotion.matches;
  let inView = true;
  let frame = 0;
  let previousFrame = 0;
  let phase = 0;
  let drag = null;
  let dragged = false;
  let dragsBeforeShake = 2;
  let warmupDrag = null;
  let contextLost = false;
  let exploring = false;
  let keyboardTrail = newShake();

  async function tryEscape() {
    if (exploring) return;
    exploring = true;
    keyboardTrail = newShake();
    try {
      const { openCollage } = await import("./duck-collage.js");
      await openCollage(turn, reducedMotion.matches, dialog => {
        loose = { from: lastPose, start: performance.now(), yaw: 0, pitch: 0, targetYaw: 0.18, targetPitch: 0 };
        dialog.addEventListener("pointermove", event => {
          if (event.pointerType === "touch") return;
          const box = turn.getBoundingClientRect();
          const x = (event.clientX - box.left - box.width / 2) / (innerWidth / 2);
          const y = (box.top + box.height / 2 - event.clientY) / (innerHeight / 2);
          loose.targetYaw = 0.18 + Math.max(-0.62, Math.min(0.62, x * 0.68));
          loose.targetPitch = Math.max(-0.34, Math.min(0.34, y * 0.36));
          if (reducedMotion.matches) render(performance.now());
          syncAnimation();
        });
        dialog.addEventListener("pointerleave", () => {
          loose.targetYaw = 0.18;
          loose.targetPitch = 0;
          if (reducedMotion.matches) render(performance.now());
          syncAnimation();
        });
        render(performance.now());
        syncAnimation();
      });
    } finally {
      loose = null;
      render(performance.now());
      syncAnimation();
      exploring = false;
    }
  }

  function render(time) {
    if (contextLost) return;

    const density = Math.min(window.devicePixelRatio, 2);
    const width = Math.max(1, Math.round(canvas.clientWidth * density));
    const height = Math.max(1, Math.round(canvas.clientHeight * density));
    if (width !== canvas.width || height !== canvas.height) {
      canvas.width = width;
      canvas.height = height;
    }

    const elapsed = previousFrame ? Math.max(0, Math.min(time - previousFrame, 50)) : 16;
    previousFrame = time;
    if (loose) {
      const progress = reducedMotion.matches ? 1 : Math.min(1, (time - loose.start) / 960);
      const ease = progress * progress * (3 - 2 * progress);
      const follow = reducedMotion.matches ? 1 : 1 - Math.exp(-elapsed / 95);
      loose.yaw += (loose.targetYaw - loose.yaw) * follow;
      loose.pitch += (loose.targetPitch - loose.pitch) * follow;
      lastPose = easeRotation(loose.from, boardPose, ease);
      const face = multiply(axisRotation(horizontalAxis, loose.yaw), axisRotation(verticalAxis, loose.pitch));
      draw(width, height, lastPose, face, 0);
      return;
    }

    if (active && !drag) phase += elapsed * 0.002;
    const sway = multiply(axisRotation(horizontalAxis, Math.sin(phase * 0.69) * 0.23),
      axisRotation(verticalAxis, Math.sin(phase) * 0.048));
    displayedOrientation = rotationPending()
      ? easeRotation(displayedOrientation, orientation, 1 - Math.exp(-elapsed / 22))
      : orientation;
    lastPose = multiply(displayedOrientation, sway);
    draw(width, height, lastPose, straightAhead, Math.sin(phase * 1.15) * 0.05);
  }

  function tick(time) {
    frame = 0;
    render(time);
    syncAnimation();
  }

  function rotationPending() {
    const dot = displayedOrientation.reduce((sum, component, i) => sum + component * orientation[i], 0);
    return !reducedMotion.matches && Math.abs(dot) < 0.9999998;
  }

  function syncAnimation() {
    const moving = loose ? !reducedMotion.matches && (
      performance.now() - loose.start < 980 ||
      Math.hypot(loose.targetYaw - loose.yaw, loose.targetPitch - loose.pitch) > 0.001
    ) : rotationPending() || (active && !drag);
    if (moving && inView && !document.hidden && !contextLost) {
      if (!frame) frame = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(frame);
      frame = 0;
      previousFrame = 0;
    }
  }

  function setMotion(value) {
    active = value;
    motion.dataset.playing = String(value);
    motion.setAttribute("aria-label", value ? "Pause duck motion" : "Play duck motion");
    render(performance.now());
    syncAnimation();
  }

  const intersection = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    syncAnimation();
  });
  const resize = new ResizeObserver(() => render(performance.now()));

  function settleWarmup(completed) {
    if (completed && warmupDrag?.moved) dragsBeforeShake -= 1;
    warmupDrag = null;
  }

  function onWarmupEnd(event) {
    if (warmupDrag?.id === event.pointerId) settleWarmup(event.type === "pointerup");
  }

  // A drag can release outside the duck after pointer capture is lost.
  window.addEventListener("pointerup", onWarmupEnd, true);
  window.addEventListener("pointercancel", onWarmupEnd, true);

  turn.addEventListener("pointerdown", event => {
    if (exploring || !event.isPrimary || event.button !== 0) return;
    // A new press also settles a drag whose release left the browser.
    settleWarmup(true);
    if (dragsBeforeShake > 0) warmupDrag = { id: event.pointerId, moved: false };
    const bounds = turn.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const span = Math.max(1, Math.min(bounds.width, bounds.height));
    drag = {
      id: event.pointerId, x, y, centerX, centerY,
      onRim: Math.hypot(x - centerX, y - centerY) > span * 0.47,
      radiansPerPixel: 2.65 / span,
      span,
      trail: dragsBeforeShake === 0 ? newShake(event.timeStamp) : null,
    };
    dragged = false;
    turn.setPointerCapture(event.pointerId);
    syncAnimation();
  });

  turn.addEventListener("pointermove", event => {
    if (drag?.id !== event.pointerId) return;
    const samples = event.getCoalescedEvents?.();
    for (const sample of samples?.length ? samples : [event]) {
      const dx = sample.clientX - drag.x;
      const dy = sample.clientY - drag.y;
      if (Math.hypot(dx, dy) < (dragged ? 0.01 : 2)) continue;

      // Captured pointer deltas remain useful even well outside the canvas.
      const axis = dragVector(drag, dx, dy, event.shiftKey);
      const distance = Math.hypot(...axis);
      const angle = distance * drag.radiansPerPixel;
      orientation = normalize(multiply(axisRotation(axis.map(component => component / distance), angle), orientation));
      drag.x = sample.clientX;
      drag.y = sample.clientY;
      dragged = true;
      if (warmupDrag?.id === event.pointerId) warmupDrag.moved = true;
      if (drag.trail && recordShake(drag.trail, dx / drag.span, dy / drag.span, sample.timeStamp)) {
        drag = null;
        if (turn.hasPointerCapture(event.pointerId)) turn.releasePointerCapture(event.pointerId);
        tryEscape().catch(() => {});
        break;
      }
    }
    if (reducedMotion.matches) render(performance.now());
    syncAnimation();
  });

  turn.addEventListener("lostpointercapture", event => {
    if (drag?.id !== event.pointerId) return;
    drag = null;
    syncAnimation();
  });
  turn.addEventListener("click", event => {
    // Keep keyboard activation, but leave a mouse click or tap at the current pose.
    if (exploring || event.detail !== 0) return;
    orientation = normalize(multiply(axisRotation(horizontalAxis, Math.PI / 5), orientation));
    render(performance.now());
    syncAnimation();
  });

  turn.addEventListener("keydown", event => {
    const horizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";
    const vertical = event.key === "ArrowUp" || event.key === "ArrowDown";
    if (exploring || (!horizontal && !vertical)) return;
    event.preventDefault();
    const axis = event.shiftKey ? rollAxis : (horizontal ? horizontalAxis : verticalAxis);
    const step = event.key === "ArrowLeft" || event.key === "ArrowDown" ? -0.3 : 0.3;
    orientation = normalize(multiply(axisRotation(axis, step), orientation));
    render(performance.now());
    syncAnimation();
    if (recordShake(keyboardTrail, step / 2.65, 0, event.timeStamp)) tryEscape().catch(() => {});
  });

  motion.addEventListener("click", () => setMotion(!active));
  reducedMotion.addEventListener("change", () => setMotion(!reducedMotion.matches));
  document.addEventListener("visibilitychange", syncAnimation);

  canvas.addEventListener("webglcontextlost", () => {
    contextLost = true;
    syncAnimation();
    resize.disconnect();
    intersection.disconnect();
    poster.hidden = false;
    turn.hidden = true;
    motion.hidden = true;
  });

  turn.hidden = false;
  motion.hidden = false;
  setMotion(active);
  poster.hidden = true;
  resize.observe(canvas);
  intersection.observe(turn);
}

const mascot = document.querySelector("[data-duck-mesh]");
if (mascot) {
  // The rendered poster remains in place if the mesh or WebGL is unavailable.
  mountDuck(mascot).catch(() => {});
}
