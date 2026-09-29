/* Dashboard: loads data/matches.csv, then filters and aggregates it in the
   browser. Every number and chart is computed here from the raw rows.
   Formatters and chart builders live in charts.js. */

const $ = id => document.getElementById(id);
const MIN_TEAM_MATCHES = 20;   // home matches a team needs in the view to be ranked

// ---------------------------------------------------------------- measures
/* Each measure turns a group's accumulator into one number (null = undefined
   for that group, e.g. no matches with odds). */
const MEASURES = {
  count: { label: "Matches", dec: 0, unit: "", fmt: n0, val: a => a.n,
    def: "Number of matches in the group." },
  home: { label: "Home win rate", dec: 1, unit: "%", fmt: pc, val: a => (a.n ? 100 * a.h / a.n : null),
    def: "Home wins ÷ matches × 100." },
  draw: { label: "Draw rate", dec: 1, unit: "%", fmt: pc, val: a => (a.n ? 100 * a.d / a.n : null),
    def: "Draws ÷ matches × 100." },
  away: { label: "Away win rate", dec: 1, unit: "%", fmt: pc, val: a => (a.n ? 100 * a.a / a.n : null),
    def: "Away wins ÷ matches × 100." },
  goals: { label: "Average goals per game", dec: 2, unit: "", fmt: f2, val: a => (a.n ? a.goals / a.n : null),
    def: "Home goals plus away goals, averaged over the matches." },
  fav: { label: "Favorite win rate", dec: 1, unit: "%", fmt: pc, val: a => (a.oddsN ? 100 * a.favW / a.oddsN : null),
    note: "Only matches with usable Bet365 odds count.",
    def: "The favorite is the outcome (home, draw, away) with the lowest Bet365 odds. Favorite wins ÷ matches with usable odds × 100. Matches with a missing odd, or any odd of 1.0 or below, are left out." },
  roi: { label: "Return on a $1 underdog bet", dec: 1, unit: "%", fmt: v => `${signed(v)}%`, val: a => (a.oddsN ? 100 * a.udSum / a.oddsN : null),
    note: "Only matches with usable Bet365 odds count.",
    def: "A $1 bet on the outcome with the highest Bet365 odds wins (odds − 1) dollars if it happens and loses $1 otherwise. Total profit ÷ number of bets × 100." },
  sot: { label: "Average shots on target per game", dec: 2, unit: "", fmt: f2, val: a => (a.sotN ? a.sotSum / a.sotN : null),
    note: "Only matches where shots on target were recorded count.",
    def: "Home plus away shots on target, averaged over matches where both are recorded." },
  reds: { label: "Red cards per game", dec: 2, unit: "", fmt: f2, val: a => (a.redN ? a.redSum / a.redN : null),
    note: "Only matches where cards were recorded count.",
    def: "Home plus away red cards, averaged over matches where both are recorded." },
};

const BREAKDOWNS = {
  league: { label: "League", key: i => D.league[i], names: () => D.leagues },
  season: { label: "Season", key: i => D.season[i], names: () => D.seasons },
  country: { label: "Country", key: i => D.country[i], names: () => D.countries },
};

const RESULT_LABELS = ["Home win", "Draw", "Away win"];
const RESULT_CODES = ["H", "D", "A"];

// ---------------------------------------------------------------- data
let D = null;   // parsed columns, filled by load()
const state = { from: 0, to: 0, country: -1, league: -1, team: -1, role: "any", result: -1, measure: "home", by: "league" };

