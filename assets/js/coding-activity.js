// Draws the last seven days of WakaTime activity as a bar chart in the site's own style.
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function duration(seconds) {
  // WakaTime rounds down to the minute, so match its own totals.
  const minutes = Math.floor(seconds / 60);
  if (minutes === 0) return "0";
  const hours = Math.floor(minutes / 60);
  if (hours === 0) return `${minutes}m`;
  return minutes % 60 ? `${hours}h ${minutes % 60}m` : `${hours}h`;
}

function draw(chart, days) {
  const seconds = days.map(day => day.grand_total.total_seconds);
  const total = seconds.reduce((sum, value) => sum + value, 0);
  const peak = Math.max(...seconds);
  const peakHours = peak / 3600;
  const step = peakHours <= 4 ? 1 : peakHours <= 8 ? 2 : 4;
  const top = Math.max(step, Math.ceil(peakHours / step) * step);

  const bar = element("header", "coding-chart__bar");
  bar.append(element("span", "", "Last 7 days"), element("span", "", `${duration(total)} total`));

  const plot = element("div", "coding-chart__plot");
  const grid = element("div", "coding-chart__grid");
  grid.setAttribute("aria-hidden", "true");
  for (let hours = step; hours <= top; hours += step) {
    const line = element("span", "", `${hours}h`);
    line.style.setProperty("--at", hours / top);
    grid.append(line);
  }

  const list = element("ol", "coding-chart__days");
  for (const [index, day] of days.entries()) {
    const [, month, date] = day.range.date.split("-").map(Number);
    const item = element("li", seconds[index] === peak && peak > 0 ? "is-peak" : "");
    if (seconds[index] === 0) item.classList.add("is-empty");
    item.style.setProperty("--share", seconds[index] / (top * 3600));
    item.style.setProperty("--order", index);
    const label = element("span", "coding-chart__day", day.range.text.slice(0, 3));
    label.append(element("small", "", `${months[month - 1]} ${date}`));
    item.append(element("span", "coding-chart__value", duration(seconds[index])), element("i", ""), label);
    list.append(item);
  }
  plot.append(grid, list);

  const note = element("p", "coding-chart__note");
  note.append(`Daily average ${duration(total / days.length)} · tracked by `);
  const source = element("a", "", "WakaTime");
  source.href = "https://wakatime.com/";
  note.append(source);

  chart.replaceChildren(bar, plot, note);
  // Bars grow from the baseline the first time the chart scrolls into view.
  new IntersectionObserver(([entry], observer) => {
    if (!entry.isIntersecting) return;
    chart.classList.add("is-drawn");
    observer.disconnect();
  }, { threshold: 0.35 }).observe(chart);
}

const chart = document.querySelector("[data-coding-activity]");
if (chart) {
  fetch(chart.dataset.codingActivity)
    .then(response => response.ok ? response.json() : Promise.reject())
    .then(({ data }) => {
      if (!Array.isArray(data) || !data.length) throw new Error("no days");
      draw(chart, data);
    })
    // WakaTime's own chart stays as the fallback when the data cannot be read.
    .catch(() => {
      const fallback = chart.dataset.fallback;
      if (!fallback) return;
      const embed = document.createElement("embed");
      embed.src = fallback;
      chart.replaceChildren(embed);
    });
}
