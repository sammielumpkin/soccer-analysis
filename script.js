/* Renders index.html from data/findings.json. No number on the page is
   typed by hand: text and charts are both filled from that file.
   Formatters and chart builders live in charts.js. */

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
    `${firstSeason} to ${lastSeason}. Home teams won ${pc(rates.home_win_pct)} of them, ${pc(rates.draw_pct)} ended in a draw, ` +
    `and a $${d.underdog_flat_bet_pnl.stake_per_bet_usd} bet on the underdog in every match would have returned ${signed(d.underdog_flat_bet_pnl.overall_roi_pct)}%. ` +
    `The sections below cover home advantage, betting odds, goals, half-time swings, shots, red cards and the biggest upsets.`;

  // ---- the leagues table (from findings.json league_overview)
  const ov = d.league_overview;
  const countries = new Set(ov.map(r => r.Country)).size;
  const divisions = new Set(ov.map(r => r.tier)).size;
  document.getElementById("leagues-intro").textContent =
    `The data covers the top ${divisions === 2 ? "two divisions" : divisions + " divisions"} in ${countries} countries, ${seasons.length} seasons each.`;
  const tierName = t => (t === 1 ? "Top division" : "Second division");
  const teams = r => (r.teams_per_season_min === r.teams_per_season_max ? `${r.teams_per_season_typical}` : `${r.teams_per_season_typical} (${r.teams_per_season_min}–${r.teams_per_season_max})`);
  const byCountry = [...new Set(ov.map(r => r.Country))].sort();
  document.getElementById("league-table").innerHTML =
    `<thead><tr><th>Country</th><th class="l">League</th><th class="l">Division</th><th>Teams per season</th><th>Matches</th></tr></thead>` +
    byCountry.map(c => {
      const rows = ov.filter(r => r.Country === c).sort((x, y) => x.tier - y.tier);
      return `<tbody>` + rows.map((r, i) =>
        `<tr>${i === 0 ? `<th scope="rowgroup" rowspan="${rows.length}" class="country-cell">${withFlag(c)}</th>` : ""}` +
        `<td class="l">${esc(r.League)}</td><td class="l">${tierName(r.tier)}</td><td>${teams(r)}</td><td>${n0(r.matches)}</td></tr>`).join("") + `</tbody>`;
    }).join("");

  document.getElementById("stats").innerHTML = [
    [n0(d.n_matches_total), "matches analyzed"],
    [pc(rates.home_win_pct), "of matches won by the home team"],
    [pc(rates.draw_pct), "of matches ending in a draw"],
    [`${signed(d.underdog_flat_bet_pnl.overall_roi_pct)}%`, "return on betting the underdog in every match"],
  ].map(([num, label]) => `<div class="stat"><div class="num">${num}</div><div class="label">${label}</div></div>`).join("");

  // ---- 1. home advantage by league
  const topHome = maxBy(leagues, r => r.home_win_pct), lowHome = minBy(leagues, r => r.home_win_pct);
  fill("home-advantage", {
    h2: `Home teams win ${pc(rates.home_win_pct)} of matches, far more often than visitors (${pc(rates.away_win_pct)})`,
    paras: [
      `Across all ${n0(d.n_matches_total)} matches, the home side won ${pc(rates.home_win_pct)}, the away side won ${pc(rates.away_win_pct)}, and ${pc(rates.draw_pct)} ended in a draw.`,
      `The edge shows up in every league, but its size varies. ${esc(topHome.League)} has the highest home-win rate at ${pc(topHome.home_win_pct)} across ${n0(topHome.matches)} matches, while ${esc(lowHome.League)} has the lowest at ${pc(lowHome.home_win_pct)} across ${n0(lowHome.matches)}.`,
    ],
    plot: stacked(
      [...leagues].sort((a, b) => b.home_win_pct - a.home_win_pct).map(r => ({
        label: r.League, flag: flagSrc(r.League), parts: [r.home_win_pct, r.draw_pct, r.away_win_pct], names: ["Home win", "Draw", "Away win"],
      })), { label: "Home, draw and away result rates by league" }) + legend(["Home win %", "Draw %", "Away win %"]),
    caption: "Share of matches ending in a home win, draw or away win, by league.",
  });

  // ---- 2. home fortresses
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

  // ---- 3. calibration
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

  // ---- 4. underdog P&L
  const u = d.underdog_flat_bet_pnl;
  const profitable = u.by_season.filter(r => r.profit_usd > 0);
  const worstS = minBy(u.by_season, r => r.roi_pct), bestL = maxBy(u.by_league, r => r.roi_pct), worstL = minBy(u.by_league, r => r.roi_pct);
  fill("underdogs", {
    h2: `Betting $${u.stake_per_bet_usd} on the underdog every match would have lost ${money(Math.abs(u.total_profit_usd))}`,
    paras: [
      `Suppose you staked $${u.stake_per_bet_usd} on the longest-odds outcome in each of ${n0(u.total_bets)} matches. The total result would be ${money(u.total_profit_usd)}, a return of ${signed(u.overall_roi_pct)}% per bet. Underdogs win often enough to feel tempting, but not often enough to cover the bookmaker's margin.`,
      `${profitable.length === 1 ? `Only one season was profitable: ${profitable[0].Season} at ${signed(profitable[0].roi_pct)}%.` : `${profitable.length} seasons were profitable.`} The worst season was ${worstS.Season} at ${signed(worstS.roi_pct)}%. By league, ${esc(bestL.League)} lost the least (${signed(bestL.roi_pct)}%) and ${esc(worstL.League)} lost the most (${signed(worstL.roi_pct)}%).`,
    ],
    plot: vbar(u.by_season.map(r => ({ label: r.Season, value: r.roi_pct })), { unit: "%", dec: 0, label: "Underdog flat-bet return by season" }),
    caption: "Return on investment (profit per $1 staked) for betting the underdog in every match, by season.",
  });

  // ---- 5. goals
  const g = d.highest_scoring_league_trend;
  fill("goals", {
    h2: `${g.league} scores the most, and its goals per game rose from ${f2(g.first_5_seasons_avg)} to ${f2(g.last_5_seasons_avg)}`,
    paras: [
      `${esc(g.league)} averages ${f2(g.overall_avg_goals_per_game)} goals per game, the highest of the ${leagues.length} leagues. Its average peaked at ${f2(g.peak_avg_goals_per_game)} in ${g.peak_season} and was lowest at ${f2(g.trough_avg_goals_per_game)} in ${g.trough_season}.`,
      `Comparing the first five seasons (${f2(g.first_5_seasons_avg)}) with the last five (${f2(g.last_5_seasons_avg)}) gives a rise of ${f2(g.change_first5_to_last5)} goals per game. A straight-line fit through the ${g.by_season.length} seasons slopes ${signed(g.linear_trend_goals_per_game_per_season, 4)} goals per game each season.`,
    ],
    plot: lineChart(g.by_season.map(r => shortSeason(r.Season)), [{ name: `${g.league} goals per game`, values: g.by_season.map(r => r.avg_goals_per_game) }],
      { dec: 2, label: `${g.league} goals per game by season` }),
    caption: `Average total goals (home plus away) per match in the ${g.league}, by season.`,
  });

  // ---- 6. most common score
  const sc = d.most_common_score_by_league;
  const allSame = sc.every(r => r.most_common_score === sc[0].most_common_score);
  const scHi = maxBy(sc, r => r.most_common_pct), scLo = minBy(sc, r => r.most_common_pct);
  fill("scores", {
    h2: allSame ? `${sc[0].most_common_score} is the most common final score in all ${sc.length} leagues` : "The most common final score differs between leagues",
    paras: [
      `${esc(scHi.League)} has the highest share of ${scHi.most_common_score} results at ${pc(scHi.most_common_pct)} (${n0(scHi.most_common_count)} of ${n0(scHi.matches)} matches). ${esc(scLo.League)} has the lowest at ${pc(scLo.most_common_pct)}.`,
      `Behind the top score, the next most common results in ${esc(scLo.League)} are ${scLo.top_3.slice(1).map(t => `${t.score} (${pc(t.pct)})`).join(" and ")}. In ${esc(scHi.League)} they are ${scHi.top_3.slice(1).map(t => `${t.score} (${pc(t.pct)})`).join(" and ")}. Low-scoring outcomes dominate everywhere.`,
    ],
    plot: hbar([...sc].sort((a, b) => b.most_common_pct - a.most_common_pct).map(r => ({ label: `${r.League} (${r.most_common_score})`, flag: flagSrc(r.League), value: r.most_common_pct })),
      { labelW: 190, label: "Share of matches with the most common score, by league" }),
    caption: "Share of each league's matches that ended with its most common scoreline (shown in brackets).",
  });

  // ---- 7. half-time
  const ht = d.halftime_leads, hc = d.halftime_comebacks_by_league, lv = ht.level_at_half_time;
  const hcRate = hc.by_league.find(r => r.League === hc.most_comebacks_by_rate), hcCount = hc.by_league.find(r => r.League === hc.most_comebacks_by_raw_count);
  fill("half-time", {
    h2: `Half-time leaders go on to win ${pc(ht.lead_held_pct)} of the time; only ${pc(ht.lead_reversed_pct)} of leads are reversed`,
    paras: [
      `In ${n0(ht.matches_with_a_ht_leader)} of ${n0(ht.matches_with_ht_data)} matches with half-time data, one team was ahead at the break. That team went on to win ${pc(ht.lead_held_pct)} of the time, drew ${pc(ht.lead_drawn_pct)}, and lost ${pc(ht.lead_reversed_pct)}.`,
      `Comebacks are most frequent in ${esc(hcRate.League)} (${pc(hcRate.comeback_pct)} of leads), while ${esc(hcCount.League)} has the most in raw count (${n0(hcCount.comebacks)}). When matches were level at half-time (${n0(lv.matches)}), they finished ${pc(lv.home_win_pct)} home wins, ${pc(lv.draw_pct)} draws and ${pc(lv.away_win_pct)} away wins.`,
    ],
    plot: hbar([
      { label: "Lead held (win)", value: ht.lead_held_pct, cls: "c1" },
      { label: "Lead drawn back", value: ht.lead_drawn_pct, cls: "c2" },
      { label: "Lead reversed (loss)", value: ht.lead_reversed_pct, cls: "c3" },
    ], { max: 100, label: "Outcome of half-time leads" }),
    caption: "Final result for the team that led at half-time.",
  });

  // ---- 8. shots on target
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

  // ---- 9. red cards
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

  // ---- 10. upsets
  const up = d.biggest_upsets, a = up[0], b = up[1], c = up[2], e = up[3];
  const line = r => `${r.HomeTeam} ${r.FTHG}–${r.FTAG} ${r.AwayTeam} (${esc(r.League)}, ${r.Date})`;
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
  const st_ = d.shots_on_target_vs_win.matches_with_shot_data, cl = d.cleaning;
  document.querySelector("#data .text").innerHTML = `
    <h3>Where the data comes from</h3>
    <p>Match data was downloaded from <a href="https://www.football-data.co.uk/">football-data.co.uk</a>: ${leagues.length} leagues (${leagues.map(r => esc(r.League)).join(", ")}) for the ${seasons.length} seasons from ${firstSeason} to ${lastSeason}. Betting odds are the pre-match Bet365 decimal odds recorded in that source.</p>

    <h3>What one row is</h3>
    <p>One row is one match: the two teams, the date, the league and season, the half-time and full-time scores, and, where the source records them, shots, shots on target, corners, fouls, cards and the Bet365 home/draw/away odds. The analysis uses ${n0(d.n_matches_total)} rows.</p>

    <h3>Rows that were dropped or left out</h3>
    <ul>
      <li>The downloaded file had ${n0(cl.raw_rows)} rows. The cleaning step drops any row with a missing or unreadable date (${n0(cl.dropped_unparseable_date)} found) or with no final score (${n0(cl.dropped_missing_score)} found), because a match with no result cannot be counted. That is ${n0(cl.rows_dropped_total)} rows dropped, so all ${n0(d.n_matches_total)} matches are kept.</li>
      <li>${n0(d.favorite_win_rate_overall.excluded_invalid_odds)} matches were left out of every odds-based number because a recorded odd was corrupted (a value of 1.0 or below is impossible for decimal odds). That leaves ${n0(d.favorite_win_rate_overall.matches_with_odds)} matches with usable odds.</li>
      <li>Some statistics are only recorded in some leagues and seasons, so those sections use a subset: ${n0(ht.matches_with_ht_data)} matches with half-time scores, ${n0(st_)} with shots on target, and ${n0(d.red_cards_vs_win.matches_with_card_data)} with card data.</li>
      <li>France's 2019�20 seasons were cut short by COVID-19: Ligue 1 has 279 of 380 scheduled matches and Ligue 2 has 280, so those two seasons are not full schedules. Two other seasons are slightly short in the source file with no dropped rows on our side: Ligue 2 2007�08 (348 matches) and Ligue 2 2023�24 (379).</li>
      <li>Team names are trimmed of stray spaces before counting clubs (two clubs, Kaiserslautern and Piacenza, were spelled with a trailing space in some rows), so each club is counted once per season.</li>
      <li>Team rankings only include clubs with at least ${d.results_by_team_top10_home_win_pct.min_home_matches_threshold} home matches (${d.results_by_team_top10_home_win_pct.teams_qualifying} clubs qualify), so a team with a short record cannot top a list.</li>
    </ul>

    <h3>How each rate and average is computed</h3>
    <ul>
      <li><strong>League table:</strong> matches are the rows in that league; teams per season is the number of distinct clubs appearing in a season, shown as the median across seasons (with the range when it varies). Division level is stated by hand because the file has no such column.</li>
      <li><strong>Home win, draw and away win %:</strong> matches with that result ÷ matches in the group (league, season or team) × 100, rounded to one decimal.</li>
      <li><strong>Season and league trends:</strong> the first-five and last-five figures are simple averages of five yearly rates, and the trend is the slope of a least-squares line through the yearly values.</li>
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
