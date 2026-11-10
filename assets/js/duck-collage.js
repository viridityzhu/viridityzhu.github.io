function element(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function makePaperPanel(board, paper) {
  const title = paper.querySelector("strong").textContent.trim();
  const panel = element("section", "collage-panel");
  const grip = element("button", "collage-grip");
  grip.type = "button";
  grip.textContent = title.split(":")[0];
  grip.setAttribute("aria-label", `Move ${title}`);
  const content = element("div", "collage-content");
  panel.append(grip, content);
  board.append(panel);
  return content;
}

function installDragging(dialog, board) {
  const scroll = dialog.querySelector(".collage-scroll");
  let layer = 0;
  let drag = null;
  const positions = new Map();

  function place(panel, x, y) {
    const visible = Math.min(110, panel.offsetWidth);
    const left = panel.offsetLeft;
    const top = panel.offsetTop;
    x = Math.min(board.clientWidth - visible - left, Math.max(visible - panel.offsetWidth - left, x));
    y = Math.min(board.clientHeight - 40 - top, Math.max(-top, y));
    positions.set(panel, { x, y });
    panel.style.setProperty("--panel-x", `${x}px`);
    panel.style.setProperty("--panel-y", `${y}px`);
  }

  board.addEventListener("focusin", event => {
    const panel = event.target.closest(".collage-panel");
    if (panel) panel.style.zIndex = ++layer;
  });

  board.addEventListener("pointerdown", event => {
    const grip = event.target.closest(".collage-grip");
    if (!grip || !event.isPrimary || event.button !== 0) return;
    const panel = grip.parentElement;
    panel.style.zIndex = ++layer;
    drag = {
      id: event.pointerId,
      panel,
      x: event.clientX,
      y: event.clientY,
      scrollTop: scroll.scrollTop,
      start: positions.get(panel) || { x: 0, y: 0 },
    };
    grip.setPointerCapture(event.pointerId);
  });

  board.addEventListener("pointermove", event => {
    if (drag?.id !== event.pointerId) return;
    place(drag.panel, drag.start.x + event.clientX - drag.x,
      drag.start.y + event.clientY - drag.y + scroll.scrollTop - drag.scrollTop);
  });
  board.addEventListener("lostpointercapture", () => { drag = null; });

  const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  board.addEventListener("keydown", event => {
    const grip = event.target.closest(".collage-grip");
    if (!grip || !Object.hasOwn(arrows, event.key)) return;
    event.preventDefault();
    const panel = grip.parentElement;
    const { x, y } = positions.get(panel) || { x: 0, y: 0 };
    const [dx, dy] = arrows[event.key];
    place(panel, x + dx * 24, y + dy * 24);
  });

  dialog.querySelector("[data-collage-reset]").addEventListener("click", () => {
    for (const panel of board.querySelectorAll(".collage-panel")) {
      panel.style.removeProperty("--panel-x");
      panel.style.removeProperty("--panel-y");
      panel.style.removeProperty("z-index");
    }
    positions.clear();
    layer = 0;
  });
}

function closestPoint(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / Math.max(1, dx * dx + dy * dy)));
  const x = point.x - start.x - t * dx;
  const y = point.y - start.y - t * dy;
  return { x, y, t, distance: Math.hypot(x, y) };
}

