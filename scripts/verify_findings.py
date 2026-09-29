"""Independently verify the headline findings against data/findings.json.

Recomputes each number straight from data/matches.csv using different
pandas techniques than scripts/analysis.py -- crosstabs instead of manual
groupby loops, Counter instead of value_counts(), a melt/reshape instead
of np.where masking, idxmin/idxmax instead of dict-based apply, and a
plain itertuples loop instead of vectorized boolean logic -- so a bug in
analysis.py's approach would not simply be repeated here.

Prints a comparison table (verify-script result vs. saved result, match?,
and how many matches the number rests on) and a pass/fail summary.
"""
import json
from collections import Counter

import numpy as np
import pandas as pd

df = pd.read_csv("data/matches.csv", parse_dates=["Date"])
findings = json.load(open("data/findings.json"))

rows = []  # each: (section, label, verify_val, saved_val, match_bool, n)


def record(section, label, verify_val, saved_val, n, tol=0.05):
    if isinstance(verify_val, (int, float, np.floating, np.integer)) and \
       isinstance(saved_val, (int, float)):
        ok = abs(float(verify_val) - float(saved_val)) <= tol
    else:
        ok = verify_val == saved_val
    rows.append((section, label, verify_val, saved_val, ok, n))


# Valid-odds subset used by several checks below (decimal odds must be > 1.0;
# two rows in the raw data have a corrupted 0.0 value -- see analysis.py).
odds = df.dropna(subset=["B365H", "B365D", "B365A"]).copy()
odds = odds[(odds[["B365H", "B365D", "B365A"]] > 1.0).all(axis=1)]

# =====================================================================
# 1. Home/draw/away rates for the top 10 highest home-win-rate teams
#    (technique: pd.crosstab, vs. analysis.py's manual groupby loop)
# =====================================================================
ct_team = pd.crosstab(df["HomeTeam"], df["FTR"], normalize="index") * 100
home_counts = df["HomeTeam"].value_counts()
min_matches = findings["results_by_team_top10_home_win_pct"]["min_home_matches_threshold"]
qualifying = home_counts[home_counts >= min_matches]
ranked_teams = ct_team.loc[qualifying.index, "H"].sort_values(ascending=False)

record("1. Top-10 home-win teams", "teams qualifying (>= min matches)",
       len(qualifying), findings["results_by_team_top10_home_win_pct"]["teams_qualifying"],
       int(len(qualifying)), tol=0)

saved_top10 = {r["Team"]: r for r in findings["results_by_team_top10_home_win_pct"]["top_10"]}
for team in ranked_teams.index[:10]:
    h = round(ct_team.loc[team, "H"], 1)
    d = round(ct_team.loc[team, "D"], 1)
    a = round(ct_team.loc[team, "A"], 1)
    n = int(home_counts[team])
    saved = saved_top10.get(team)
    saved_str = f"H{saved['home_win_pct']} D{saved['draw_pct']} A{saved['away_win_pct']}" if saved else "MISSING"
    verify_str = f"H{h} D{d} A{a}"
    ok = saved is not None and abs(h - saved["home_win_pct"]) <= 0.05 and \
        abs(d - saved["draw_pct"]) <= 0.05 and abs(a - saved["away_win_pct"]) <= 0.05
    rows.append(("1. Top-10 home-win teams", team, verify_str, saved_str, ok, n))

# =====================================================================
# 2. Home/draw/away rates by league -- which has the strongest home
#    advantage? (technique: pd.crosstab, vs. analysis.py's manual loop)
# =====================================================================
ct_league = pd.crosstab(df["League"], df["FTR"], normalize="index") * 100
league_counts = df["League"].value_counts()
saved_by_league = {r["League"]: r for r in findings["results_by_league"]}

for lg in ct_league["H"].sort_values(ascending=False).index:
    h = round(ct_league.loc[lg, "H"], 1)
    saved = saved_by_league[lg]["home_win_pct"]
    record("2. Home win% by league", lg, h, saved, int(league_counts[lg]))

verify_strongest = ct_league["H"].idxmax()
saved_strongest = findings["strongest_league_home_advantage_trend"]["league"]
record("2. Home win% by league", "-> strongest home advantage (league name)",
       verify_strongest, saved_strongest, int(league_counts[verify_strongest]), tol=0)

