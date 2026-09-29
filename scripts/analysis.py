"""Compute the headline findings behind the report page.

Reads data/matches.csv, runs each analysis below, prints a plain-language
summary of the result, and saves every number to data/findings.json so the
report page (index.html) can render numbers and charts without re-deriving
them in JavaScript.

Any analysis that uses shots, corners, fouls, or cards is restricted to the
matches where that stat is actually recorded (older seasons and some
divisions don't have it), and prints how many matches that subset holds.
"""
import json
import numpy as np
import pandas as pd

IN_PATH = "data/matches.csv"
OUT_PATH = "data/findings.json"

MIN_TEAM_MATCHES = 150   # min home AND away matches to rank a team's home/away gap
MIN_LEAGUE_ODDS_MATCHES = 100  # min matches with odds to rank a league's predictability

df = pd.read_csv(IN_PATH, parse_dates=["Date"])
N_TOTAL = len(df)

findings = {"n_matches_total": int(N_TOTAL)}


def pct(numerator, denominator, digits=1):
    if denominator == 0 or pd.isna(denominator):
        return None
    return round(100 * numerator / denominator, digits)


def clean(obj):
    """Recursively convert numpy/pandas scalars to plain Python for JSON."""
    if isinstance(obj, dict):
        return {k: clean(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [clean(v) for v in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return None if np.isnan(obj) else round(float(obj), 4)
    if isinstance(obj, float) and pd.isna(obj):
        return None
    if pd.isna(obj) if not isinstance(obj, (list, dict)) else False:
        return None
    return obj


print("=" * 70)
print(f"Loaded {N_TOTAL:,} matches from {IN_PATH}")
print("=" * 70)

# ---------------------------------------------------------------------------
# 1. Home / draw / away win rates by league and by season
# ---------------------------------------------------------------------------
def result_rates(group_col):
    rows = []
    for key, g in df.groupby(group_col):
        n = len(g)
        h = int((g["FTR"] == "H").sum())
        d = int((g["FTR"] == "D").sum())
        a = int((g["FTR"] == "A").sum())
        rows.append({
            group_col: key, "matches": n,
            "home_win_pct": pct(h, n), "draw_pct": pct(d, n), "away_win_pct": pct(a, n),
        })
    return rows

by_league = result_rates("League")
by_season = result_rates("Season")
findings["results_by_league"] = by_league
findings["results_by_season"] = by_season

# Same rates broken down by team (their home matches only), so we can rank
# the teams with the strongest -- and weakest -- home records. Restricted to
# teams with enough home matches (same threshold used in section 7) so the
# ranking isn't driven by a team that only played a handful of home games.
by_team = [r for r in result_rates("HomeTeam") if r["matches"] >= MIN_TEAM_MATCHES]
by_team.sort(key=lambda r: r["home_win_pct"], reverse=True)
findings["results_by_team_top10_home_win_pct"] = {
    "min_home_matches_threshold": MIN_TEAM_MATCHES,
    "teams_qualifying": len(by_team),
    "top_10": [{"Team": r["HomeTeam"], **{k: v for k, v in r.items() if k != "HomeTeam"}} for r in by_team[:10]],
}

overall_h = pct((df["FTR"] == "H").sum(), N_TOTAL)
overall_d = pct((df["FTR"] == "D").sum(), N_TOTAL)
overall_a = pct((df["FTR"] == "A").sum(), N_TOTAL)
findings["overall_result_rates"] = {"home_win_pct": overall_h, "draw_pct": overall_d, "away_win_pct": overall_a}

print("\n1) Home/draw/away rates")
print(f"   Overall: home {overall_h}%, draw {overall_d}%, away {overall_a}%")
top_home = max(by_league, key=lambda r: r["home_win_pct"])
low_home = min(by_league, key=lambda r: r["home_win_pct"])
print(f"   Strongest home advantage: {top_home['League']} ({top_home['home_win_pct']}% home wins)")
print(f"   Weakest home advantage:   {low_home['League']} ({low_home['home_win_pct']}% home wins)")

print(f"\n   Top 10 teams by home win rate (min {MIN_TEAM_MATCHES} home matches, {len(by_team)} teams qualify):")
for r in findings["results_by_team_top10_home_win_pct"]["top_10"]:
    print(f"     {r['Team']:<20} home {r['home_win_pct']}%  draw {r['draw_pct']}%  away win {r['away_win_pct']}%  (n={r['matches']})")

# ---------------------------------------------------------------------------
# 2. Home advantage in 2020-21 (empty stadiums) vs before/after
# ---------------------------------------------------------------------------
season_home = {r["Season"]: r["home_win_pct"] for r in by_season}
covid_season = "2020-21"
before = [v for s, v in season_home.items() if s < covid_season]
after = [v for s, v in season_home.items() if s > covid_season]
covid_rate = season_home.get(covid_season)
avg_before = round(sum(before) / len(before), 1) if before else None
avg_after = round(sum(after) / len(after), 1) if after else None

findings["home_advantage_covid"] = {
    "season": covid_season,
    "home_win_pct_2020_21": covid_rate,
    "avg_home_win_pct_before": avg_before,
    "avg_home_win_pct_after": avg_after,
    "drop_vs_before_pct_points": round(covid_rate - avg_before, 1) if covid_rate is not None and avg_before is not None else None,
    "recovered_after": (after and avg_after is not None and covid_rate is not None and avg_after > covid_rate),
}

print("\n2) Home advantage during empty-stadium season (2020-21)")
print(f"   Home win rate 2020-21: {covid_rate}%  |  avg before: {avg_before}%  |  avg after: {avg_after}%")
print(f"   Drop vs pre-covid average: {findings['home_advantage_covid']['drop_vs_before_pct_points']} points")
print(f"   Recovered after: {findings['home_advantage_covid']['recovered_after']}")

# ---------------------------------------------------------------------------
# 2b. Has the strongest league's home advantage changed over the 20 seasons?
# ---------------------------------------------------------------------------
strongest_league = top_home["League"]
lg_by_season = []
for season, g in df[df["League"] == strongest_league].groupby("Season"):
    lg_by_season.append({"Season": season, "matches": len(g), "home_win_pct": pct((g["FTR"] == "H").sum(), len(g))})
lg_by_season.sort(key=lambda r: r["Season"])

rates = [r["home_win_pct"] for r in lg_by_season]
seasons_list = [r["Season"] for r in lg_by_season]
slope = float(np.polyfit(range(len(rates)), rates, 1)[0])
peak = max(lg_by_season, key=lambda r: r["home_win_pct"])
trough = min(lg_by_season, key=lambda r: r["home_win_pct"])
first5_avg = round(sum(rates[:5]) / 5, 1)
last5_avg = round(sum(rates[-5:]) / 5, 1)

findings["strongest_league_home_advantage_trend"] = {
    "league": strongest_league,
    "overall_home_win_pct": top_home["home_win_pct"],
    "by_season": lg_by_season,
    "peak_season": peak["Season"], "peak_home_win_pct": peak["home_win_pct"],
    "trough_season": trough["Season"], "trough_home_win_pct": trough["home_win_pct"],
    "first_5_seasons_avg_pct": first5_avg,
    "last_5_seasons_avg_pct": last5_avg,
    "change_first5_to_last5_pct_points": round(last5_avg - first5_avg, 1),
    "linear_trend_pct_points_per_season": round(slope, 3),
}

print(f"\n2b) {strongest_league} home advantage over {len(seasons_list)} seasons (strongest league overall)")
print(f"   Peak: {peak['Season']} ({peak['home_win_pct']}%)  |  Trough: {trough['Season']} ({trough['home_win_pct']}%)")
print(f"   First 5 seasons avg: {first5_avg}%  |  Last 5 seasons avg: {last5_avg}%  |  Linear trend: {slope:.3f} pts/season")

# ---------------------------------------------------------------------------
# 3. Favorite (lowest B365 odds) win rate, by league
# ---------------------------------------------------------------------------
odds = df.dropna(subset=["B365H", "B365D", "B365A"]).copy()
# Decimal odds must be > 1.0 by definition; a small number of rows in the
# source data have a corrupted 0.0 value (e.g. Blackpool vs Derby 2013-04-27),
# which would divide by zero when computing implied probability. Drop those.
invalid_odds = (odds[["B365H", "B365D", "B365A"]] <= 1.0).any(axis=1)
n_invalid_odds = int(invalid_odds.sum())
odds = odds.loc[~invalid_odds].copy()
n_odds = len(odds)


def favorite_outcome(row):
    vals = {"H": row["B365H"], "D": row["B365D"], "A": row["B365A"]}
    return min(vals, key=vals.get)

odds["Favorite"] = odds.apply(favorite_outcome, axis=1)
odds["FavoriteWon"] = odds["Favorite"] == odds["FTR"]

favorite_by_league = []
for key, g in odds.groupby("League"):
    n = len(g)
    favorite_by_league.append({
        "League": key, "matches_with_odds": n,
        "favorite_win_pct": pct(g["FavoriteWon"].sum(), n),
    })
findings["favorite_win_rate_by_league"] = favorite_by_league
findings["favorite_win_rate_overall"] = {
    "matches_with_odds": n_odds,
    "excluded_invalid_odds": n_invalid_odds,
    "favorite_win_pct": pct(odds["FavoriteWon"].sum(), n_odds),
}

print(f"\n3) Bookmaker favorite win rate (matches with valid odds: {n_odds:,}; excluded {n_invalid_odds} with a corrupted 0.0 odd)")
print(f"   Overall favorite win rate: {findings['favorite_win_rate_overall']['favorite_win_pct']}%")
for r in sorted(favorite_by_league, key=lambda r: r["favorite_win_pct"], reverse=True):
    print(f"   {r['League']:<20} {r['favorite_win_pct']}%  (n={r['matches_with_odds']})")

# ---------------------------------------------------------------------------
# 3b. Flat $1 bet on the underdog (highest of the three B365 odds) every
#     match -- would it have made or lost money, by league and by season?
# ---------------------------------------------------------------------------
def underdog_outcome(row):
    vals = {"H": row["B365H"], "D": row["B365D"], "A": row["B365A"]}
    return max(vals, key=vals.get)

odds["Underdog"] = odds.apply(underdog_outcome, axis=1)
odds["UnderdogOdds"] = odds.apply(lambda r: r[f"B365{r['Underdog']}"], axis=1)
odds["UnderdogWon"] = odds["Underdog"] == odds["FTR"]
# A $1 stake returns (odds - 1) profit if the underdog wins, or loses the $1 stake.
odds["UnderdogProfit"] = np.where(odds["UnderdogWon"], odds["UnderdogOdds"] - 1, -1.0)


def betting_pnl(group_col):
    rows = []
    for key, g in odds.groupby(group_col):
        n = len(g)
        profit = g["UnderdogProfit"].sum()
        rows.append({
            group_col: key, "bets": n,
            "profit_usd": round(profit, 2),
            "roi_pct": round(100 * profit / n, 1),
        })
    return rows

underdog_pnl_by_league = betting_pnl("League")
underdog_pnl_by_season = betting_pnl("Season")
underdog_pnl_by_league_season = []
for (lg, season), g in odds.groupby(["League", "Season"]):
    n = len(g)
    profit = g["UnderdogProfit"].sum()
    underdog_pnl_by_league_season.append({
        "League": lg, "Season": season, "bets": n,
        "profit_usd": round(profit, 2), "roi_pct": round(100 * profit / n, 1),
    })

total_profit = odds["UnderdogProfit"].sum()
findings["underdog_flat_bet_pnl"] = {
    "stake_per_bet_usd": 1,
    "total_bets": n_odds,
    "total_profit_usd": round(total_profit, 2),
    "overall_roi_pct": round(100 * total_profit / n_odds, 1),
    "by_league": underdog_pnl_by_league,
    "by_season": underdog_pnl_by_season,
    "by_league_and_season": underdog_pnl_by_league_season,
}

print(f"\n3b) $1 flat bet on the underdog (highest-odds outcome), every match with valid odds ({n_odds:,} bets)")
print(f"   Total profit: ${total_profit:,.2f}  |  ROI: {findings['underdog_flat_bet_pnl']['overall_roi_pct']}%")
print("   By league:")
for r in sorted(underdog_pnl_by_league, key=lambda r: r["roi_pct"], reverse=True):
    sign = "+" if r["profit_usd"] >= 0 else ""
    print(f"     {r['League']:<20} {sign}${r['profit_usd']:>8,.2f}  ROI {r['roi_pct']:>6}%  (n={r['bets']})")
print("   By season:")
for r in underdog_pnl_by_season:
    sign = "+" if r["profit_usd"] >= 0 else ""
    print(f"     {r['Season']:<10} {sign}${r['profit_usd']:>8,.2f}  ROI {r['roi_pct']:>6}%  (n={r['bets']})")

# ---------------------------------------------------------------------------
# 4. Implied probability (from odds) vs actual results - calibration
# ---------------------------------------------------------------------------
inv = 1 / odds[["B365H", "B365D", "B365A"]]
overround = inv.sum(axis=1)
implied_home = inv["B365H"] / overround  # bookmaker margin removed

bins = np.arange(0, 1.01, 0.1)
odds["ImpliedHomeProb"] = implied_home
odds["ImpliedBucket"] = pd.cut(odds["ImpliedHomeProb"], bins, include_lowest=True)

calibration = []
for interval, g in odds.groupby("ImpliedBucket", observed=True):
    if len(g) == 0:
        continue
    calibration.append({
        "bucket_low": max(0.0, round(interval.left, 2)), "bucket_high": round(interval.right, 2),
        "matches": len(g),
        "avg_implied_home_win_pct": pct(g["ImpliedHomeProb"].sum(), len(g)),
        "actual_home_win_pct": pct((g["FTR"] == "H").sum(), len(g)),
    })
findings["odds_calibration"] = calibration
findings["odds_calibration_overall"] = {
    "avg_implied_home_win_pct": pct(implied_home.sum(), n_odds),
    "actual_home_win_pct": pct((odds["FTR"] == "H").sum(), n_odds),
}

print("\n4) Implied probability (from odds) vs actual home-win rate")
print(f"   Overall: implied {findings['odds_calibration_overall']['avg_implied_home_win_pct']}% vs actual {findings['odds_calibration_overall']['actual_home_win_pct']}%")
for c in calibration:
    print(f"   Implied {c['bucket_low']*100:.0f}-{c['bucket_high']*100:.0f}%: actual {c['actual_home_win_pct']}%  (n={c['matches']})")

# ---------------------------------------------------------------------------
# 4b. Favorite's implied probability vs actual win rate, in named ranges,
#     by league. (Different from section 4: this uses the FAVORITE's own
#     implied probability -- H, D, or A, whichever side is favored -- not
#     always the home team's.)
# ---------------------------------------------------------------------------
odds["FavoriteOdds"] = odds[["B365H", "B365D", "B365A"]].min(axis=1)
odds["ImpliedFavoriteProb"] = (1 / odds["FavoriteOdds"]) / overround

fav_bins = [0, 0.5, 0.6, 0.7, 0.8, 1.0]
fav_labels = ["under 50%", "50-60%", "60-70%", "70-80%", "80%+"]
odds["FavoriteBucket"] = pd.cut(odds["ImpliedFavoriteProb"], fav_bins, labels=fav_labels, include_lowest=True)


def favorite_calibration(group_cols):
    rows = []
    for key, g in odds.groupby(group_cols, observed=True):
        n = len(g)
        if n == 0:
            continue
        row = {"matches": n, "actual_favorite_win_pct": pct(g["FavoriteWon"].sum(), n)}
        if isinstance(group_cols, list):
            row.update(dict(zip(group_cols, key)))
        else:
            row[group_cols] = key
        rows.append(row)
    return rows

favorite_calibration_overall = favorite_calibration("FavoriteBucket")
favorite_calibration_by_league = favorite_calibration(["League", "FavoriteBucket"])

above_70 = odds[odds["ImpliedFavoriteProb"] >= 0.7]
findings["favorite_calibration_by_range"] = {
    "overall_by_range": favorite_calibration_overall,
    "by_league_and_range": favorite_calibration_by_league,
    "above_70pct_implied": {
        "matches": len(above_70),
        "actual_favorite_win_pct": pct(above_70["FavoriteWon"].sum(), len(above_70)),
    },
}

print("\n4b) Favorite's implied probability vs actual win rate, by range")
for r in favorite_calibration_overall:
    print(f"   {r['FavoriteBucket']:<10} actual win rate {r['actual_favorite_win_pct']}%  (n={r['matches']:,})")
print(f"   Above 70% implied: {findings['favorite_calibration_by_range']['above_70pct_implied']['actual_favorite_win_pct']}% actual win rate (n={len(above_70):,})")
print("   By league:")
for lg in sorted(odds["League"].unique()):
    rows = [r for r in favorite_calibration_by_league if r["League"] == lg]
    line = "  ".join(f"{r['FavoriteBucket']} {r['actual_favorite_win_pct']}% (n={r['matches']})" for r in rows)
    print(f"     {lg:<20} {line}")

# ---------------------------------------------------------------------------
# 5. Goals per game by league over time
# ---------------------------------------------------------------------------
df["TotalGoals"] = df["FTHG"] + df["FTAG"]
goals_rows = []
for (lg, season), g in df.groupby(["League", "Season"]):
    goals_rows.append({
        "League": lg, "Season": season, "matches": len(g),
        "avg_goals_per_game": round(g["TotalGoals"].mean(), 2),
    })
findings["goals_per_game_by_league_season"] = goals_rows

league_avg_goals = df.groupby("League")["TotalGoals"].mean().sort_values(ascending=False)
print("\n5) Goals per game by league (all seasons combined)")
for lg, v in league_avg_goals.items():
    print(f"   {lg:<20} {v:.2f}")

# ---------------------------------------------------------------------------
# 5b. Has the highest-scoring league's rate changed over the 20 seasons?
# ---------------------------------------------------------------------------
highest_scoring_league = league_avg_goals.index[0]
goals_by_season = [r for r in goals_rows if r["League"] == highest_scoring_league]
goals_by_season.sort(key=lambda r: r["Season"])

goal_rates = [r["avg_goals_per_game"] for r in goals_by_season]
goal_seasons = [r["Season"] for r in goals_by_season]
goal_slope = float(np.polyfit(range(len(goal_rates)), goal_rates, 1)[0])
goal_peak = max(goals_by_season, key=lambda r: r["avg_goals_per_game"])
goal_trough = min(goals_by_season, key=lambda r: r["avg_goals_per_game"])
goal_first5_avg = round(sum(goal_rates[:5]) / 5, 2)
goal_last5_avg = round(sum(goal_rates[-5:]) / 5, 2)

findings["highest_scoring_league_trend"] = {
    "league": highest_scoring_league,
    "overall_avg_goals_per_game": round(league_avg_goals.iloc[0], 2),
    "by_season": goals_by_season,
    "peak_season": goal_peak["Season"], "peak_avg_goals_per_game": goal_peak["avg_goals_per_game"],
    "trough_season": goal_trough["Season"], "trough_avg_goals_per_game": goal_trough["avg_goals_per_game"],
    "first_5_seasons_avg": goal_first5_avg,
    "last_5_seasons_avg": goal_last5_avg,
    "change_first5_to_last5": round(goal_last5_avg - goal_first5_avg, 2),
    "linear_trend_goals_per_game_per_season": round(goal_slope, 4),
}

print(f"\n5b) {highest_scoring_league} goals/game over {len(goal_seasons)} seasons (highest-scoring league overall)")
print(f"   Peak: {goal_peak['Season']} ({goal_peak['avg_goals_per_game']})  |  Trough: {goal_trough['Season']} ({goal_trough['avg_goals_per_game']})")
print(f"   First 5 seasons avg: {goal_first5_avg}  |  Last 5 seasons avg: {goal_last5_avg}  |  Linear trend: {goal_slope:.4f} goals/game per season")

# ---------------------------------------------------------------------------
# 5c. Most common final score, by league
# ---------------------------------------------------------------------------
df["Score"] = df["FTHG"].astype(str) + "-" + df["FTAG"].astype(str)

common_scores_by_league = []
for lg, g in df.groupby("League"):
    n = len(g)
    top3 = g["Score"].value_counts().head(3)
    common_scores_by_league.append({
        "League": lg, "matches": n,
        "most_common_score": top3.index[0], "most_common_count": int(top3.iloc[0]),
        "most_common_pct": pct(top3.iloc[0], n),
        "top_3": [{"score": s, "matches": int(c), "pct": pct(c, n)} for s, c in top3.items()],
    })
findings["most_common_score_by_league"] = common_scores_by_league

print("\n5c) Most common final score, by league")
for r in common_scores_by_league:
    top3_str = "  ".join(f"{t['score']} ({t['pct']}%)" for t in r["top_3"])
    print(f"   {r['League']:<20} {top3_str}")

# ---------------------------------------------------------------------------
# 6. Most predictable league / most upsets
# ---------------------------------------------------------------------------
eligible = [r for r in favorite_by_league if r["matches_with_odds"] >= MIN_LEAGUE_ODDS_MATCHES]
most_predictable = max(eligible, key=lambda r: r["favorite_win_pct"])
most_upsets = min(eligible, key=lambda r: r["favorite_win_pct"])
findings["predictability"] = {
    "most_predictable_league": most_predictable["League"],
    "most_predictable_favorite_win_pct": most_predictable["favorite_win_pct"],
    "most_upsets_league": most_upsets["League"],
    "most_upsets_favorite_win_pct": most_upsets["favorite_win_pct"],
    "most_upsets_upset_pct": round(100 - most_upsets["favorite_win_pct"], 1),
}
print("\n6) Predictability")
print(f"   Most predictable: {most_predictable['League']} (favorite wins {most_predictable['favorite_win_pct']}%)")
print(f"   Most upsets:      {most_upsets['League']} (favorite wins only {most_upsets['favorite_win_pct']}%, i.e. {findings['predictability']['most_upsets_upset_pct']}% upset rate)")

# ---------------------------------------------------------------------------
# 6b. Biggest individual upsets: the longest-odds winners in the dataset
# ---------------------------------------------------------------------------
# Restricted to decisive results (H or A) -- a draw has no "winner", so it
# isn't a winner-side upset in the sense asked here.
decisive = odds[odds["FTR"].isin(["H", "A"])].copy()
is_home_win = decisive["FTR"] == "H"
decisive["WinningTeam"] = np.where(is_home_win, decisive["HomeTeam"], decisive["AwayTeam"])
decisive["LosingTeam"] = np.where(is_home_win, decisive["AwayTeam"], decisive["HomeTeam"])
decisive["WinningOdds"] = np.where(is_home_win, decisive["B365H"], decisive["B365A"])
decisive["WinnerImpliedProbPct"] = round(100 / decisive["WinningOdds"], 1)

# Several matches share the exact same odds value; break ties by date (then
# team name) so the ranking is deterministic instead of depending on
# incidental row order.
upsets = decisive.sort_values(["WinningOdds", "Date", "WinningTeam"], ascending=[False, True, True]).head(20)
biggest_upsets = [{
    "Date": r["Date"].strftime("%Y-%m-%d"), "League": r["League"],
    "WinningTeam": r["WinningTeam"], "LosingTeam": r["LosingTeam"],
    "HomeTeam": r["HomeTeam"], "AwayTeam": r["AwayTeam"],
    "FTHG": int(r["FTHG"]), "FTAG": int(r["FTAG"]),
    "WinningOdds": round(r["WinningOdds"], 2), "WinnerImpliedProbPct": r["WinnerImpliedProbPct"],
} for _, r in upsets.iterrows()]
findings["biggest_upsets"] = biggest_upsets

print(f"\n6b) Biggest upsets (longest odds for the actual winner, decisive results only)")
for r in biggest_upsets[:10]:
    print(f"   {r['Date']}  {r['League']:<17} {r['WinningTeam']} beat {r['LosingTeam']}  "
          f"({r['HomeTeam']} {r['FTHG']}-{r['FTAG']} {r['AwayTeam']})  "
          f"odds {r['WinningOdds']} (implied {r['WinnerImpliedProbPct']}%)")

# ---------------------------------------------------------------------------
# 7. Biggest home vs away performance gap, by team
# ---------------------------------------------------------------------------
def points(ftr, win_code):
    return np.where(ftr == win_code, 3, np.where(ftr == "D", 1, 0))

teams = pd.unique(pd.concat([df["HomeTeam"], df["AwayTeam"]]))
team_rows = []
for team in teams:
    home = df[df["HomeTeam"] == team]
    away = df[df["AwayTeam"] == team]
    if len(home) < MIN_TEAM_MATCHES or len(away) < MIN_TEAM_MATCHES:
        continue
    home_ppg = points(home["FTR"], "H").mean()
    away_ppg = points(away["FTR"], "A").mean()
    team_rows.append({
        "Team": team,
        "home_matches": len(home), "away_matches": len(away),
        "home_ppg": round(home_ppg, 2), "away_ppg": round(away_ppg, 2),
        "gap": round(home_ppg - away_ppg, 2),
    })
team_rows.sort(key=lambda r: r["gap"], reverse=True)
findings["home_away_gap_by_team"] = {
    "min_matches_threshold": MIN_TEAM_MATCHES,
    "teams_qualifying": len(team_rows),
    "biggest_home_fortress": team_rows[:10],
    "biggest_away_specialists": list(reversed(team_rows[-10:])),
}
print(f"\n7) Home vs away gap by team (min {MIN_TEAM_MATCHES} home & away matches, {len(team_rows)} teams qualify)")
print("   Biggest home/away gap (stronger at home):")
for r in team_rows[:5]:
    print(f"     {r['Team']:<20} home {r['home_ppg']} ppg vs away {r['away_ppg']} ppg  (gap {r['gap']})")
print("   Smallest / most negative gap (relatively stronger away):")
for r in team_rows[-5:]:
    print(f"     {r['Team']:<20} home {r['home_ppg']} ppg vs away {r['away_ppg']} ppg  (gap {r['gap']})")

# ---------------------------------------------------------------------------
# 8. Half-time leads: do they hold up? How often do teams come back?
# ---------------------------------------------------------------------------
ht = df.dropna(subset=["HTR"]).copy()
n_ht = len(ht)
leading = ht[ht["HTR"] != "D"]
opposite = {"H": "A", "A": "H"}
held = (leading["FTR"] == leading["HTR"]).sum()
drawn_back = (leading["FTR"] == "D").sum()
comeback = sum(leading["FTR"] == leading["HTR"].map(opposite))
n_leading = len(leading)

level_ht = ht[ht["HTR"] == "D"]
n_level = len(level_ht)
level_outcome = {
    "home_win_pct": pct((level_ht["FTR"] == "H").sum(), n_level),
    "draw_pct": pct((level_ht["FTR"] == "D").sum(), n_level),
    "away_win_pct": pct((level_ht["FTR"] == "A").sum(), n_level),
}

findings["halftime_leads"] = {
    "matches_with_ht_data": n_ht,
    "matches_with_a_ht_leader": n_leading,
    "lead_held_pct": pct(held, n_leading),
    "lead_drawn_pct": pct(drawn_back, n_leading),
    "lead_reversed_pct": pct(comeback, n_leading),
    "level_at_half_time": {"matches": n_level, **level_outcome},
}
print(f"\n8) Half-time leads (matches with HT data: {n_ht:,}; a team led at HT in {n_leading:,})")
print(f"   Lead held: {findings['halftime_leads']['lead_held_pct']}%  |  Pulled back to draw: {findings['halftime_leads']['lead_drawn_pct']}%  |  Full comeback (lead reversed): {findings['halftime_leads']['lead_reversed_pct']}%")
print(f"   Level at half-time ({n_level:,} matches) finished: home {level_outcome['home_win_pct']}%, draw {level_outcome['draw_pct']}%, away {level_outcome['away_win_pct']}%")

# ---------------------------------------------------------------------------
# 8b. Half-time comebacks, by league: how often does the trailing team win?
# ---------------------------------------------------------------------------
leading = leading.copy()
leading["Comeback"] = ((leading["HTR"] == "H") & (leading["FTR"] == "A")) | \
                       ((leading["HTR"] == "A") & (leading["FTR"] == "H"))

comebacks_by_league = []
for lg, g in leading.groupby("League"):
    n = len(g)
    c = int(g["Comeback"].sum())
    comebacks_by_league.append({"League": lg, "matches_with_a_ht_leader": n, "comebacks": c, "comeback_pct": pct(c, n)})
comebacks_by_league.sort(key=lambda r: r["comeback_pct"], reverse=True)

most_by_rate = comebacks_by_league[0]
most_by_count = max(comebacks_by_league, key=lambda r: r["comebacks"])
findings["halftime_comebacks_by_league"] = {
    "most_comebacks_by_rate": most_by_rate["League"],
    "most_comebacks_by_raw_count": most_by_count["League"],
    "by_league": comebacks_by_league,
}

print(f"\n8b) Half-time comebacks by league (trailing team wins outright)")
for r in comebacks_by_league:
    print(f"   {r['League']:<20} {r['comebacks']:>4}/{r['matches_with_a_ht_leader']:<5} = {r['comeback_pct']}%")
print(f"   Most comebacks by rate:  {most_by_rate['League']} ({most_by_rate['comeback_pct']}%)")
print(f"   Most comebacks by count: {most_by_count['League']} ({most_by_count['comebacks']} comebacks)")

# ---------------------------------------------------------------------------
# 9. Shots on target vs winning, by league
# ---------------------------------------------------------------------------
st = df.dropna(subset=["HST", "AST"]).copy()
n_st = len(st)
st["ShotAdv"] = np.select(
    [st["HST"] > st["AST"], st["HST"] == st["AST"], st["HST"] < st["AST"]],
    ["home_more", "equal", "away_more"],
    default="equal",
)

def home_win_pct_by_adv(g):
    n = len(g)
    return pct((g["FTR"] == "H").sum(), n)

shots_overall = {adv: {"matches": len(g), "home_win_pct": home_win_pct_by_adv(g)}
                 for adv, g in st.groupby("ShotAdv")}

shots_by_league = []
for lg, g in st.groupby("League"):
    row = {"League": lg, "matches": len(g)}
    for adv, gg in g.groupby("ShotAdv"):
        row[f"home_win_pct_when_{adv}"] = home_win_pct_by_adv(gg)
        row[f"n_{adv}"] = len(gg)
    shots_by_league.append(row)

findings["shots_on_target_vs_win"] = {
    "matches_with_shot_data": n_st,
    "overall": shots_overall,
    "by_league": shots_by_league,
}
print(f"\n9) Shots on target vs winning (matches with shot data: {n_st:,})")
for adv, s in shots_overall.items():
    print(f"   {adv:<10} home win rate: {s['home_win_pct']}%  (n={s['matches']:,})")

# ---------------------------------------------------------------------------
# 10. Red cards: does the team that gets one still win?
# ---------------------------------------------------------------------------
rc = df.dropna(subset=["HR", "AR"]).copy()
n_rc = len(rc)
home_red_only = rc[(rc["HR"] >= 1) & (rc["AR"] == 0)]
away_red_only = rc[(rc["AR"] >= 1) & (rc["HR"] == 0)]

home_red_win_pct = pct((home_red_only["FTR"] == "H").sum(), len(home_red_only))
away_red_win_pct = pct((away_red_only["FTR"] == "A").sum(), len(away_red_only))
combined_n = len(home_red_only) + len(away_red_only)
combined_wins = (home_red_only["FTR"] == "H").sum() + (away_red_only["FTR"] == "A").sum()

no_red = rc[(rc["HR"] == 0) & (rc["AR"] == 0)]
baseline_home_win_pct = pct((no_red["FTR"] == "H").sum(), len(no_red))

findings["red_cards_vs_win"] = {
    "matches_with_card_data": n_rc,
    "home_team_sole_red_card": {"matches": len(home_red_only), "still_won_pct": home_red_win_pct},
    "away_team_sole_red_card": {"matches": len(away_red_only), "still_won_pct": away_red_win_pct},
    "either_team_sole_red_card_combined": {"matches": combined_n, "still_won_pct": pct(combined_wins, combined_n)},
    "no_red_card_baseline_home_win_pct": {"matches": len(no_red), "home_win_pct": baseline_home_win_pct},
}
print(f"\n10) Red cards (matches with card data: {n_rc:,})")
print(f"   Home team alone gets a red card ({len(home_red_only):,} matches): still wins {home_red_win_pct}%")
print(f"   Away team alone gets a red card ({len(away_red_only):,} matches): still wins {away_red_win_pct}%")
print(f"   Either team down to 10 men, still wins: {findings['red_cards_vs_win']['either_team_sole_red_card_combined']['still_won_pct']}%  (vs {baseline_home_win_pct}% home baseline with no cards)")

# ---------------------------------------------------------------------------
# Save
# ---------------------------------------------------------------------------
with open(OUT_PATH, "w") as f:
    json.dump(clean(findings), f, indent=2)

print("\n" + "=" * 70)
print(f"Saved all findings to {OUT_PATH}")
print("=" * 70)
