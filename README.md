# European Football by the Numbers

A two-page website about 78,676 professional football matches from 10 European leagues across 20 seasons (2005-06 to 2024-25), by Samantha Lumpkin.

- **Report** (`index.html`): 10 findings, each with the numbers behind it and a chart, plus a section explaining the data and how every figure is computed.
- **Dashboard** (`dashboard.html`): loads the match data in the browser and lets you filter by season, country, league, team and result, switch the measure and the breakdown, and see the charts, summary numbers and table change.

Both pages are plain HTML, CSS and JavaScript with no build step, and share one nav bar and one stylesheet.

## Where the data comes from

All match data comes from **[football-data.co.uk](https://www.football-data.co.uk/)**, which publishes one results file per league per season. `scripts/download_data.py` downloads those files directly from the site and combines them:

- **Leagues (10):** Premier League and Championship (England), La Liga and Segunda Division (Spain), Bundesliga and 2. Bundesliga (Germany), Serie A and Serie B (Italy), Ligue 1 and Ligue 2 (France).
- **Seasons (20):** 2005-06 through 2024-25.
- **One row is one match:** the two teams, the date, league and season, half-time and full-time scores, and, where the source records them, shots, shots on target, corners, fouls, cards and the pre-match Bet365 home/draw/away decimal odds.

Some statistics are only recorded for some leagues and seasons, so those columns are blank for many matches. The report says which matches each figure uses.

## Files

### Site

| File | What it does |
| --- | --- |
| `index.html` | The report page, and the page that opens at the site URL. Holds the title, summary, headline numbers, 10 finding sections and the data/methods section. `script.js` fills in the text and charts. |
| `dashboard.html` | The dashboard page: filters, summary numbers, switches, four charts, the table and the reset button. `dashboard.js` fills it in. |
| `style.css` | The one stylesheet both pages share: soccer theme (pitch background, colors, fonts, animations), nav bar, layout, chart colors and dashboard controls. |
| `charts.js` | Shared code for both pages: number formatters and the functions that draw the SVG charts (horizontal bars, stacked bars, vertical bars, lines). |
| `script.js` | Report logic. Loads `data/findings.json` and writes every number, sentence and chart on `index.html`. No number on the report is typed by hand. |
| `dashboard.js` | Dashboard logic. Loads `data/matches.csv`, applies the filters, computes every measure in the browser, and draws the charts and table. The current view is kept in the URL so it can be shared. |

### Data

| File | What it is |
| --- | --- |
| `data/matches_raw.csv` | The combined download from football-data.co.uk, exactly as `download_data.py` saved it (78,676 rows, 28 columns). |
| `data/matches.csv` | The cleaned file the dashboard reads and `analysis.py` analyzes (78,676 rows, 27 columns). Dates are ISO format, whole-number columns are integers, and the `Div` column is removed because `League` and `Country` carry the same information. |
| `data/cleaning_log.json` | Row counts from the cleaning step: raw rows, rows dropped for a bad date, rows dropped for a missing score, rows kept. Written by `clean_data.py`, read by `analysis.py`. |
| `data/findings.json` | Every number in the report, computed by `analysis.py`. `script.js` reads this file to build the report. |

### Scripts

Run these from the repository root, in this order, to rebuild the data from scratch.

| File | What it does |
| --- | --- |
| `scripts/download_data.py` | Downloads the 10 leagues x 20 seasons of results from football-data.co.uk and saves them as `data/matches_raw.csv`. |
| `scripts/check_requirements.py` | Prints the row count, column count, number of seasons, number of teams and missing values per column, to confirm the data meets the project requirements. |
| `scripts/clean_data.py` | Turns `matches_raw.csv` into `matches.csv`: parses the mixed date formats, drops rows with no valid date or final score (none were found), stores whole-number columns as integers, drops `Div`, and writes `cleaning_log.json`. |
| `scripts/analysis.py` | Computes every finding (home advantage, favorites, odds calibration, underdog bets, goals, scores, half-time swings, shots, red cards, upsets) and saves them to `data/findings.json`. |
| `scripts/verify_findings.py` | Recomputes the headline findings from `matches.csv` using different pandas techniques than `analysis.py` and checks that they match `findings.json`. |

### Project

| File | What it does |
| --- | --- |
| `README.md` | This file. |
| `CLAUDE.md` | The project instructions and a progress log for working on the site with Claude Code. |

## Rebuild and run locally

```
pip install pandas numpy
python scripts/download_data.py
python scripts/clean_data.py
python scripts/analysis.py
python scripts/verify_findings.py
python -m http.server
```

Then open <http://localhost:8000>. The pages load their data with `fetch`, which browsers block for files opened straight from disk, so use the local server rather than double-clicking the HTML files.

## How the numbers are defined

The report's last section spells out every rate, ratio and average. The dashboard's "How each measure is computed" list uses the same definitions. With every filter reset, the dashboard's first four summary numbers match the report's four headline numbers (78,676 matches, 44.5% home wins, 27.6% draws, and a -8.9% return on betting the underdog).