function parseCsv(text) {
  const lines = text.split("\n");
  if (lines[lines.length - 1].trim() === "") lines.pop();
  const head = lines[0].trim().split(",");
  const c = name => {
    const k = head.indexOf(name);
    if (k < 0) throw new Error(`column ${name} not found in matches.csv`);
    return k;
  };
  const col = {};
  ["HomeTeam", "AwayTeam", "FTHG", "FTAG", "FTR", "HST", "AST", "HR", "AR", "B365H", "B365D", "B365A", "Season", "Country", "League"]
    .forEach(name => { col[name] = c(name); });

  const rows = new Array(lines.length - 1);
  for (let i = 1; i < lines.length; i++) rows[i - 1] = lines[i].trim().split(",");
  const n = rows.length;

  const uniq = k => [...new Set(rows.map(r => r[col[k]]))].sort((a, b) => a.localeCompare(b));
  const seasons = uniq("Season"), leagues = uniq("League"), countries = uniq("Country");
  const teams = [...new Set(rows.flatMap(r => [r[col.HomeTeam], r[col.AwayTeam]]))].sort((a, b) => a.localeCompare(b));
  const idx = list => new Map(list.map((v, i) => [v, i]));
  const sI = idx(seasons), lI = idx(leagues), cI = idx(countries), tI = idx(teams);

  const T = {
    n, seasons, leagues, countries, teams,
    season: new Uint8Array(n), league: new Uint8Array(n), country: new Uint8Array(n),
    home: new Uint16Array(n), away: new Uint16Array(n),
    res: new Uint8Array(n), goals: new Uint8Array(n),
    oddsOk: new Uint8Array(n), favWon: new Uint8Array(n), udp: new Float64Array(n),
    sot: new Int16Array(n).fill(-1), reds: new Int16Array(n).fill(-1),
    leagueCountry: new Array(leagues.length),
    teamLeagues: teams.map(() => new Set()),
  };
  const resCode = { H: 0, D: 1, A: 2 };
  const num = s => (s === "" || s === undefined ? NaN : Number(s));

  for (let i = 0; i < n; i++) {
    const r = rows[i];
    T.season[i] = sI.get(r[col.Season]);
    T.league[i] = lI.get(r[col.League]);
    T.country[i] = cI.get(r[col.Country]);
    T.home[i] = tI.get(r[col.HomeTeam]);
    T.away[i] = tI.get(r[col.AwayTeam]);
    T.leagueCountry[T.league[i]] = T.country[i];
    T.teamLeagues[T.home[i]].add(T.league[i]);
    T.teamLeagues[T.away[i]].add(T.league[i]);
    const res = resCode[r[col.FTR]];
    T.res[i] = res;
    T.goals[i] = num(r[col.FTHG]) + num(r[col.FTAG]);

    // Odds: same rules as scripts/analysis.py. All three must be present and
    // above 1.0. Ties go to the first of home, draw, away.
    const oh = num(r[col.B365H]), od = num(r[col.B365D]), oa = num(r[col.B365A]);
    if (oh > 1 && od > 1 && oa > 1) {
      let fi = 0, fo = oh;
      if (od < fo) { fi = 1; fo = od; }
      if (oa < fo) { fi = 2; fo = oa; }
      let ui = 0, uo = oh;
      if (od > uo) { ui = 1; uo = od; }
      if (oa > uo) { ui = 2; uo = oa; }
      T.oddsOk[i] = 1;
      T.favWon[i] = fi === res ? 1 : 0;
      T.udp[i] = ui === res ? uo - 1 : -1;
    }
    const hst = num(r[col.HST]), ast = num(r[col.AST]);
    if (!isNaN(hst) && !isNaN(ast)) T.sot[i] = hst + ast;
    const hr = num(r[col.HR]), ar = num(r[col.AR]);
    if (!isNaN(hr) && !isNaN(ar)) T.reds[i] = hr + ar;
  }
  return T;
}

// ---------------------------------------------------------------- filtering and aggregating
function filteredRows() {
  const out = new Int32Array(D.n);
  let m = 0;
  const { from, to, country, league, team, role, result } = state;
  for (let i = 0; i < D.n; i++) {
    const s = D.season[i];
    if (s < from || s > to) continue;
    if (country >= 0 && D.country[i] !== country) continue;
    if (league >= 0 && D.league[i] !== league) continue;
    if (result >= 0 && D.res[i] !== result) continue;
    if (team >= 0) {
      const isHome = D.home[i] === team, isAway = D.away[i] === team;
      if (role === "home" ? !isHome : role === "away" ? !isAway : !(isHome || isAway)) continue;
    }
    out[m++] = i;
  }
  return out.subarray(0, m);
}

