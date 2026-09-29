/* Renders index.html from data/findings.json. No number on the page is
   typed by hand: text and charts are both filled from that file. */

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
/* Horizontal bars. items: [{label, value, cls?, text?}] */
function hbar(items, { unit = "%", dec = 1, labelW = 150, max, label = "Bar chart" } = {}) {
  const W = 640, rowH = 28, top = 6, right = 64;
  const hi = max ?? Math.max(...items.map(i => i.value));
  const barW = W - labelW - right;
  const H = top * 2 + rowH * items.length;
  const rows = items.map((it, i) => {
    const y = top + i * rowH;
    const w = Math.max(1, (it.value / hi) * barW);
    const shown = it.text ?? `${it.value.toFixed(dec)}${unit}`;
    return `<text x="${labelW - 8}" y="${y + 18}" text-anchor="end">${esc(it.label)}</text>
      <rect class="${it.cls || "c1"}" x="${labelW}" y="${y + 4}" width="${w}" height="${rowH - 8}" rx="3"><title>${esc(it.label)}: ${esc(shown)}</title></rect>
      <text class="val" x="${labelW + w + 6}" y="${y + 18}">${esc(shown)}</text>`;
  }).join("");
  return svg(W, H, label, rows);
}

/* Stacked horizontal bars that each sum to 100. items: [{label, parts:[v1,v2,v3]}] */
function stacked(items, { labelW = 130, label = "Stacked bar chart" } = {}) {
  const W = 640, rowH = 30, top = 6, right = 12;
  const barW = W - labelW - right;
  const H = top * 2 + rowH * items.length;
  const rows = items.map((it, i) => {
    const y = top + i * rowH;
    let x = labelW;
    const segs = it.parts.map((v, k) => {
      const w = (v / 100) * barW;
      const seg = `<rect class="c${k + 1}" x="${x}" y="${y + 3}" width="${w}" height="${rowH - 6}"><title>${esc(it.names[k])}: ${f1(v)}%</title></rect>
        <text class="inbar" x="${x + w / 2}" y="${y + 19}" text-anchor="middle">${f1(v)}</text>`;
      x += w;
      return seg;
    }).join("");
    return `<text x="${labelW - 8}" y="${y + 19}" text-anchor="end">${esc(it.label)}</text>${segs}`;
  }).join("");
  return svg(W, H, label, rows);
}

/* Line chart. cats: x labels; series: [{name, values}] (up to 3) */
function lineChart(cats, series, { unit = "", yMin, yMax, dec, label = "Line chart", markers = [] } = {}) {
  const W = 640, H = 300, m = { l: 52, r: 18, t: 16, b: 40 };
  const all = series.flatMap(s => s.values);
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
    const pts = s.values.map((v, i) => `${X(i)},${Y(v)}`).join(" ");
    const dots = s.values.map((v, i) =>
      `<circle class="p${k + 1}" cx="${X(i)}" cy="${Y(v)}" r="3.5"><title>${esc(s.name)}, ${esc(cats[i])}: ${v.toFixed(d)}${unit}</title></circle>`).join("");
    return `<polyline class="s${k + 1}${s.dash ? " dash" : ""}" points="${pts}"/>${dots}`;
  }).join("");
  const marks = markers.map(mk => `<line class="axis dash" x1="${X(mk.index)}" x2="${X(mk.index)}" y1="${m.t}" y2="${H - m.b}"/>
    <text x="${X(mk.index)}" y="${m.t + 10}" text-anchor="middle">${esc(mk.text)}</text>`).join("");
  return svg(W, H, label, grid + `<line class="axis" x1="${m.l}" x2="${W - m.r}" y1="${H - m.b}" y2="${H - m.b}"/>` + xl + marks + lines)
    + (series.length > 1 ? legend(series.map(s => s.name)) : "");
}

/* Vertical bars that may be negative. items: [{label, value}] */
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

// ---------------------------------------------------------------- filling
function fill(id, { h2, paras, plot, caption }) {
  const s = document.getElementById(id);
  s.querySelector("h2").textContent = h2;
  s.querySelector(".text").innerHTML = paras.map(p => `<p>${p}</p>`).join("");
  s.querySelector(".plot").innerHTML = plot;
  s.querySelector("figcaption").textContent = caption;
}