# =====================================================================
# 3. Biggest upsets: longest odds for the actual winner
#    (technique: melt to long format + filter to the winning side,
#    vs. analysis.py's np.where column construction)
# =====================================================================
long = odds.melt(
    id_vars=["Date", "League", "HomeTeam", "AwayTeam", "FTR", "FTHG", "FTAG"],
    value_vars=["B365H", "B365D", "B365A"], var_name="OutcomeCol", value_name="Odds",
)
long["Outcome"] = long["OutcomeCol"].str[-1]
decisive_long = long[(long["FTR"] != "D") & (long["Outcome"] == long["FTR"])].copy()
decisive_long["Winner"] = np.where(decisive_long["FTR"] == "H", decisive_long["HomeTeam"], decisive_long["AwayTeam"])
# Same tie-break as analysis.py (date, then team name) so ties resolve identically.
top_upsets_verify = decisive_long.sort_values(
    ["Odds", "Date", "Winner"], ascending=[False, True, True]
).head(10).reset_index(drop=True)

saved_upsets = findings["biggest_upsets"][:10]
for i in range(10):
    v = top_upsets_verify.iloc[i]
    s = saved_upsets[i]
    winner = v["HomeTeam"] if v["FTR"] == "H" else v["AwayTeam"]
    verify_str = f"{v['Date'].strftime('%Y-%m-%d')} {winner} @odds {v['Odds']}"
    saved_str = f"{s['Date']} {s['WinningTeam']} @odds {s['WinningOdds']}"
    ok = v["Date"].strftime("%Y-%m-%d") == s["Date"] and winner == s["WinningTeam"] and abs(v["Odds"] - s["WinningOdds"]) <= 0.05
    rows.append(("3. Biggest upsets (top 10)", f"#{i + 1}", verify_str, saved_str, ok, 1))

# =====================================================================
# 4. $1 flat bet on the underdog, every match: profit or loss?
#    (technique: idxmax/max vectorized, vs. analysis.py's dict-based apply)
# =====================================================================
underdog_odds = odds[["B365H", "B365D", "B365A"]].max(axis=1)
underdog_side = odds[["B365H", "B365D", "B365A"]].idxmax(axis=1).str[-1]
won = underdog_side == odds["FTR"]
profit = np.where(won, underdog_odds - 1, -1.0)
total_profit = float(profit.sum())
total_bets = len(odds)
roi = round(100 * total_profit / total_bets, 1)

saved_pnl = findings["underdog_flat_bet_pnl"]
record("4. Underdog $1 flat-bet P&L", "total profit ($)", round(total_profit, 2), saved_pnl["total_profit_usd"], total_bets, tol=1.0)
record("4. Underdog $1 flat-bet P&L", "overall ROI (%)", roi, saved_pnl["overall_roi_pct"], total_bets)
record("4. Underdog $1 flat-bet P&L", "total bets", total_bets, saved_pnl["total_bets"], total_bets, tol=0)

# =====================================================================
# 5. Goals per game by league -- which is highest scoring?
#    (technique: sum home goals + sum away goals separately then divide,
#    vs. analysis.py's mean() of a combined TotalGoals column)
# =====================================================================
goals_by_league = {}
for lg, g in df.groupby("League"):
    goals_by_league[lg] = (g["FTHG"].sum() + g["FTAG"].sum()) / len(g)
goals_series = pd.Series(goals_by_league).sort_values(ascending=False)

saved_goals_league = findings["highest_scoring_league_trend"]
saved_league_avgs = {}
for r in findings["goals_per_game_by_league_season"]:
    saved_league_avgs.setdefault(r["League"], []).append((r["matches"], r["avg_goals_per_game"]))
for lg, entries in saved_league_avgs.items():
    total_m = sum(m for m, _ in entries)
    weighted = sum(m * v for m, v in entries) / total_m
    record("5. Goals/game by league", lg, round(goals_series[lg], 2), round(weighted, 2), total_m)

record("5. Goals/game by league", "-> highest-scoring league (name)",
       goals_series.index[0], saved_goals_league["league"], int(league_counts[goals_series.index[0]]), tol=0)

# =====================================================================
# 6. Most common final score, by league
#    (technique: collections.Counter, vs. analysis.py's value_counts())
# =====================================================================
saved_scores = {r["League"]: r for r in findings["most_common_score_by_league"]}
for lg, g in df.groupby("League"):
    c = Counter(zip(g["FTHG"], g["FTAG"]))
    (h, a), n_top = c.most_common(1)[0]
    verify_score = f"{h}-{a}"
    saved = saved_scores[lg]
    record("6. Most common score by league", lg, f"{verify_score} (n={n_top})",
           f"{saved['most_common_score']} (n={saved['most_common_count']})", len(g), tol=0)

