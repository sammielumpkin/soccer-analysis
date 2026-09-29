import pandas as pd

df = pd.read_csv("data/matches_raw.csv")
print("Rows:", len(df))
print("Columns:", df.shape[1])
print("Seasons:", df["Season"].nunique())
print("Teams:", df["HomeTeam"].nunique())
print("\nMissing values per column:")
print(df.isna().sum())