function render(d) {
  const leagues = d.results_by_league;
  const seasons = d.results_by_season;
  const firstSeason = seasons[0].Season, lastSeason = seasons[seasons.length - 1].Season;
  const rates = d.overall_result_rates;

  // ---- header: summary + 4 headline numbers
  document.getElementById("summary").textContent =
    `This report looks at ${n0(d.n_matches_total)} matches from ${leagues.length} European leagues across ${seasons.length} seasons, ` +
    `${firstSeason} to ${lastSeason}. Home teams won ${pc(rates.home_win_pct)} of them, bookmakers' favorites won ${pc(d.favorite_win_rate_overall.favorite_win_pct)}, ` +
    `and a $${d.underdog_flat_bet_pnl.stake_per_bet_usd} bet on the underdog in every match would have returned ${signed(d.underdog_flat_bet_pnl.overall_roi_pct)}%. ` +
    `The sections below cover home advantage, betting odds, goals, half-time swings, shots, red cards and the biggest upsets.`;

  document.getElementById("stats").innerHTML = [
    [n0(d.n_matches_total), "matches analyzed"],
    [pc(rates.home_win_pct), "of matches won by the home team"],
    [pc(d.favorite_win_rate_overall.favorite_win_pct), "of matches won by the bookmakers' favorite"],
    [`${signed(d.underdog_flat_bet_pnl.overall_roi_pct)}%`, "return on betting the underdog in every match"],
  ].map(([num, label]) => `<div class="stat"><div class="num">${num}</div><div class="label">${label}</div></div>`).join("");

  // ---- 1. home advantage by league
  const topHome = maxBy(leagues, r => r.home_win_pct), lowHome = minBy(leagues, r => r.home_win_pct);
  fill("home-advantage", {
    h2: `Home teams win ${pc(rates.home_win_pct)} of matches, far more often than visitors (${pc(rates.away_win_pct)})`,
    paras: [
      `Across all ${n0(d.n_matches_total)} matches, the home side won ${pc(rates.home_win_pct)}, the away side won ${pc(rates.away_win_pct)}, and ${pc(rates.draw_pct)} ended in a draw.`,
      `The edge shows up in every league, but its size varies. ${topHome.League} has the highest home-win rate at ${pc(topHome.home_win_pct)} across ${n0(topHome.matches)} matches, while ${lowHome.League} has the lowest at ${pc(lowHome.home_win_pct)} across ${n0(lowHome.matches)}.`,
    ],
    plot: stacked(
      [...leagues].sort((a, b) => b.home_win_pct - a.home_win_pct).map(r => ({
        label: r.League, parts: [r.home_win_pct, r.draw_pct, r.away_win_pct], names: ["Home win", "Draw", "Away win"],
      })), { label: "Home, draw and away result rates by league" }) + legend(["Home win %", "Draw %", "Away win %"]),
    caption: "Share of matches ending in a home win, draw or away win, by league.",
  });

  // ---- 2. the fading edge (strongest league) + COVID season
  const tr = d.strongest_league_home_advantage_trend, cv = d.home_advantage_covid;
  const covidIdx = seasons.findIndex(s => s.Season === cv.season);
  fill("fading-edge", {
    h2: `${tr.league}'s home advantage slipped from ${pc(tr.first_5_seasons_avg_pct)} to ${pc(tr.last_5_seasons_avg_pct)} over ${tr.by_season.length} seasons`,
    paras: [
      `${tr.league} is the league with the strongest home advantage overall (${pc(tr.overall_home_win_pct)}). Its home-win rate peaked at ${pc(tr.peak_home_win_pct)} in ${tr.peak_season} and bottomed out at ${pc(tr.trough_home_win_pct)} in ${tr.trough_season}. The average of its first five seasons was ${pc(tr.first_5_seasons_avg_pct)}; the last five averaged ${pc(tr.last_5_seasons_avg_pct)}, a change of ${signed(tr.change_first5_to_last5_pct_points)} percentage points. A straight-line fit through all ${tr.by_season.length} seasons slopes ${signed(tr.linear_trend_pct_points_per_season, 3)} points per season.`,
      `The empty-stadium season shows how much crowds may matter. In ${cv.season}, the home-win rate across all leagues fell to ${pc(cv.home_win_pct_2020_21)}, ${f1(Math.abs(cv.drop_vs_before_pct_points))} points below the ${pc(cv.avg_home_win_pct_before)} average of the seasons before it. ${cv.recovered_after ? `In the seasons afterwards it averaged ${pc(cv.avg_home_win_pct_after)}, ${cv.avg_home_win_pct_after < cv.avg_home_win_pct_before ? "up from the dip but still below the earlier level" : "back to the earlier level"}.` : ""}`,
    ],
    plot: lineChart(tr.by_season.map(r => shortSeason(r.Season)), [
      { name: `${tr.league} home-win %`, values: tr.by_season.map(r => r.home_win_pct) },
      { name: "All leagues home-win %", values: seasons.map(r => r.home_win_pct), dash: true },
    ], { unit: "%", label: `Home-win rate by season, ${tr.league} versus all leagues` }),
    caption: `Home-win rate by season (labels show the season's start and end year, e.g. ${shortSeason(firstSeason)} = ${firstSeason}). The dip near ${cv.season} is the empty-stadium season.`,
  });

  // ---- 3. home fortresses
  const t10 = d.results_by_team_top10_home_win_pct, fort = d.home_away_gap_by_team.biggest_home_fortress[0];
  fill("fortresses", {
    h2: `${t10.top_10[0].Team} won ${pc(t10.top_10[0].home_win_pct)} of home matches, the best home record of ${t10.teams_qualifying} clubs`,
    paras: [
      `Only teams with at least ${t10.min_home_matches_threshold} home matches are ranked, which leaves ${t10.teams_qualifying} clubs. ${t10.top_10[0].Team} won ${pc(t10.top_10[0].home_win_pct)} of ${n0(t10.top_10[0].matches)} home games and lost only ${pc(t10.top_10[0].away_win_pct)}. ${t10.top_10[1].Team} (${pc(t10.top_10[1].home_win_pct)}) and ${t10.top_10[2].Team} (${pc(t10.top_10[2].home_win_pct)}) follow. For comparison, the league-wide home-win rate is ${pc(rates.home_win_pct)}.`,
      `A different measure, points per game, finds the club whose home form differs most from its away form: ${fort.Team} earned ${f2(fort.home_ppg)} points per game at home but only ${f2(fort.away_ppg)} away, a gap of ${f2(fort.gap)}.`,
    ],
    plot: hbar(t10.top_10.map(r => ({ label: r.Team, value: r.home_win_pct })), { max: 100, label: "Top 10 teams by home win rate" }),
    caption: `Home-win rate of the ten strongest home teams (minimum ${t10.min_home_matches_threshold} home matches).`,
  });

  // ---- 4. favorites
  const fl = d.favorite_win_rate_by_league, fo = d.favorite_win_rate_overall, pr = d.predictability;
  fill("favorites", {
    h2: `Bookmakers' favorites win only ${pc(fo.favorite_win_pct)} of the time, and it varies from ${pc(pr.most_upsets_favorite_win_pct)} to ${pc(pr.most_predictable_favorite_win_pct)} by league`,
    paras: [
      `Taking the team with the shortest Bet365 odds as the favorite, favorites won ${pc(fo.favorite_win_pct)} of ${n0(fo.matches_with_odds)} matches with usable odds. That is about a coin flip, because draws and upsets are common in football.`,
      `${pr.most_predictable_league} is the most predictable league, with favorites winning ${pc(pr.most_predictable_favorite_win_pct)}. ${pr.most_upsets_league} has the most upsets: favorites win just ${pc(pr.most_upsets_favorite_win_pct)}, so ${pc(pr.most_upsets_upset_pct)} of matches end in a draw or an underdog win.`,
    ],
    plot: hbar([...fl].sort((a, b) => b.favorite_win_pct - a.favorite_win_pct).map(r => ({ label: r.League, value: r.favorite_win_pct })),
      { max: 100, label: "Favorite win rate by league" }),
    caption: "Share of matches won by the pre-match favorite, by league.",
  });

  // ---- 5. calibration
  const cal = d.odds_calibration, co = d.odds_calibration_overall, fr = d.favorite_calibration_by_range;
  const lowR = fr.overall_by_range[0], hiR = fr.overall_by_range[fr.overall_by_range.length - 1];
  fill("calibration", {
    h2: `Bookmaker odds are well calibrated: they implied ${pc(co.avg_implied_home_win_pct)} home wins and the actual rate was ${pc(co.actual_home_win_pct)}`,
    paras: [
      `Converting odds to probabilities (with the bookmaker's margin removed), the average implied home-win chance was ${pc(co.avg_implied_home_win_pct)}. The actual home-win rate was ${pc(co.actual_home_win_pct)}. The chart splits matches into ten bands by implied chance; in each band the actual rate sits close to the implied one, for example ${pc(cal[0].avg_implied_home_win_pct)} implied against ${pc(cal[0].actual_home_win_pct)} actual in the lowest band (${n0(cal[0].matches)} matches).`,
      `Favorites follow the same pattern. When the favorite's implied chance was ${lowR.FavoriteBucket}, it won ${pc(lowR.actual_favorite_win_pct)} of ${n0(lowR.matches)} matches; in the top band (${hiR.FavoriteBucket}) it won ${pc(hiR.actual_favorite_win_pct)} of ${n0(hiR.matches)}. Across all ${n0(fr.above_70pct_implied.matches)} matches where the favorite was implied at 70% or more, it won ${pc(fr.above_70pct_implied.actual_favorite_win_pct)}.`,
    ],
    plot: lineChart(
      cal.map(b => `${Math.round(b.bucket_low * 100)}–${Math.round(b.bucket_high * 100)}%`),
      [{ name: "Implied home-win %", values: cal.map(b => b.avg_implied_home_win_pct), dash: true },
       { name: "Actual home-win %", values: cal.map(b => b.actual_home_win_pct) }],
      { unit: "%", yMin: 0, yMax: 100, dec: 0, label: "Implied versus actual home-win rate by probability band" }),
    caption: "Implied versus actual home-win rate, grouped by the home team's implied chance (x axis).",
  });

  // ---- 6. underdog P&L
  const u = d.underdog_flat_bet_pnl;
  const profitable = u.by_season.filter(r => r.profit_usd > 0);
  const worstS = minBy(u.by_season, r => r.roi_pct), bestL = maxBy(u.by_league, r => r.roi_pct), worstL = minBy(u.by_league, r => r.roi_pct);
  fill("underdogs", {
    h2: `Betting $${u.stake_per_bet_usd} on the underdog every match would have lost ${money(Math.abs(u.total_profit_usd))}`,
    paras: [
      `Suppose you staked $${u.stake_per_bet_usd} on the longest-odds outcome in each of ${n0(u.total_bets)} matches. The total result would be ${money(u.total_profit_usd)}, a return of ${signed(u.overall_roi_pct)}% per bet. Underdogs win often enough to feel tempting, but not often enough to cover the bookmaker's margin.`,
      `${profitable.length === 1 ? `Only one season was profitable: ${profitable[0].Season} at ${signed(profitable[0].roi_pct)}%.` : `${profitable.length} seasons were profitable.`} The worst season was ${worstS.Season} at ${signed(worstS.roi_pct)}%. By league, ${bestL.League} lost the least (${signed(bestL.roi_pct)}%) and ${worstL.League} lost the most (${signed(worstL.roi_pct)}%).`,
    ],
    plot: vbar(u.by_season.map(r => ({ label: r.Season, value: r.roi_pct })), { unit: "%", dec: 0, label: "Underdog flat-bet return by season" }),
    caption: "Return on investment (profit per $1 staked) for betting the underdog in every match, by season.",
  });

  // ---- 7. goals
  const g = d.highest_scoring_league_trend;
  fill("goals", {
    h2: `${g.league} scores the most, and its goals per game rose from ${f2(g.first_5_seasons_avg)} to ${f2(g.last_5_seasons_avg)}`,
    paras: [
      `${g.league} averages ${f2(g.overall_avg_goals_per_game)} goals per game, the highest of the ${leagues.length} leagues. Its average peaked at ${f2(g.peak_avg_goals_per_game)} in ${g.peak_season} and was lowest at ${f2(g.trough_avg_goals_per_game)} in ${g.trough_season}.`,
      `Comparing the first five seasons (${f2(g.first_5_seasons_avg)}) with the last five (${f2(g.last_5_seasons_avg)}) gives a rise of ${f2(g.change_first5_to_last5)} goals per game. A straight-line fit through the ${g.by_season.length} seasons slopes ${signed(g.linear_trend_goals_per_game_per_season, 4)} goals per game each season.`,
    ],
    plot: lineChart(g.by_season.map(r => shortSeason(r.Season)), [{ name: `${g.league} goals per game`, values: g.by_season.map(r => r.avg_goals_per_game) }],
      { dec: 2, label: `${g.league} goals per game by season` }),
    caption: `Average total goals (home plus away) per match in the ${g.league}, by season.`,
  });

  // ---- 8. most common score
  const sc = d.most_common_score_by_league;
  const allSame = sc.every(r => r.most_common_score === sc[0].most_common_score);
  const scHi = maxBy(sc, r => r.most_common_pct), scLo = minBy(sc, r => r.most_common_pct);
  fill("scores", {
    h2: allSame ? `${sc[0].most_common_score} is the most common final score in all ${sc.length} leagues` : "The most common final score differs between leagues",
    paras: [
      `${scHi.League} has the highest share of ${scHi.most_common_score} results at ${pc(scHi.most_common_pct)} (${n0(scHi.most_common_count)} of ${n0(scHi.matches)} matches). ${scLo.League} has the lowest at ${pc(scLo.most_common_pct)}.`,
      `Behind the top score, the next most common results in ${scLo.League} are ${scLo.top_3.slice(1).map(t => `${t.score} (${pc(t.pct)})`).join(" and ")}. In ${scHi.League} they are ${scHi.top_3.slice(1).map(t => `${t.score} (${pc(t.pct)})`).join(" and ")}. Low-scoring outcomes dominate everywhere.`,
    ],
    plot: hbar([...sc].sort((a, b) => b.most_common_pct - a.most_common_pct).map(r => ({ label: `${r.League} (${r.most_common_score})`, value: r.most_common_pct })),
      { labelW: 190, label: "Share of matches with the most common score, by league" }),
    caption: "Share of each league's matches that ended with its most common scoreline (shown in brackets).",
  });

  // ---- 9. half-time
  const ht = d.halftime_leads, hc = d.halftime_comebacks_by_league, lv = ht.level_at_half_time;
  const hcRate = hc.by_league.find(r => r.League === hc.most_comebacks_by_rate), hcCount = hc.by_league.find(r => r.League === hc.most_comebacks_by_raw_count);
  fill("half-time", {
    h2: `Half-time leaders go on to win ${pc(ht.lead_held_pct)} of the time; only ${pc(ht.lead_reversed_pct)} of leads are reversed`,
    paras: [
      `In ${n0(ht.matches_with_a_ht_leader)} of ${n0(ht.matches_with_ht_data)} matches with half-time data, one team was ahead at the break. That team went on to win ${pc(ht.lead_held_pct)} of the time, drew ${pc(ht.lead_drawn_pct)}, and lost ${pc(ht.lead_reversed_pct)}.`,
      `Comebacks are most frequent in ${hcRate.League} (${pc(hcRate.comeback_pct)} of leads), while ${hcCount.League} has the most in raw count (${n0(hcCount.comebacks)}). When matches were level at half-time (${n0(lv.matches)}), they finished ${pc(lv.home_win_pct)} home wins, ${pc(lv.draw_pct)} draws and ${pc(lv.away_win_pct)} away wins.`,
    ],
    plot: hbar([
      { label: "Lead held (win)", value: ht.lead_held_pct, cls: "c1" },
      { label: "Lead drawn back", value: ht.lead_drawn_pct, cls: "c2" },
      { label: "Lead reversed (loss)", value: ht.lead_reversed_pct, cls: "c3" },
    ], { max: 100, label: "Outcome of half-time leads" }),
    caption: "Final result for the team that led at half-time.",
  });

  // ---- 10. shots on target
  const st = d.shots_on_target_vs_win, so = st.overall;
  const leagueHM = st.by_league.map(r => r.home_win_pct_when_home_more);
  fill("shots", {
    h2: `Home teams win ${pc(so.home_more.home_win_pct)} of matches when they have more shots on target, but only ${pc(so.away_more.home_win_pct)} when they have fewer`,
    paras: [
      `Among ${n0(st.matches_with_shot_data)} matches with shot data, the home side had more shots on target in ${n0(so.home_more.matches)}, the away side had more in ${n0(so.away_more.matches)}, and they were level in ${n0(so.equal.matches)}. The home win rate was ${pc(so.home_more.home_win_pct)}, ${pc(so.away_more.home_win_pct)} and ${pc(so.equal.home_win_pct)} respectively.`,
      `By league, when the home team outshoots the visitors on target, its win rate ranges from ${pc(Math.min(...leagueHM))} to ${pc(Math.max(...leagueHM))} by league.`,
    ],
    plot: hbar([
      { label: "Home more shots on target", value: so.home_more.home_win_pct, cls: "c1" },
      { label: "Equal shots on target", value: so.equal.home_win_pct, cls: "c2" },
      { label: "Away more shots on target", value: so.away_more.home_win_pct, cls: "c3" },
    ], { max: 100, labelW: 190, label: "Home win rate by shots-on-target advantage" }),
    caption: "Home win rate, grouped by which team had more shots on target.",
  });

  // ---- 11. red cards
  const rc = d.red_cards_vs_win;
  fill("red-cards", {
    h2: `Teams reduced to ten men still win ${pc(rc.either_team_sole_red_card_combined.still_won_pct)} of the time`,
    paras: [
      `In ${n0(rc.matches_with_card_data)} matches with card data, ${n0(rc.either_team_sole_red_card_combined.matches)} saw exactly one team receive a red card. That team still won ${pc(rc.either_team_sole_red_card_combined.still_won_pct)}.`,
      `The home advantage survives a dismissal: a home team that was the only one sent off still won ${pc(rc.home_team_sole_red_card.still_won_pct)} of ${n0(rc.home_team_sole_red_card.matches)} matches, compared with ${pc(rc.away_team_sole_red_card.still_won_pct)} of ${n0(rc.away_team_sole_red_card.matches)} for an away team. For reference, home teams won ${pc(rc.no_red_card_baseline_home_win_pct.home_win_pct)} of the ${n0(rc.no_red_card_baseline_home_win_pct.matches)} matches with no red cards.`,
    ],
    plot: hbar([
      { label: "Home team sole red card", value: rc.home_team_sole_red_card.still_won_pct, cls: "c1" },
      { label: "Away team sole red card", value: rc.away_team_sole_red_card.still_won_pct, cls: "c3" },
      { label: "Either team, combined", value: rc.either_team_sole_red_card_combined.still_won_pct, cls: "c2" },
      { label: "Home win rate, no red cards", value: rc.no_red_card_baseline_home_win_pct.home_win_pct, cls: "c1" },
    ], { max: 100, labelW: 200, label: "Win rate of teams playing with ten men" }),
    caption: "Share of matches won by the team that received the only red card, compared with the home win rate in matches with no red cards.",
  });

  // ---- 12. upsets
  const up = d.biggest_upsets, a = up[0], b = up[1], c = up[2], e = up[3];
  const line = r => `${r.HomeTeam} ${r.FTHG}–${r.FTAG} ${r.AwayTeam} (${r.League}, ${r.Date})`;
  const sameVictim = a.LosingTeam === b.LosingTeam && a.WinningOdds === b.WinningOdds;
  fill("upsets", {
    h2: sameVictim
      ? `The longest-odds winners came in at ${f1(a.WinningOdds)}, and ${a.LosingTeam} was the victim twice`
      : `The longest-odds winner came in at ${f1(a.WinningOdds)}`,
    paras: [
      `Decimal odds of ${f1(a.WinningOdds)} imply a ${pc(a.WinnerImpliedProbPct)} chance. That happened in ${line(a)}${sameVictim ? ` and again in ${line(b)}` : ""}.`,
      `Next on the list: ${line(c)} at ${f1(c.WinningOdds)} (${pc(c.WinnerImpliedProbPct)} implied), and ${line(e)} at ${f1(e.WinningOdds)}. The ranking covers the ${up.length} longest-odds winners in matches that had a decisive result.`,
    ],
    plot: hbar(up.slice(0, 10).map(r => ({ label: `${r.WinningTeam} over ${r.LosingTeam} (${r.Date.slice(0, 4)})`, value: r.WinningOdds, text: f1(r.WinningOdds) })),
      { labelW: 270, label: "Ten longest-odds winners" }),
    caption: "Decimal odds of the winning team in the ten biggest upsets.",
  });

  // ---- closing: data + methods
  const st_ = d.shots_on_target_vs_win.matches_with_shot_data;
  document.querySelector("#data .text").innerHTML = `
    <h3>Where the data comes from</h3>
    <p>Match data was downloaded from <a href="https://www.football-data.co.uk/">football-data.co.uk</a>: ${leagues.length} leagues (${leagues.map(r => esc(r.League)).join(", ")}) for the ${seasons.length} seasons from ${firstSeason} to ${lastSeason}. Betting odds are the pre-match Bet365 decimal odds recorded in that source.</p>

    <h3>What one row is</h3>
    <p>One row is one match: the two teams, the date, the league and season, the half-time and full-time scores, and, where the source records them, shots, shots on target, corners, fouls, cards and the Bet365 home/draw/away odds. The analysis uses ${n0(d.n_matches_total)} rows.</p>

    <h3>Rows that were dropped or left out</h3>
    <ul>
      <li>During cleaning, rows with a missing or unreadable date, or with no final score, were dropped, because a match with no result cannot be counted. The ${n0(d.n_matches_total)} matches used here are the rows that remained.</li>
      <li>${n0(d.favorite_win_rate_overall.excluded_invalid_odds)} matches were left out of every odds-based number because a recorded odd was corrupted (a value of 1.0 or below is impossible for decimal odds). That leaves ${n0(d.favorite_win_rate_overall.matches_with_odds)} matches with usable odds.</li>
      <li>Some statistics are only recorded in some leagues and seasons, so those sections use a subset: ${n0(ht.matches_with_ht_data)} matches with half-time scores, ${n0(st_)} with shots on target, and ${n0(d.red_cards_vs_win.matches_with_card_data)} with card data.</li>
      <li>Team rankings only include clubs with at least ${d.results_by_team_top10_home_win_pct.min_home_matches_threshold} home matches (${d.results_by_team_top10_home_win_pct.teams_qualifying} clubs qualify), so a team with a short record cannot top a list.</li>
    </ul>

    <h3>How each rate and average is computed</h3>
    <ul>
      <li><strong>Home win, draw and away win %:</strong> matches with that result ÷ matches in the group (league, season or team) × 100, rounded to one decimal.</li>
      <li><strong>Season and league trends:</strong> the first-five and last-five figures are simple averages of five yearly rates, and the trend is the slope of a least-squares line through the yearly values. The "before" and "after" averages around ${d.home_advantage_covid.season} are simple averages of the yearly rates on either side.</li>
      <li><strong>Favorite and underdog:</strong> the favorite is the outcome (home, draw or away) with the lowest Bet365 odds and the underdog is the one with the highest. Favorite win % = matches the favorite won ÷ matches with usable odds × 100.</li>
      <li><strong>Implied probability:</strong> 1 ÷ odds for each outcome, divided by the sum of those three values, so the bookmaker's margin is removed and the three add to 100%. Calibration compares the average implied chance with the share that actually happened, in bands of implied chance.</li>
      <li><strong>Underdog profit and return:</strong> a $${d.underdog_flat_bet_pnl.stake_per_bet_usd} stake on the underdog wins (odds − 1) dollars if it happens and loses $${d.underdog_flat_bet_pnl.stake_per_bet_usd} otherwise. Return = total profit ÷ number of bets × 100.</li>
      <li><strong>Goals per game:</strong> home goals plus away goals for each match, averaged over the matches in the group, rounded to two decimals.</li>
      <li><strong>Most common score:</strong> the scoreline (home goals–away goals) that appears most often in a league; its share is that count ÷ the league's matches × 100.</li>
      <li><strong>Half-time leads:</strong> among matches where one team led at half-time, the lead is held if that team won, drawn back if the match ended level, and reversed if the other team won. Each is a share of those matches. Comeback % by league is reversed leads ÷ matches with a half-time leader.</li>
      <li><strong>Shots on target:</strong> matches are grouped by whether the home team had more, the same or fewer shots on target than the away team; the figure is the home win % within each group.</li>
      <li><strong>Red cards:</strong> a "sole red card" match is one where exactly one team had at least one red card and the other had none. "Still won" is the share of those matches won by the team that was reduced to ten men.</li>
      <li><strong>Points per game:</strong> 3 points for a win, 1 for a draw, 0 for a loss, averaged separately over a team's home and away matches. The gap is home minus away.</li>
      <li><strong>Biggest upsets:</strong> among matches with a winner, the winning team's decimal odds ranked from longest; ties are broken by earlier date, then team name. The implied chance shown is 100 ÷ odds.</li>
    </ul>`;
}

// ---------------------------------------------------------------- boot
fetch("data/findings.json")
  .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
  .then(render)
  .catch(err => {
    const box = document.getElementById("error");
    box.hidden = false;
    box.innerHTML = `Could not load <code>data/findings.json</code> (${esc(err.message)}). ` +
      `Browsers block file loading from a page opened directly from disk. Run <code>python -m http.server</code> in this folder and open <code>http://localhost:8000</code>.`;
    document.getElementById("summary").textContent = "";
    console.error(err);
  });
