import { playQuack } from "./duck-forms/stage.js";

// The three evolved forms. `tiers` name each form's calm, roused and unleashed animation.
const forms = {
  mk4: {
    module: "./duck-forms/mk4.js",
    create: "createMk4",
    code: "MK-IV",
    tiers: ["Idle scan", "Hound prowl", "Overdrive"],
  },
  wasteland: {
    module: "./duck-forms/thunder.js",
    create: "createThunder",
    code: "WASTELAND",
    tiers: ["Idle", "Nitro charge", "Overload"],
  },
  xianxia: {
    module: "./duck-forms/thunder.js",
    create: "createThunder",
    code: "XIANXIA",
    tiers: ["Idle", "Flying swords", "Tribulation"],
  },
};

// How long the old duck flickers before the flash that swaps it for the new one.
const evolveTime = 1400;
// Charge needed to rouse the duck, and (lower) to let it settle again.
const rouse = [0.34, 1];
const settle = [0.16, 0.55];

function remembered(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function remember(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private windows may refuse storage; the choice then simply is not kept.
  }
}

// A random form, never the one seen last time. `?duck=mk4` (or wasteland, xianxia)
// asks for one, and `?duck=classic` keeps the plain collage.
function pickForm() {
  const asked = new URLSearchParams(location.search).get("duck");
  if (asked === "classic") return null;
  const ids = Object.keys(forms);
  if (ids.includes(asked)) return asked;
  const last = remembered("duck-form");
  const pool = ids.filter(id => id !== last);
  const id = pool[Math.floor(Math.random() * pool.length)];
  remember("duck-form", id);
  return id;
}

// Loads three.js and builds the chosen form off screen, so it is ready by the
// time the duck has swum to the middle. Rejects where WebGL is unavailable.
export async function prepareEvolution() {
  const id = pickForm();
  if (!id) return null;
  const meta = forms[id];
  const [THREE, module] = await Promise.all([
    import("./vendor/three/three.module.min.js"),
    import(meta.module),
  ]);
  const container = document.createElement("div");
  const form = module[meta.create](THREE, { container, width: innerWidth, height: innerHeight, form: id });
  return { form, mount: dialog => mountEvolution(dialog, id, meta, form) };
}

function mountEvolution(dialog, id, meta, form) {
  const stage = dialog.querySelector(".collage-stage");
  const dock = dialog.querySelector(".collage-duck");
  const meter = dialog.querySelector(".thunder-meter");
  const tiers = [...dialog.querySelectorAll(".thunder-tiers li")];
  const toast = dialog.querySelector(".thunder-toast");
  const soundButton = dialog.querySelector("[data-thunder-sound]");
  let charge = 0;
  let tier = 0;
  let lastInput = 0;
  let previousTick = performance.now();
  let sound = remembered("duck-sound") !== "off";
  let toastTimer;
  let evolveTimer;
  let ticker;
  let disposed = false;

  dialog.dataset.form = id;
  dialog.dataset.tier = 0;
  dialog.querySelector(".thunder-code").textContent = ` // ${meta.code}`;
  for (const [index, item] of tiers.entries()) item.textContent = meta.tiers[index];
  for (const node of dialog.querySelectorAll("[data-thunder]")) node.hidden = false;
  stage.append(form.canvas);

  function say(text) {
    toast.textContent = text;
    toast.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-on"), 2400);
  }

  function showCharge() {
    meter.style.setProperty("--charge", charge.toFixed(3));
    meter.setAttribute("aria-valuenow", Math.round(charge * 100));
    meter.setAttribute("aria-valuetext", meta.tiers[tier]);
  }

  function showSound() {
    soundButton.textContent = sound ? "Sound on" : "Sound off";
    soundButton.setAttribute("aria-pressed", String(sound));
  }

  // Rousing needs more charge than staying roused, so a tier never flickers at its edge.
  function settleTier() {
    let next = tier;
    while (next < 2 && charge >= rouse[next]) next += 1;
    while (next > 0 && charge < settle[next - 1]) next -= 1;
    if (next === tier) return false;
    const rising = next > tier;
    tier = next;
    dialog.dataset.tier = tier;
    for (const [index, item] of tiers.entries()) item.toggleAttribute("data-on", index === tier);
    form.setTier(tier);
    say(`${rising ? "⚡ " : ""}${meta.tiers[tier]}`);
    if (rising && tier === 2) flash(520, 0.55);
    return true;
  }

  function feed(amount) {
    charge = Math.min(1, charge + amount);
    lastInput = performance.now();
    const changed = settleTier();
    showCharge();
    return changed;
  }

  function flash(duration, peak) {
    dialog.querySelector(".collage-flash").animate(
      [{ opacity: 0 }, { opacity: peak, offset: 0.14 }, { opacity: 0 }],
      { duration, easing: "ease-out" },
    );
  }

  function poke() {
    form.quack();
    if (sound) playQuack(id);
    if (!feed(0.16)) say("⚡ Quack!!");
  }

  function tick() {
    const now = performance.now();
    const elapsed = Math.min(0.5, (now - previousTick) / 1000);
    previousTick = now;
    // The unleashed tier burns its charge at once; the others hold it for a moment first.
    if (charge > 0 && (tier === 2 || now - lastInput > 1400)) {
      charge = Math.max(0, charge - elapsed * 0.065);
      settleTier();
      showCharge();
    }
  }

  function frameDuck() {
    const area = stage.getBoundingClientRect();
    const box = dock.getBoundingClientRect();
    if (!area.width || !area.height) return;
    form.resize(area.width, area.height, {
      x: box.x - area.x + box.width / 2,
      y: box.y - area.y + box.height / 2,
      size: box.width,
    });
  }

  function onKey(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "q" || event.key === "Q") poke();
    else if (event.key === "1") calm();
    else if (event.key === "2") feed(Math.max(0, 0.6 - charge));
    else if (event.key === "3") feed(1);
  }

  function onVisibility() {
    if (document.hidden) form.stop();
    else form.start();
  }

  function calm() {
    charge = 0;
    settleTier();
    showCharge();
  }

  form.orbit.onPoke = event => {
    const box = dock.getBoundingClientRect();
    const reach = Math.hypot(event.clientX - box.x - box.width / 2, event.clientY - box.y - box.height / 2);
    if (reach < box.width * 0.36) poke();
  };
  form.orbit.onShake = () => feed(0.24);

  const resize = new ResizeObserver(frameDuck);
  resize.observe(stage);
  resize.observe(dock);
  dialog.addEventListener("keydown", onKey);
  document.addEventListener("visibilitychange", onVisibility);
  soundButton.addEventListener("click", () => {
    sound = !sound;
    remember("duck-sound", sound ? "on" : "off");
    showSound();
  });
  tiers[0].toggleAttribute("data-on", true);
  showSound();
  showCharge();

  return {
    // The old duck flickers under the bolts, then a flash swaps in the evolved one.
    reveal() {
      dialog.dataset.phase = "evolving";
      frameDuck();
      form.start();
      evolveTimer = setTimeout(() => {
        dialog.dataset.phase = "evolved";
        flash(760, 1);
        form.reveal();
        say(`⚡ Evolved // ${meta.code}`);
        ticker = setInterval(tick, 100);
      }, evolveTime);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clearTimeout(toastTimer);
      clearTimeout(evolveTimer);
      clearInterval(ticker);
      resize.disconnect();
      dialog.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
      form.stop();
    },
  };
}
