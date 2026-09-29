"""Clean data/matches_raw.csv and save the trimmed result to data/matches.csv.

Steps:
1. Parse the Date column (mixed dd/mm/yy and dd/mm/yyyy formats) into real dates.
2. Drop rows with a missing or unparseable date, or a missing final score
   (FTHG/FTAG) -- a match with no final score is not a usable observation.
3. Store whole-number columns (goals, shots, corners, cards) as nullable
   integers instead of floats, so the CSV doesn't carry a ".0" on every
   value. This keeps data/matches.csv small enough for the dashboard to
   fetch and parse quickly in the browser.
4. Drop the Div column (the football-data.co.uk division code, e.g. "E0").
   The League and Country columns carry the same information in words.
5. Strip stray leading/trailing spaces from team names. "Kaiserslautern " and
   "Piacenza " appear in the raw file next to "Kaiserslautern" and "Piacenza"
   in the same season, which made the league table count one club twice.
   Name changes are logged in data/cleaning_log.json.
6. Write data/cleaning_log.json with the row counts, so analysis.py can
   report them in data/findings.json.
"""
import json
import os
import pandas as pd

RAW_PATH = "data/matches_raw.csv"
OUT_PATH = "data/matches.csv"

# Columns that are always whole numbers when present (goals, shots, cards, etc.)
INT_COLS = ["FTHG", "FTAG", "HTHG", "HTAG", "HS", "AS", "HST", "AST",
            "HC", "AC", "HF", "AF", "HY", "AY", "HR", "AR"]

df = pd.read_csv(RAW_PATH)
start_rows = len(df)

# --- Parse dates (file mixes dd/mm/yy and dd/mm/yyyy) ---
df["Date"] = pd.to_datetime(df["Date"], dayfirst=True, format="mixed", errors="coerce")
missing_date = df["Date"].isna()
n_missing_date = int(missing_date.sum())

# --- Drop rows with a missing final score ---
missing_score = df["FTHG"].isna() | df["FTAG"].isna()
n_missing_score = int((missing_score & ~missing_date).sum())

drop_mask = missing_date | missing_score
kept = df.loc[~drop_mask].copy()
kept = kept.drop(columns=["Div"])

# --- Standardize team names: trim stray whitespace ---
renamed = {}
for col in ["HomeTeam", "AwayTeam"]:
    trimmed = kept[col].str.strip()
    for old in sorted(set(kept.loc[kept[col] != trimmed, col])):
        renamed[old] = old.strip()
    kept[col] = trimmed

# --- Compact number formatting: whole-number stat columns as nullable Int64 ---
for col in INT_COLS:
    if col in kept.columns:
        kept[col] = kept[col].round().astype("Int64")

# Round betting odds to 2 decimals (source data is already ~2dp; this just
# guards against float noise inflating the file).
for col in ["B365H", "B365D", "B365A"]:
    if col in kept.columns:
        kept[col] = kept[col].round(2)

kept["Date"] = kept["Date"].dt.strftime("%Y-%m-%d")
kept = kept.sort_values("Date").reset_index(drop=True)

os.makedirs("data", exist_ok=True)
kept.to_csv(OUT_PATH, index=False)

raw_size = os.path.getsize(RAW_PATH)
out_size = os.path.getsize(OUT_PATH)
end_rows = len(kept)

with open("data/cleaning_log.json", "w") as f:
    json.dump({
        "raw_rows": start_rows,
        "dropped_unparseable_date": n_missing_date,
        "dropped_missing_score": n_missing_score,
        "rows_kept": end_rows,
        "team_names_trimmed": {repr(k): v for k, v in renamed.items()},
    }, f, indent=2)

print(f"Start rows:              {start_rows:,}")
print(f"Dropped - unparseable date: {n_missing_date:,}")
print(f"Dropped - missing score:    {n_missing_score:,}")
print(f"Rows kept:                {end_rows:,}")
print(f"Team names trimmed:      {list(renamed.values())}")
print(f"\n{RAW_PATH}: {raw_size / 1_000_000:.2f} MB")
print(f"{OUT_PATH}: {out_size / 1_000_000:.2f} MB")
