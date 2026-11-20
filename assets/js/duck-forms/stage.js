// Shared plumbing for the evolved duck forms: a small orbit control that also
// reports pokes and shakes, camera framing, the quack synth, and teardown.

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

// Drag turns the camera around the duck. It keeps its distance (the wheel is
// left to the board), and drifts back to the opening view once left alone.
export function createOrbit(THREE, camera, dom) {
  const target = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const view = new THREE.Spherical();
  let home = null;
  let scale = 1;
  let turn = 0;
  let tilt = 0;
  let drag = null;
  let touched = 0;

  function onDown(event) {
    if (!event.isPrimary || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp,
      moved: 0, direction: 0, run: 0, flips: [] };
    dom.setPointerCapture(event.pointerId);
  }

  function onMove(event) {
    if (drag?.id !== event.pointerId || !home) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    drag.moved += Math.hypot(dx, dy);
    const radians = 3.2 / Math.max(240, dom.clientHeight);
    turn = -dx * radians;
    tilt = -dy * radians;
    view.theta += turn;
    view.phi += tilt;
    touched = performance.now();

    // A shake is three quick reversals of a sideways drag.
    const direction = Math.sign(dx);
    if (!direction) return;
    if (direction !== drag.direction) {
      if (drag.direction && drag.run > 26) {
        drag.flips = drag.flips.filter(time => event.timeStamp - time < 700);
        drag.flips.push(event.timeStamp);
        if (drag.flips.length >= 3) {
          drag.flips.length = 1;
          orbit.onShake?.();
        }
      }
      drag.direction = direction;
      drag.run = 0;
    }
    drag.run += Math.abs(dx);
  }

  function onUp(event) {
    if (drag?.id !== event.pointerId) return;
    const poke = drag.moved < 8 && event.timeStamp - drag.time < 450;
    drag = null;
    if (poke) orbit.onPoke?.(event);
  }

  function onLost(event) {
    if (drag?.id === event.pointerId) drag = null;
  }

  function onWheel(event) {
    orbit.onWheel?.(event);
  }

  dom.addEventListener("pointerdown", onDown);
  dom.addEventListener("pointermove", onMove);
  dom.addEventListener("pointerup", onUp);
  dom.addEventListener("lostpointercapture", onLost);
  dom.addEventListener("wheel", onWheel, { passive: true });

  const orbit = {
    target,
    minPolarAngle: 0.5,
    maxPolarAngle: Math.PI * 0.495,
    onPoke: null,
    onShake: null,
    onWheel: null,
    setScale(value) { scale = value; },
    // Start the view off to one side; update() eases it back home.
    spin(angle) {
      if (home) view.theta = home.theta + angle;
      touched = 0;
    },
    update() {
      if (!home) {
        offset.copy(camera.position).sub(target);
        view.setFromVector3(offset);
        home = { theta: view.theta, phi: view.phi, radius: view.radius };
      }
      if (!drag) {
        view.theta += turn;
        view.phi += tilt;
        turn *= 0.9;
        tilt *= 0.9;
        if (performance.now() - touched > 2600) {
          const full = Math.PI * 2;
          const back = ((home.theta - view.theta + Math.PI) % full + full) % full - Math.PI;
          view.theta += back * 0.035;
          view.phi += (home.phi - view.phi) * 0.035;
        }
      }
      view.phi = clamp(view.phi, orbit.minPolarAngle, orbit.maxPolarAngle);
      view.radius += (home.radius * scale - view.radius) * 0.14;
      camera.position.setFromSpherical(view).add(target);
      camera.lookAt(target);
    },
    dispose() {
      dom.removeEventListener("pointerdown", onDown);
      dom.removeEventListener("pointermove", onMove);
      dom.removeEventListener("pointerup", onUp);
      dom.removeEventListener("lostpointercapture", onLost);
      dom.removeEventListener("wheel", onWheel);
    },
  };
  return orbit;
}

// Frame the duck inside `box` (a square of the canvas, in CSS pixels) while the
// scene itself fills the whole canvas.
export function fitStage(camera, orbit, width, height, box) {
  camera.aspect = width / height;
  orbit.setScale(clamp(height / box.size * 1.02, 0.85, 3.4));
  const dx = width / 2 - box.x;
  const dy = height / 2 - box.y;
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) camera.setViewOffset(width, height, dx, dy, width, height);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}