# =====================================================================
# 7. Half-time comebacks: overall rate, and which league has the most?
#    (technique: plain itertuples loop, vs. analysis.py's vectorized
#    boolean OR / dict-map approach)
# =====================================================================
ht = df.dropna(subset=["HTR"]).copy()
leading = ht[ht["HTR"] != "D"]

comeback_count = 0
league_comeback = Counter()
league_leading_total = Counter()
for row in leading.itertuples():
    league_leading_total[row.League] += 1
    trailing_won = (row.HTR == "H" and row.FTR == "A") or (row.HTR == "A" and row.FTR == "H")
    if trailing_won:
        comeback_count += 1
        league_comeback[row.League] += 1

n_leading = len(leading)
overall_rate = round(100 * comeback_count / n_leading, 1)
record("7. Half-time comebacks", "overall comeback rate (%)", overall_rate,
       findings["halftime_leads"]["lead_reversed_pct"], n_leading)

saved_hc = {r["League"]: r for r in findings["halftime_comebacks_by_league"]["by_league"]}
for lg in league_leading_total:
    n = league_leading_total[lg]
    rate = round(100 * league_comeback[lg] / n, 1)
    saved = saved_hc[lg]
    record("7. Half-time comebacks", lg, rate, saved["comeback_pct"], n)

verify_most_by_rate = max(league_comeback, key=lambda lg: league_comeback[lg] / league_leading_total[lg])
verify_most_by_count = max(league_comeback, key=lambda lg: league_comeback[lg])
record("7. Half-time comebacks", "-> most comebacks by rate (league)",
       verify_most_by_rate, findings["halftime_comebacks_by_league"]["most_comebacks_by_rate"],
       league_leading_total[verify_most_by_rate], tol=0)
record("7. Half-time comebacks", "-> most comebacks by raw count (league)",
       verify_most_by_count, findings["halftime_comebacks_by_league"]["most_comebacks_by_raw_count"],
       league_leading_total[verify_most_by_count], tol=0)

# =====================================================================
# 8. Favorite's implied probability above 70%: actual win rate
#    (technique: idxmin + manual boolean threshold, vs. analysis.py's
#    dict-based apply + pd.cut)
# =====================================================================
fav_side = odds[["B365H", "B365D", "B365A"]].idxmin(axis=1).str[-1]
fav_odds = odds[["B365H", "B365D", "B365A"]].min(axis=1)
overround = (1 / odds["B365H"] + 1 / odds["B365D"] + 1 / odds["B365A"])
implied_fav = (1 / fav_odds) / overround
fav_won = fav_side == odds["FTR"]

above70_mask = implied_fav >= 0.70
n_above70 = int(above70_mask.sum())
win_pct_above70 = round(100 * fav_won[above70_mask].sum() / n_above70, 1)

saved_above70 = findings["favorite_calibration_by_range"]["above_70pct_implied"]
record("8. Favorite implied prob > 70%", "matches", n_above70, saved_above70["matches"], n_above70, tol=0)
record("8. Favorite implied prob > 70%", "actual win rate (%)", win_pct_above70,
       saved_above70["actual_favorite_win_pct"], n_above70)

# =====================================================================
# Print comparison table
# =====================================================================
print("=" * 100)
print(f"{'Section':<32} {'Label':<28} {'Verify script':<20} {'findings.json':<20} {'Match':<6} {'n':>7}")
print("=" * 100)
last_section = None
for section, label, v, s, ok, n in rows:
    if section != last_section:
        print(f"\n--- {section} ---")
        last_section = section
    mark = "OK" if ok else "MISMATCH"
    print(f"{'':<0}{label:<28} {str(v):<20} {str(s):<20} {mark:<8} {n:>7,}")

n_total = len(rows)
n_ok = sum(1 for r in rows if r[4])
n_bad = n_total - n_ok
print("\n" + "=" * 100)
print(f"TOTAL: {n_ok}/{n_total} match, {n_bad} mismatch(es)")
if n_bad:
    print("\nMismatches:")
    for section, label, v, s, ok, n in rows:
        if not ok:
            print(f"  [{section}] {label}: verify={v}  saved={s}  (n={n:,})")
print("=" * 100)
