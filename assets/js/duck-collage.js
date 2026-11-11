function element(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function makePaperPanel(board, paper, index) {
  const title = paper.querySelector("strong").textContent.trim();
  const panel = element("section", `collage-item collage-panel collage-paper collage-paper--${index}`);
  const grip = element("button", "collage-grip");
  grip.type = "button";
  grip.dataset.grip = "";
  grip.textContent = title.split(":")[0];
  grip.setAttribute("aria-label", `Move ${title}`);
  const content = element("div", "collage-content");
  panel.append(grip, content);
  board.append(panel);
  return content;
}

// The little colour grid nods to the reference's Pixelated window: tap a cell for a new colour.
function fillPixels(grid) {
  const colours = 5;
  let seed = 20260711;
  for (let i = 0; i < 63; i++) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const cell = element("i", "");
    cell.dataset.colour = Math.floor(seed / 65536) % colours;
    grid.append(cell);
  }
  grid.addEventListener("click", event => {
    const cell = event.target.closest("[data-colour]");
    if (cell) cell.dataset.colour = (Number(cell.dataset.colour) + 1) % colours;
  });
}

function installDragging(dialog, board) {
  const scroll = dialog.querySelector(".collage-scroll");
  let layer = 20;
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
    const panel = event.target.closest(".collage-item");
    if (panel) panel.style.zIndex = ++layer;
  });

  board.addEventListener("pointerdown", event => {
    const grip = event.target.closest("[data-grip]");
    if (!grip || !event.isPrimary || event.button !== 0) return;
    const panel = grip.closest(".collage-item");
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
    const grip = event.target.closest("[data-grip]");
    if (!grip || !Object.hasOwn(arrows, event.key)) return;
    event.preventDefault();
    const panel = grip.closest(".collage-item");
    const { x, y } = positions.get(panel) || { x: 0, y: 0 };
    const [dx, dy] = arrows[event.key];
    place(panel, x + dx * 24, y + dy * 24);
  });

  dialog.querySelector("[data-collage-reset]").addEventListener("click", () => {
    for (const panel of board.querySelectorAll(".collage-item")) {
      panel.style.removeProperty("--panel-x");
      panel.style.removeProperty("--panel-y");
      panel.style.removeProperty("z-index");
    }
    positions.clear();
    layer = 20;
  });
}

// Page content the duck can shove: text goes word by word, the rest as whole blocks.
const wordRoots = ".academic-intro > p, .page__content > ul li, .page__content > h2, " +
  ".publication_div p, .sidebar .author__name, .sidebar .author__bio";
const blockRoots = "#main .page__title, .sidebar .author__avatar, .sidebar .author__urls li, .page__content > h1, " +
  ".publication_div img, .page__content > img, .page__content > figure, .page__content > hr, .coding-chart, .vote-container";

const boxedLabels = ".publication-distinction, .publication_div p:last-child a";

function onScreen(node) {
  const box = node.getBoundingClientRect();
  return box.width > 0 && box.bottom > -240 && box.top < innerHeight + 240;
}