const newAcc = () => ({ n: 0, h: 0, d: 0, a: 0, goals: 0, oddsN: 0, favW: 0, udSum: 0, sotN: 0, sotSum: 0, redN: 0, redSum: 0 });

function add(a, i) {
  a.n++;
  const r = D.res[i];
  if (r === 0) a.h++; else if (r === 1) a.d++; else a.a++;
  a.goals += D.goals[i];
  if (D.oddsOk[i]) { a.oddsN++; a.favW += D.favWon[i]; a.udSum += D.udp[i]; }
  if (D.sot[i] >= 0) { a.sotN++; a.sotSum += D.sot[i]; }
  if (D.reds[i] >= 0) { a.redN++; a.redSum += D.reds[i]; }
}

function aggregate(rows, keyFn, size) {
  const accs = Array.from({ length: size }, newAcc);
  for (let k = 0; k < rows.length; k++) { const i = rows[k]; add(accs[keyFn(i)], i); }
  return accs;
}

// ---------------------------------------------------------------- controls
function fillSelect(el, options, selected) {
  el.innerHTML = options.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("");
  el.value = String(selected);
}

function teamInScope(t) {
  for (const L of D.teamLeagues[t]) {
    if ((state.league < 0 || L === state.league) && (state.country < 0 || D.leagueCountry[L] === state.country)) return true;
  }
  return false;
}

/* League and team lists depend on the country and league chosen, so a
   filter can never be set to a value that would match nothing. */
function refreshOptions() {
  const seasonOpts = D.seasons.map((s, i) => [i, s]);
  fillSelect($("f-from"), seasonOpts, state.from);
  fillSelect($("f-to"), seasonOpts, state.to);
  fillSelect($("f-country"), [[-1, "All countries"], ...D.countries.map((c, i) => [i, c])], state.country);

  const leagueOpts = D.leagues.map((l, i) => [i, l]).filter(([i]) => state.country < 0 || D.leagueCountry[i] === state.country);
  if (state.league >= 0 && !leagueOpts.some(([i]) => i === state.league)) state.league = -1;
  fillSelect($("f-league"), [[-1, "All leagues"], ...leagueOpts], state.league);

  const teamOpts = D.teams.map((t, i) => [i, t]).filter(([i]) => teamInScope(i));
  if (state.team >= 0 && !teamOpts.some(([i]) => i === state.team)) state.team = -1;
  fillSelect($("f-team"), [[-1, "All teams"], ...teamOpts], state.team);

  fillSelect($("f-role"), [["any", "Home or away"], ["home", "Home matches only"], ["away", "Away matches only"]], state.role);
  $("f-role").disabled = state.team < 0;
  fillSelect($("f-result"), [[-1, "Any result"], ...RESULT_LABELS.map((l, i) => [i, l])], state.result);
  fillSelect($("measure"), Object.entries(MEASURES).map(([k, m]) => [k, m.label]), state.measure);
  fillSelect($("by"), Object.entries(BREAKDOWNS).map(([k, b]) => [k, b.label]), state.by);
}

function resetFilters() {
  Object.assign(state, { from: 0, to: D.seasons.length - 1, country: -1, league: -1, team: -1, role: "any", result: -1 });
  refreshOptions();
  update();
}

function bindControls() {
  const onNum = (id, apply) => $(id).addEventListener("change", e => { apply(Number(e.target.value)); refreshOptions(); update(); });
  onNum("f-from", v => { state.from = v; if (state.to < v) state.to = v; });
  onNum("f-to", v => { state.to = v; if (state.from > v) state.from = v; });
  onNum("f-country", v => { state.country = v; });
  onNum("f-league", v => { state.league = v; });
  onNum("f-team", v => { state.team = v; });
  onNum("f-result", v => { state.result = v; });
  $("f-role").addEventListener("change", e => { state.role = e.target.value; update(); });
  $("measure").addEventListener("change", e => { state.measure = e.target.value; update(); });
  $("by").addEventListener("change", e => { state.by = e.target.value; tableSort = null; update(); });
  $("reset").addEventListener("click", resetFilters);
}

