"""Download match data from football-data.co.uk and combine it into one file."""
import pandas as pd

BASE = "https://www.football-data.co.uk/mmz4281/{season}/{code}.csv"

LEAGUES = {
    "E0": ("England", "Premier League"),
    "E1": ("England", "Championship"),
    "SP1": ("Spain", "La Liga"),
    "SP2": ("Spain", "Segunda Division"),
    "D1": ("Germany", "Bundesliga"),
    "D2": ("Germany", "2. Bundesliga"),
    "I1": ("Italy", "Serie A"),
    "I2": ("Italy", "Serie B"),
    "F1": ("France", "Ligue 1"),
    "F2": ("France", "Ligue 2"),
}

# Season codes like "0506" for 2005-06, through "2425" for 2024-25
SEASONS = [f"{y % 100:02d}{(y + 1) % 100:02d}" for y in range(2005, 2025)]

KEEP = ["Div", "Date", "HomeTeam", "AwayTeam", "FTHG", "FTAG", "FTR",
        "HTHG", "HTAG", "HTR", "HS", "AS", "HST", "AST", "HC", "AC",
        "HF", "AF", "HY", "AY", "HR", "AR", "B365H", "B365D", "B365A"]

frames = []
for season in SEASONS:
    for code, (country, league) in LEAGUES.items():
        url = BASE.format(season=season, code=code)
        try:
            df = pd.read_csv(url, encoding="latin-1", on_bad_lines="skip")
        except Exception as e:
            print(f"Skipped {code} {season}: {e}")
            continue
        df = df[[c for c in KEEP if c in df.columns]].dropna(subset=["HomeTeam"])
        df["Season"] = f"20{season[:2]}-{season[2:]}"
        df["Country"] = country
        df["League"] = league
        frames.append(df)
        print(f"{code} {season}: {len(df)} matches")

matches = pd.concat(frames, ignore_index=True)
matches.to_csv("data/matches_raw.csv", index=False)
print(f"\nSaved {len(matches):,} rows to data/matches_raw.csv")