function loosenPage() {
  const nodes = [];
  const roots = [];
  for (const root of document.querySelectorAll(wordRoots)) {
    if (!onScreen(root)) continue;
    roots.push(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    for (const text of texts) {
      if (!text.data.trim() || text.parentElement.classList.contains("duck-word")) continue;
      // Boxed labels travel in one piece so no empty box is left behind.
      const label = text.parentElement.closest(boxedLabels);
      if (label) {
        if (!nodes.includes(label)) nodes.push(label);
        continue;
      }
      const words = document.createDocumentFragment();
      for (const part of text.data.split(/(\s+)/)) {
        if (!part.trim()) {
          words.append(part);
          continue;
        }
        const word = element("span", "duck-word");
        word.textContent = part;
        words.append(word);
        nodes.push(word);
      }
      text.replaceWith(words);
    }
  }
  for (const block of document.querySelectorAll(blockRoots)) {
    if (onScreen(block)) nodes.push(block);
  }

  const pieces = nodes.map((node, index) => {
    const box = node.getBoundingClientRect();
    return {
      node,
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
      girth: Math.min(box.width, box.height, 120) / 2,
      spin: ((index * 37) % 11 - 5) / 5,
      dx: 0,
      dy: 0,
    };
  });

  return {
    // Move every piece out of a disc as if the page were an incompressible sheet:
    // a point at distance d lands at sqrt(d² + r²), so nothing piles up at the rim.
    shove(cx, cy, radius, elapsed) {
      const follow = 1 - Math.exp(-elapsed / 40);
      for (const piece of pieces) {
        const x = piece.x - cx;
        const y = piece.y - cy;
        const distance = Math.hypot(x, y) || 1;
        const reach = radius + piece.girth + 10;
        // Fade the push with distance so only the neighbourhood of the rim gives way.
        const nearness = Math.min(1, Math.max(0, (2.6 * reach - distance) / (1.3 * reach)));
        const push = (Math.sqrt(distance * distance + reach * reach) - distance) * nearness * nearness * (3 - 2 * nearness);
        piece.dx += (x / distance * push - piece.dx) * follow;
        piece.dy += (y / distance * push - piece.dy) * follow;
        const moved = Math.hypot(piece.dx, piece.dy);
        if (moved < 0.3) continue;
        const tilt = Math.min(16, Math.max(0, moved - 10) / 7) * piece.spin;
        piece.node.style.transform = `translate(${piece.dx.toFixed(1)}px, ${piece.dy.toFixed(1)}px) rotate(${tilt.toFixed(1)}deg)`;
      }
    },
    restore() {
      for (const { node } of pieces) {
        if (node.className === "duck-word") node.replaceWith(node.textContent);
        else node.style.removeProperty("transform");
      }
      for (const root of roots) root.normalize();
      pieces.length = 0;
    },
  };
}

export async function openCollage(turn, reducedMotion, prepareDuck) {
  const template = document.querySelector("#duck-collage-template");
  const dialog = template.content.querySelector("dialog").cloneNode(true);
  const question = template.content.querySelector(".collage-question").cloneNode(true);
  const board = dialog.querySelector(".collage-board");
  const dock = dialog.querySelector(".collage-duck");
  const stock = dialog.querySelector(".collage-stock");
  const publications = [...document.querySelectorAll(".page__content > .publication_div")];
  const originalScroll = window.scrollY;
  const moves = [];
  const animations = [];
  const flight = element("div", "collage-flight");
  flight.setAttribute("aria-hidden", "true");
  flight.inert = true;
  let timer;
  let frame;
  let page;
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

  function deal(slot) {
    for (const art of stock.querySelectorAll(`[data-after="${slot}"]`)) board.append(art);
  }

  try {
    // Hiding the scrollbar must not reflow the page the duck is about to push.
    document.body.style.paddingRight = `${innerWidth - document.documentElement.clientWidth}px`;
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
      page = loosenPage();
      animations.push(question.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 440, fill: "forwards" }));
      const startScale = box.width / size;
      const scales = [startScale, (1 + startScale) / 2, 1];
      const launch = flight.animate(path.map(({ x, y }, index) => {
        const scale = scales[index];
        return { transform: `translate(${x - size * scale / 2}px, ${y - size * scale / 2}px) scale(${scale})` };
      }), { duration, easing: "cubic-bezier(.36,.05,.27,1)", fill: "forwards" });
      animations.push(launch);

      // The duck's outline pushes the page away for exactly as long as it swims:
      // the push starts with the launch and has cleared the window when the duck arrives.
      const cover = Math.hypot(innerWidth, innerHeight);
      let previous = performance.now();
      const step = time => {
        const rect = flight.getBoundingClientRect();
        const cx = rect.x + rect.width / 2;
        const cy = rect.y + rect.height / 2;
        const progress = Math.min(1, (launch.currentTime || 0) / duration);
        let radius = rect.width * 0.4;
        radius += (cover - radius) * progress ** 7;
        page.shove(cx, cy, radius, Math.min(250, time - previous));
        previous = time;
        frame = requestAnimationFrame(step);
      };
      step(previous);

      if (!await Promise.race([launch.finished.then(() => true), cancelled])) return;
      cancelAnimationFrame(frame);
      arrival = flight.getBoundingClientRect();
      // The dialog opens in this same task, so the restored words are never painted.
      page.restore();
    }

    question.remove();
    dock.append(turn);
    flight.remove();
    deal(0);
    for (const [index, paper] of publications.entries()) {
      move(paper, makePaperPanel(board, paper, index + 1));
      deal(index + 1);
    }
    stock.remove();
    fillPixels(board.querySelector("[data-collage-pixels]"));

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
    const leadPaper = board.querySelector(".collage-paper--1");
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
      animations.push(dialog.querySelector(".collage-bar").animate([
        { translate: "0 -100%" },
        { translate: "0 0" },
      ], { duration: 320, easing: "cubic-bezier(.2,.8,.3,1)" }));
      // Windows and stickers land one after another, each with a small overshoot.
      for (const [index, item] of [...board.children].entries()) {
        const towardEdge = item.offsetLeft < board.clientWidth / 2 ? 1 : -1;
        animations.push(item.animate([
          { translate: `${towardEdge * 46}px 26px`, scale: 0.82, opacity: 0 },
          { translate: "0 0", scale: 1.035, opacity: 1, offset: 0.68 },
          { translate: "0 0", scale: 1, opacity: 1 },
        ], { duration: 430, delay: 90 + index * 42, easing: "cubic-bezier(.2,.7,.3,1)", fill: "backwards" }));
      }
    }
    await closed;
  } finally {
    window.removeEventListener("keydown", cancelBeforeOpening);
    window.clearTimeout(timer);
    cancelAnimationFrame(frame);
    stackEdge?.disconnect();
    for (const animation of animations) animation.cancel();
    page?.restore();
    for (const [marker, node] of moves) marker.replaceWith(node);
    dialog.remove();
    flight.remove();
    question.remove();
    document.body.classList.remove("collage-open");
    document.body.style.removeProperty("padding-right");
    window.scrollTo(0, originalScroll);
    turn.disabled = false;
    turn.focus({ preventScroll: true });
  }
}