/* The state is mirrored in the query string so a view can be linked to. */
function readUrl() {
  const q = new URLSearchParams(location.search);
  const at = (k, list) => { const v = q.get(k); return v === null ? -1 : list.indexOf(v); };
  const from = at("from", D.seasons), to = at("to", D.seasons);
  state.from = from >= 0 ? from : 0;
  state.to = to >= 0 ? to : D.seasons.length - 1;
  if (state.to < state.from) { state.from = 0; state.to = D.seasons.length - 1; }
  state.country = at("country", D.countries);
  state.league = at("league", D.leagues);
  state.team = at("team", D.teams);
  const res = RESULT_CODES.indexOf(q.get("result"));
  state.result = res;
  if (["any", "home", "away"].includes(q.get("role"))) state.role = q.get("role");
  if (MEASURES[q.get("measure")]) state.measure = q.get("measure");
  if (BREAKDOWNS[q.get("by")]) state.by = q.get("by");
}

function writeUrl() {
  const q = new URLSearchParams();
  if (state.from > 0) q.set("from", D.seasons[state.from]);
  if (state.to < D.seasons.length - 1) q.set("to", D.seasons[state.to]);
  if (state.country >= 0) q.set("country", D.countries[state.country]);
  if (state.league >= 0) q.set("league", D.leagues[state.league]);
  if (state.team >= 0) q.set("team", D.teams[state.team]);
  if (state.team >= 0 && state.role !== "any") q.set("role", state.role);
  if (state.result >= 0) q.set("result", RESULT_CODES[state.result]);
  if (state.measure !== "home") q.set("measure", state.measure);
  if (state.by !== "league") q.set("by", state.by);
  const qs = q.toString();
  try { history.replaceState(null, "", qs ? `?${qs}` : location.pathname); } catch (e) { /* not fatal */ }
}

// ---------------------------------------------------------------- rendering
const empty = msg => `<div class="empty">${esc(msg)}</div>`;

function renderTiles(total, teamsInView) {
  const has = total.n > 0;
  const fav = MEASURES.fav.val(total), roi = MEASURES.roi.val(total);
  const tiles = [
    [has ? n0(total.n) : "—", "matches analyzed"],
    [has ? pc(MEASURES.home.val(total)) : "—", "of matches won by the home team"],
    [fav === null ? "—" : pc(fav), "of matches won by the bookmakers' favorite"],
    [roi === null ? "—" : `${signed(roi)}%`, "return on betting the underdog in every match"],
    [has ? f2(MEASURES.goals.val(total)) : "—", "goals per game"],
    [has ? n0(teamsInView) : "—", "teams with a match in view"],
  ];
  $("tiles").innerHTML = tiles.map(([num, label]) => `<div class="stat"><div class="num">${num}</div><div class="label">${label}</div></div>`).join("");
}

function groupRows(rows, B) {
  const names = B.names();
  return aggregate(rows, B.key, names.length).map((acc, i) => ({ name: names[i], acc })).filter(g => g.acc.n > 0);
}

function renderMain(groups, B, M) {
  $("t-main").textContent = `${M.label} by ${B.label.toLowerCase()}`;
  $("s-main").textContent = M.note || "Switch the measure and the breakdown above.";
  const items = groups.map(g => ({ label: g.name, value: M.val(g.acc) })).filter(x => x.value !== null);
  if (!items.length) { $("c-main").innerHTML = empty("No matches in this view."); return; }
  const label = `${M.label} by ${B.label.toLowerCase()}`;
  if (state.by === "season") {
    $("c-main").innerHTML = vbar(items, { unit: M.unit, dec: M.dec, label });
  } else {
    items.sort((a, b) => b.value - a.value);
    $("c-main").innerHTML = hbar(items.map(x => ({ ...x, text: M.fmt(x.value) })), { label });
  }
}