function pushAside(path, duration) {
  const animations = [];
  const targets = document.querySelectorAll("#main .sidebar, #main .page__title, .academic-intro > p, .page__content > h1, .publication_div");
  for (const target of targets) {
    const box = target.getBoundingClientRect();
    if (box.bottom < 0 || box.top > innerHeight) continue;
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const first = closestPoint(point, path[0], path[1]);
    const second = closestPoint(point, path[1], path[2]);
    const near = first.distance < second.distance ? first : second;
    if (near.distance > 250) continue;
    const progress = (near.t + (near === first ? 0 : 1)) / 2;
    const dx = near.x / Math.max(1, near.distance);
    const dy = near.y / Math.max(1, near.distance) || -1;
    const force = 54 + (1 - near.distance / 250) * 145;
    animations.push(target.animate([
      { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
      { transform: `translate(${dx * force}px, ${dy * force}px) rotate(${dx * 6}deg)`, opacity: 0.62 },
    ], { delay: progress * duration * 0.58, duration: 1080, easing: "cubic-bezier(.33,.1,.32,1)", fill: "forwards" }));
  }
  return animations;
}

export async function openCollage(turn, reducedMotion, prepareDuck) {
  const template = document.querySelector("#duck-collage-template");
  const dialog = template.content.querySelector("dialog").cloneNode(true);
  const question = template.content.querySelector(".collage-question").cloneNode(true);
  const board = dialog.querySelector(".collage-board");
  const dock = dialog.querySelector(".collage-duck");
  const publications = [...document.querySelectorAll(".page__content > .publication_div")];
  const originalScroll = window.scrollY;
  const moves = [];
  const animations = [];
  const flight = element("div", "collage-flight");
  flight.setAttribute("aria-hidden", "true");
  flight.inert = true;
  let timer;
  let stackEdge;
  let cancel;
  const cancelled = new Promise(resolve => { cancel = () => resolve(false); });

  function move(node, destination) {
    const marker = document.createComment("collage position");
    node.before(marker);
    moves.push([marker, node]);
    destination.append(node);
  }

  function cancelBeforeOpening(event) {
    if (event.key === "Escape" && !dialog.open) cancel();
  }

  try {
    document.body.classList.add("collage-open");
    document.body.append(flight, dialog, question);
    const box = turn.getBoundingClientRect();
    turn.disabled = true;
    prepareDuck(dialog);
    window.addEventListener("keydown", cancelBeforeOpening);
    question.style.left = `${Math.max(8, Math.min(innerWidth - 72, box.right - 24))}px`;
    question.style.top = `${Math.max(8, box.top - 66)}px`;
    question.classList.toggle("is-still", reducedMotion);
    const pause = new Promise(resolve => {
      timer = window.setTimeout(() => resolve(true), reducedMotion ? 600 : 1780);
    });
    if (!await Promise.race([pause, cancelled])) return;

    let arrival;
    move(turn, flight);
    if (!reducedMotion) {
      const narrow = innerWidth < 980;
      const size = narrow ? Math.min(innerWidth * 0.98, 420) : Math.min(innerWidth * 0.64, innerHeight * 0.96, 850);
      const path = [
        { x: box.x + box.width / 2, y: box.y + box.height / 2 },
        { x: innerWidth * 0.45, y: innerHeight * 0.43 },
        { x: innerWidth * 0.5, y: narrow ? Math.min(innerHeight * 0.53, 112 + size / 2) : innerHeight * 0.53 },
      ];
      const duration = 2630;
      flight.style.width = `${size}px`;
      const shoves = pushAside(path, duration);
      animations.push(...shoves);
      animations.push(question.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 440, fill: "forwards" }));
      const startScale = box.width / size;
      const scales = [startScale, (1 + startScale) / 2, 1];
      const launch = flight.animate(path.map(({ x, y }, index) => {
        const scale = scales[index];
        return { transform: `translate(${x - size * scale / 2}px, ${y - size * scale / 2}px) scale(${scale})` };
      }), { duration, easing: "cubic-bezier(.36,.05,.27,1)", fill: "forwards" });
      animations.push(launch);
      if (!await Promise.race([launch.finished.then(() => true), cancelled])) return;
      arrival = flight.getBoundingClientRect();
      for (const shove of shoves) shove.cancel();
    }

    question.remove();
    dock.append(turn);
    flight.remove();
    for (const paper of publications) {
      move(paper, makePaperPanel(board, paper));
    }

    installDragging(dialog, board);
    const closed = new Promise(resolve => {
      function returnToPage(event) {
        event.preventDefault();
        resolve();
      }
      dialog.addEventListener("cancel", returnToPage);
      dialog.querySelector("form").addEventListener("submit", returnToPage);
      dialog.addEventListener("close", resolve, { once: true });
    });
    dialog.showModal();
    const leadPaper = board.firstElementChild;
    const alignStack = () => {
      board.style.setProperty("--small-window-top", `${leadPaper.offsetTop + leadPaper.offsetHeight - 7}px`);
    };
    alignStack();
    stackEdge = new ResizeObserver(alignStack);
    stackEdge.observe(leadPaper);
    stackEdge.observe(board);
    if (arrival) {
      const final = dock.getBoundingClientRect();
      const x = arrival.x + arrival.width / 2 - final.x - final.width / 2;
      const y = arrival.y + arrival.height / 2 - final.y - final.height / 2;
      animations.push(turn.animate([
        { transform: `translate(${x}px, ${y}px) scale(${arrival.width / final.width})` },
        { transform: "none" },
      ], { duration: 620, easing: "ease-out" }));
      animations.push(dialog.animate([
        { backgroundColor: "var(--portfolio-paper)" },
        { backgroundColor: "var(--portfolio-turquoise)" },
      ], { duration: 470 }));
      for (const [index, panel] of [...board.children].entries()) {
        const towardEdge = panel.offsetLeft < board.clientWidth / 2 ? 70 : -70;
        animations.push(panel.animate([
          { translate: `${towardEdge}px 8px`, opacity: 0 },
          { translate: "0 0", opacity: 1 },
        ], { duration: 660, delay: index * 36, easing: "ease-out", fill: "backwards" }));
      }
    }
    await closed;
  } finally {
    window.removeEventListener("keydown", cancelBeforeOpening);
    window.clearTimeout(timer);
    stackEdge?.disconnect();
    for (const animation of animations) animation.cancel();
    for (const [marker, node] of moves) marker.replaceWith(node);
    dialog.remove();
    flight.remove();
    question.remove();
    document.body.classList.remove("collage-open");
    window.scrollTo(0, originalScroll);
    turn.disabled = false;
    turn.focus({ preventScroll: true });
  }
}
