/* Shared number formatters and SVG chart builders, used by script.js (report)
   and dashboard.js. Each chart function returns an SVG string. */

// ---------------------------------------------------------------- helpers
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const n0 = v => Number(v).toLocaleString("en-US");
const f1 = v => Number(v).toFixed(1);
const f2 = v => Number(v).toFixed(2);
const pc = v => `${f1(v)}%`;
const money = v => `${v < 0 ? "−" : ""}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (v, d = 1) => `${v < 0 ? "−" : "+"}${Math.abs(v).toFixed(d)}`;
const shortSeason = s => s.slice(2);
const maxBy = (arr, f) => arr.reduce((a, b) => (f(b) > f(a) ? b : a));
const minBy = (arr, f) => arr.reduce((a, b) => (f(b) < f(a) ? b : a));

// ---------------------------------------------------------------- flags
const FLAG_OF = {
  England: "england", "Premier League": "england", Championship: "england",
  France: "france", "Ligue 1": "france", "Ligue 2": "france",
  Germany: "germany", Bundesliga: "germany", "2. Bundesliga": "germany",
  Italy: "italy", "Serie A": "italy", "Serie B": "italy",
  Spain: "spain", "La Liga": "spain", "Segunda Division": "spain",
};
const flagSrc = name => (FLAG_OF[name] ? `img/flags/${FLAG_OF[name]}.svg` : "");
/* Inline flag followed by the name, for text; empty flag if the name has none. */
const withFlag = name => (flagSrc(name) ? `<img class="flag" src="${flagSrc(name)}" alt="" width="18" height="12"> ${esc(name)}` : esc(name));
/* Row label inside an SVG chart. With flags, labels are left-aligned after the flag. */
function rowLabel(it, labelW, y, dy, useFlags) {
  if (!useFlags) return `<text x="${labelW - 8}" y="${y + dy}" text-anchor="end">${esc(it.label)}</text>`;
  const src = it.flag ? `<image href="${it.flag}" x="0" y="${y + dy - 10}" width="18" height="12"/>` : "";
  return `${src}<text x="24" y="${y + dy}">${esc(it.label)}</text>`;
}

function niceStep(x) {
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const f = x / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}
function niceTicks(lo, hi) {
  const step = niceStep((hi - lo) / 5);
  const start = Math.floor(lo / step + 1e-9) * step;
  const end = Math.ceil(hi / step - 1e-9) * step;
  const ticks = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toFixed(6)));
  return { ticks, dec: Math.max(0, -Math.floor(Math.log10(step) + 1e-9)) };
}
const svg = (w, h, label, inner) =>
  `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${inner}</svg>`;
const legend = items => `<div class="legend">${items.map((t, i) => `<span class="l${i + 1}">${esc(t)}</span>`).join("")}</div>`;

// ---------------------------------------------------------------- charts
/* Horizontal bars. items: [{label, value, cls?, text?}]. Negative values
   extend left of a zero line. */
function hbar(items, { unit = "%", dec = 1, labelW = 150, max, label = "Bar chart" } = {}) {
  const W = 640, rowH = 28, top = 6, right = 64;
  const vals = items.map(i => i.value);
  const hi = max ?? Math.max(0, ...vals), lo = Math.min(0, ...vals);
  const barW = W - labelW - right;
  const scale = barW / ((hi - lo) || 1);
  const zeroX = labelW + (0 - lo) * scale;
  const H = top * 2 + rowH * items.length;
  const useFlags = items.some(it => it.flag);
  const rows = items.map((it, i) => {
    const y = top + i * rowH;
    const neg = it.value < 0;
    const w = Math.max(1, Math.abs(it.value) * scale);
    const x = neg ? zeroX - w : zeroX;
    const shown = it.text ?? `${it.value.toFixed(dec)}${unit}`;
    return `${rowLabel(it, labelW, y, 18, useFlags)}
      <rect class="${it.cls || (neg ? "neg" : "c1")}" x="${x}" y="${y + 4}" width="${w}" height="${rowH - 8}" rx="3"><title>${esc(it.label)}: ${esc(shown)}</title></rect>
      <text class="val" x="${neg ? zeroX + 6 : x + w + 6}" y="${y + 18}">${esc(shown)}</text>`;
  }).join("");
  const zeroLine = lo < 0 ? `<line class="axis" x1="${zeroX}" x2="${zeroX}" y1="${top}" y2="${H - top}"/>` : "";
  return svg(W, H, label, rows + zeroLine);
}

/* Stacked horizontal bars that each sum to 100. items: [{label, parts:[v1,v2,v3], names}] */
function stacked(items, { labelW = 130, rowH = 30, label = "Stacked bar chart" } = {}) {
  const W = 640, top = 6, right = 12;
  const barW = W - labelW - right;
  const H = top * 2 + rowH * items.length;
  const useFlags = items.some(it => it.flag);
  const rows = items.map((it, i) => {
    const y = top + i * rowH;
    let x = labelW;
    const segs = it.parts.map((v, k) => {
      const w = (v / 100) * barW;
      const seg = `<rect class="c${k + 1}" x="${x}" y="${y + 3}" width="${w}" height="${rowH - 6}"><title>${esc(it.names[k])}: ${f1(v)}%</title></rect>
        <text class="inbar" x="${x + w / 2}" y="${y + rowH / 2 + 4}" text-anchor="middle">${f1(v)}</text>`;
      x += w;
      return seg;
    }).join("");
    return `${rowLabel(it, labelW, y, rowH / 2 + 4, useFlags)}${segs}`;
  }).join("");
  return svg(W, H, label, rows);
}

/* Line chart. cats: x labels; series: [{name, values, dash?}] (up to 3).
   A null value leaves a gap in the line. */
function lineChart(cats, series, { unit = "", yMin, yMax, dec, label = "Line chart", markers = [] } = {}) {
  const W = 640, H = 300, m = { l: 52, r: 18, t: 16, b: 40 };
  const all = series.flatMap(s => s.values).filter(v => v !== null && v !== undefined);
  let lo = yMin ?? Math.min(...all), hi = yMax ?? Math.max(...all);
  const pad = (hi - lo) * 0.15 || 1;
  if (yMin === undefined) lo -= pad;
  if (yMax === undefined) hi += pad;
  const { ticks, dec: autoDec } = niceTicks(lo, hi);
  lo = ticks[0]; hi = ticks[ticks.length - 1];
  const d = dec ?? autoDec;
  const X = i => m.l + (i * (W - m.l - m.r)) / (cats.length - 1);
  const Y = v => m.t + ((hi - v) / (hi - lo)) * (H - m.t - m.b);
  const grid = ticks.map(t => `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}"/>
    <text x="${m.l - 8}" y="${Y(t) + 4}" text-anchor="end">${t.toFixed(d)}${unit}</text>`).join("");
  const xl = cats.map((c, i) => (cats.length > 10 && i % 2 ? "" :
    `<text x="${X(i)}" y="${H - m.b + 18}" text-anchor="middle">${esc(c)}</text>`)).join("");
  const lines = series.map((s, k) => {
    const runs = [];
    let run = [];
    s.values.forEach((v, i) => {
      if (v === null || v === undefined) { if (run.length) runs.push(run); run = []; }
      else run.push(`${X(i)},${Y(v)}`);
    });
    if (run.length) runs.push(run);
    const segs = runs.filter(r => r.length > 1).map(r => `<polyline class="s${k + 1}${s.dash ? " dash" : ""}" points="${r.join(" ")}"/>`).join("");
    const dots = s.values.map((v, i) => (v === null || v === undefined ? "" :
      `<circle class="p${k + 1}" cx="${X(i)}" cy="${Y(v)}" r="3.5"><title>${esc(s.name)}, ${esc(cats[i])}: ${v.toFixed(d)}${unit}</title></circle>`)).join("");
    return segs + dots;
  }).join("");
  const marks = markers.map(mk => `<line class="axis dash" x1="${X(mk.index)}" x2="${X(mk.index)}" y1="${m.t}" y2="${H - m.b}"/>
    <text x="${X(mk.index)}" y="${m.t + 10}" text-anchor="middle">${esc(mk.text)}</text>`).join("");
  return svg(W, H, label, grid + `<line class="axis" x1="${m.l}" x2="${W - m.r}" y1="${H - m.b}" y2="${H - m.b}"/>` + xl + marks + lines)
    + (series.length > 1 ? legend(series.map(s => s.name)) : "");
}

/* Vertical bars that may be negative. items: [{label, value}] where label is a season like "2005-06" */
function vbar(items, { unit = "", dec, label = "Bar chart" } = {}) {
  const W = 640, H = 300, m = { l: 52, r: 12, t: 16, b: 40 };
  const vals = items.map(i => i.value);
  let lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
  const pad = (hi - lo) * 0.08;
  lo -= lo < 0 ? pad : 0; hi += hi > 0 ? pad : 0;
  const { ticks, dec: autoDec } = niceTicks(lo, hi);
  lo = ticks[0]; hi = ticks[ticks.length - 1];
  const d = dec ?? autoDec;
  const Y = v => m.t + ((hi - v) / (hi - lo)) * (H - m.t - m.b);
  const slot = (W - m.l - m.r) / items.length;
  const grid = ticks.map(t => `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}"/>
    <text x="${m.l - 8}" y="${Y(t) + 4}" text-anchor="end">${t.toFixed(d)}${unit}</text>`).join("");
  const bars = items.map((it, i) => {
    const x = m.l + i * slot + slot * 0.15, w = slot * 0.7;
    const y0 = Y(0), y1 = Y(it.value);
    return `<rect class="${it.value < 0 ? "neg" : "c1"}" x="${x}" y="${Math.min(y0, y1)}" width="${w}" height="${Math.max(1, Math.abs(y1 - y0))}" rx="2"><title>${esc(it.label)}: ${it.value.toFixed(d)}${unit}</title></rect>
      ${i % 2 ? "" : `<text x="${x + w / 2}" y="${H - m.b + 18}" text-anchor="middle">${esc(shortSeason(it.label))}</text>`}`;
  }).join("");
  return svg(W, H, label, grid + bars + `<line class="axis" x1="${m.l}" x2="${W - m.r}" y1="${Y(0)}" y2="${Y(0)}"/>`);
}