function renderMix(groups, B) {
  $("t-mix").textContent = `Home, draw and away results by ${B.label.toLowerCase()}`;
  $("s-mix").textContent = "Share of matches in each group. Follows the filters and the breakdown, not the measure.";
  const items = groups.map(g => ({
    label: g.name, names: RESULT_LABELS,
    parts: [100 * g.acc.h / g.acc.n, 100 * g.acc.d / g.acc.n, 100 * g.acc.a / g.acc.n],
  }));
  if (!items.length) { $("c-mix").innerHTML = empty("No matches in this view."); return; }
  if (state.by !== "season") items.sort((a, b) => b.parts[0] - a.parts[0]);
  $("c-mix").innerHTML = stacked(items, { rowH: state.by === "season" ? 22 : 30, label: `Result mix by ${B.label.toLowerCase()}` })
    + legend(["Home win %", "Draw %", "Away win %"]);
}

function renderTrend(rows, M) {
  $("t-trend").textContent = `${M.label} by season`;
  $("s-trend").textContent = state.measure === "count" ? "Matches per season in the current view." : "The current view (solid) against all matches (dashed).";
  const inView = aggregate(rows, i => D.season[i], D.seasons.length).map(a => (a.n ? M.val(a) : null));
  if (inView.every(v => v === null)) { $("c-trend").innerHTML = empty("No matches in this view."); return; }
  const series = [{ name: "Current view", values: inView }];
  if (state.measure !== "count") {
    const all = new Int32Array(D.n).map((_, i) => i);
    series.push({ name: "All matches", dash: true, values: aggregate(all, i => D.season[i], D.seasons.length).map(a => M.val(a)) });
  }
  $("c-trend").innerHTML = lineChart(D.seasons.map(shortSeason), series, { unit: M.unit === "%" ? "%" : "", label: `${M.label} by season`, dec: M.dec });
}

function renderTeams(rows, M) {
  $("t-teams").textContent = `Top home teams by ${M.label.toLowerCase()}`;
  $("s-teams").textContent = `Each team's home matches in the view, teams with at least ${MIN_TEAM_MATCHES} only.`;
  const items = aggregate(rows, i => D.home[i], D.teams.length)
    .map((acc, t) => ({ label: D.teams[t], n: acc.n, value: acc.n >= MIN_TEAM_MATCHES ? M.val(acc) : null }))
    .filter(x => x.value !== null)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, 10);
  if (!items.length) { $("c-teams").innerHTML = empty(`No home team has ${MIN_TEAM_MATCHES} or more matches in this view.`); return; }
  $("c-teams").innerHTML = hbar(items.map(x => ({ label: x.label, value: x.value, text: M.fmt(x.value) })), { label: `Top home teams by ${M.label.toLowerCase()}` });
}

// ---- table
const TABLE_COLS = [
  { key: "name", label: null },
  { key: "count", label: "Matches" },
  { key: "home", label: "Home win %" },
  { key: "draw", label: "Draw %" },
  { key: "away", label: "Away win %" },
  { key: "goals", label: "Goals / game" },
  { key: "fav", label: "Favorite win %" },
  { key: "roi", label: "Underdog return" },
];
let tableSort = null;   // { key, dir } or null for the default order

function cell(key, acc) {
  const v = MEASURES[key].val(acc);
  return v === null ? "—" : MEASURES[key].fmt(v);
}