// A full-window canvas at a phone's or laptop's native density is most of the
// frame's cost, so start below it and step down further while frames run long.
export function createPacer(renderer) {
  let ratio = Math.min(window.devicePixelRatio, 1.5);
  let previous = 0;
  let slow = 0;
  let counted = 0;
  renderer.setPixelRatio(ratio);
  return () => {
    const now = performance.now();
    const gap = now - previous;
    previous = now;
    // Long gaps are a hidden tab or a stall elsewhere, not this scene's doing.
    if (gap > 120) return;
    counted += 1;
    if (gap > 24) slow += 1;
    if (counted < 45) return;
    if (slow > 22 && ratio > 1) {
      ratio = Math.max(1, ratio * 0.8);
      renderer.setPixelRatio(ratio);
    }
    counted = 0;
    slow = 0;
  };
}

export function disposeStage(scene, renderer) {
  const seen = new Set();
  scene.traverse(node => {
    node.geometry?.dispose();
    for (const material of [].concat(node.material || [])) {
      if (seen.has(material)) continue;
      seen.add(material);
      material.map?.dispose();
      material.dispose();
    }
  });
  renderer.dispose();
  renderer.forceContextLoss();
  renderer.domElement.remove();
}

// A synthesized quack with a thunder crack behind it; no audio files.
let audio = null;
export function playQuack(theme) {
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    if (!audio) audio = new Context();
    if (audio.state === "suspended") audio.resume();
    const now = audio.currentTime;
    const celestial = theme === "xianxia";
    const pitch = celestial ? 390 : theme === "mk4" ? 285 : 320;

    // The nasal quack: saw and square through a swept band-pass.
    const voice = audio.createOscillator();
    const under = audio.createOscillator();
    const formant = audio.createBiquadFilter();
    const level = audio.createGain();
    voice.type = "sawtooth";
    under.type = "square";
    voice.frequency.setValueAtTime(pitch * 1.18, now);
    voice.frequency.exponentialRampToValueAtTime(pitch * 0.72, now + 0.17);
    voice.frequency.exponentialRampToValueAtTime(pitch * 0.92, now + 0.24);
    under.frequency.setValueAtTime(pitch * 0.5, now);
    under.frequency.exponentialRampToValueAtTime(pitch * 0.36, now + 0.22);
    formant.type = "bandpass";
    formant.Q.setValueAtTime(5.2, now);
    formant.frequency.setValueAtTime(1650, now);
    formant.frequency.exponentialRampToValueAtTime(720, now + 0.14);
    formant.frequency.exponentialRampToValueAtTime(1350, now + 0.24);
    level.gain.setValueAtTime(0.001, now);
    level.gain.linearRampToValueAtTime(0.2, now + 0.02);
    level.gain.exponentialRampToValueAtTime(0.13, now + 0.14);
    level.gain.exponentialRampToValueAtTime(0.001, now + 0.29);
    voice.connect(formant);
    under.connect(formant);
    formant.connect(level);
    level.connect(audio.destination);
    voice.start(now);
    under.start(now);
    voice.stop(now + 0.3);
    under.stop(now + 0.3);

    // The crack: a decaying noise burst swept downwards.
    const length = Math.floor(audio.sampleRate * 0.42);
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      samples[i] = (Math.random() * 2 - 1) * Math.exp(-i / (length * 0.32));
    }
    const noise = audio.createBufferSource();
    noise.buffer = buffer;
    const sweep = audio.createBiquadFilter();
    sweep.type = "bandpass";
    sweep.frequency.setValueAtTime(celestial ? 2200 : 1400, now + 0.03);
    sweep.frequency.exponentialRampToValueAtTime(180, now + 0.42);
    sweep.Q.setValueAtTime(1.1, now + 0.03);
    const crack = audio.createGain();
    crack.gain.setValueAtTime(0.001, now + 0.02);
    crack.gain.linearRampToValueAtTime(0.2, now + 0.05);
    crack.gain.exponentialRampToValueAtTime(0.001, now + 0.44);
    noise.connect(sweep);
    sweep.connect(crack);
    crack.connect(audio.destination);
    noise.start(now + 0.02);

    // A gong for the immortal, an engine thump for the machines.
    const accent = audio.createOscillator();
    const accentLevel = audio.createGain();
    accent.type = celestial ? "triangle" : "sine";
    if (celestial) {
      accent.frequency.setValueAtTime(880, now + 0.03);
      accent.frequency.exponentialRampToValueAtTime(660, now + 0.38);
      accentLevel.gain.setValueAtTime(0.08, now + 0.03);
      accentLevel.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    } else {
      accent.frequency.setValueAtTime(110, now + 0.02);
      accent.frequency.exponentialRampToValueAtTime(42, now + 0.32);
      accentLevel.gain.setValueAtTime(0.2, now + 0.02);
      accentLevel.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    }
    accent.connect(accentLevel);
    accentLevel.connect(audio.destination);
    accent.start(now + 0.02);
    accent.stop(now + 0.44);
  } catch {
    // Sound is a bonus; a blocked or missing audio device changes nothing else.
  }
}