function renderTable(groups, total, B) {
  const sort = tableSort || (state.by === "season" ? { key: "name", dir: 1 } : { key: "count", dir: -1 });
  const sorted = [...groups].sort((a, b) => {
    if (sort.key === "name") return sort.dir * a.name.localeCompare(b.name);
    const va = MEASURES[sort.key].val(a.acc), vb = MEASURES[sort.key].val(b.acc);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return sort.dir * (va - vb);
  });
  const head = TABLE_COLS.map(c => {
    const label = c.label ?? B.label;
    const active = sort.key === c.key;
    return `<th scope="col"${active ? ` aria-sort="${sort.dir > 0 ? "ascending" : "descending"}"` : ""}><button type="button" data-key="${c.key}">${esc(label)}${active ? (sort.dir > 0 ? " ▲" : " ▼") : ""}</button></th>`;
  }).join("");
  const body = sorted.map(g => `<tr><td>${esc(g.name)}</td>${TABLE_COLS.slice(1).map(c => `<td>${cell(c.key, g.acc)}</td>`).join("")}</tr>`).join("");
  const foot = `<tr><td>All in view</td>${TABLE_COLS.slice(1).map(c => `<td>${total.n ? cell(c.key, total) : "—"}</td>`).join("")}</tr>`;
  $("table").innerHTML = `<thead><tr>${head}</tr></thead><tbody>${body}</tbody><tfoot>${foot}</tfoot>`;
  const noun = B.label.toLowerCase();
  const plural = noun.endsWith("y") ? `${noun.slice(0, -1)}ies` : `${noun}s`;
  $("table-note").textContent = `${groups.length} ${groups.length === 1 ? noun : plural} shown. Click a heading to sort.`;
}

function bindTable() {
  $("table").addEventListener("click", e => {
    const btn = e.target.closest("button[data-key]");
    if (!btn) return;
    const key = btn.dataset.key;
    const cur = tableSort || (state.by === "season" ? { key: "name", dir: 1 } : { key: "count", dir: -1 });
    tableSort = { key, dir: cur.key === key ? -cur.dir : (key === "name" ? 1 : -1) };
    update();
  });
}

// ---- status line
function filtersActive() {
  return state.from > 0 || state.to < D.seasons.length - 1 || state.country >= 0 || state.league >= 0 || state.team >= 0 || state.result >= 0;
}

function update() {
  const rows = filteredRows();
  const M = MEASURES[state.measure], B = BREAKDOWNS[state.by];
  const total = aggregate(rows, () => 0, 1)[0];
  const seen = new Uint8Array(D.teams.length);
  for (let k = 0; k < rows.length; k++) { seen[D.home[rows[k]]] = 1; seen[D.away[rows[k]]] = 1; }
  const teamsInView = seen.reduce((s, v) => s + v, 0);

  $("status").innerHTML = `Showing <strong>${n0(rows.length)}</strong> of ${n0(D.n)} matches${filtersActive() ? "" : " (no filters)"}`;
  $("f-role").disabled = state.team < 0;

  const groups = groupRows(rows, B);
  renderTiles(total, teamsInView);
  renderMain(groups, B, M);
  renderMix(groups, B);
  renderTrend(rows, M);
  renderTeams(rows, M);
  renderTable(groups, total, B);
  writeUrl();
}

// ---------------------------------------------------------------- boot
function showDefinitions() {
  $("defs").innerHTML =
    `<li><strong>Filters.</strong> A match is in the view when its season is in the chosen range and it matches the country, league, team and result chosen. A team filter keeps matches where that team played at home, away, or either, depending on "Team plays".</li>` +
    Object.values(MEASURES).map(m => `<li><strong>${esc(m.label)}.</strong> ${esc(m.def)}</li>`).join("");
}

fetch("data/matches.csv")
  .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
  .then(text => {
    D = parseCsv(text);
    state.to = D.seasons.length - 1;
    readUrl();
    refreshOptions();
    bindControls();
    bindTable();
    showDefinitions();
    update();
  })
  .catch(err => {
    const box = $("error");
    box.hidden = false;
    box.innerHTML = `Could not load <code>data/matches.csv</code> (${esc(err.message)}). ` +
      `Browsers block file loading from a page opened directly from disk. Run <code>python -m http.server</code> in this folder and open <code>http://localhost:8000/dashboard.html</code>.`;
    $("status").textContent = "";
    console.error(err);
  });
