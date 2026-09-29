Overview

You are an analyst tasked with building a public website around a data set you choose. The site has two pages.

The first page is a report that the reader scrolls through, with your findings, the numbers behind them, and a

chart for each. The second page is a dashboard that loads the data in the browser and lets the reader filter it,

switch between charts, and see the numbers change.

Projects are 50% of your course grade, and the project grades are averaged.

You will build the site in a public GitHub repository and publish it with GitHub Pages. You will turn in one text

file (.txt or .md) with four lines: your name, your student ID, the repository URL, and the live site URL.

The due date is posted on Blackboard. No late submissions are allowed.

The data

Choose any data set that interests you. It can be about anything: sports, music, movies, video games, weather,

traffic, elections, a business, a market. The HMDA mortgage data we use in class is not allowed. The data set

must meet the following requirements:

1\. The data must be panel data. The file has a time column (a year, a season, a month, a week, a date) and a

group column (a company, a team, a player, a country, a city, a store, a product), where the same groups

appear period after period. One row is one group in one period, for example one company in one year, one

player in one season, one team in one game, one store in one week. Alternatively, one row is one event,

such as a sale, a game, or an application, with the date it happened and the group it belongs to.

2\. The time column has at least five different periods (five years, five seasons, five months).

3\. The group column has at least ten different values.

4\. The data set has at least 50,000 rows and at least eight columns. Among the columns are at least two

categorical variables the reader can filter on and at least two numeric variables you can total, average, or

rank.

If you find a data set you really want to use and it does not meet one of the requirements, email me before you

start so I can approve it.

1

The report page

The report is index.html, the page that opens at the site URL. It holds the following:

1\. A title, your name, and a one‑paragraph summary of what the data covers and what you found.

2\. A block of at least four headline numbers, each with a label that says what it is.

3\. At least eight sections. Each section has a heading that states the finding, one or two paragraphs that

explain the finding and give the numbers behind it, and a chart of those numbers.

4\. A closing section that explains your data set: where the data comes from, what one row is, any rows you

drop and why, and how you compute every rate, ratio, or average you report.

The dashboard page

The dashboard is dashboard.html, linked from the report page. It loads the data, does calculations in the

browser, and holds the following:

1\. Filters for at least four variables, among them the time column and the group column.

2\. At least four summary numbers that change with the filters.

3\. At least four charts that change with the filters, with a switch that changes the measure shown (for example

a count, a total, a median, a rate) and a switch that changes the variable the chart is broken down by.

4\. A table that shows the numbers behind the current view.

5\. A button that resets every filter.

The site as a whole

• Both pages share one navigation bar and one set of fonts and colors. The look is up to you. Have fun with

it.

• I recommend building the site with plain HTML, CSS, and JavaScript, but you are free to use anything else.

The repository

The project lives in its own folder under your home folder, for example \~/stock-analysis, and that folder is

the repository. Do not build it inside the \~/fda-python course folder.

• Public, with GitHub Pages enabled from the main branch.

• A README.md that lists every file and what it does, and says where the data came from.

• The data files, any scripts, and the site files.

• A commit history that shows the work as it was done, not one commit holding the finished site.

Using AI tools

You are expected to build the site with Claude Code or Codex. The data set, the questions you ask of it, the

findings you report, the numbers, and the design are yours, and you are responsible for every number and every

file in the repository.

2

Grading

The project is graded out of 100 points.

Component Points

Report: findings, summaries, and charts 25

Report: numbers correct and reproducible from the data 20

Dashboard: filters, switches, and charts that work 25

Dashboard: numbers agree with the report and the data 10

Design and personalization 10

Repository: README, files, commit history 10

A page that works but whose numbers are wrong, or a page whose numbers are right but that does not work at

the site URL, earns zero credit for that component.

Academic integrity

The site is your own work. You may discuss data sets, tools, and publishing problems with classmates, but do

not share code or files.



## Progress

_Last updated 2026-09-29._

### Done
- **Data set:** European football match results, 10 leagues (top two divisions in England, France, Germany, Italy and Spain), 20 seasons (2005-06 to 2024-25). `data/matches.csv` has 78,676 rows and 27 columns (one row is one match). The raw download is kept in `data/matches_raw.csv`.
- **Scripts** (`scripts/`): `download_data.py`, `check_requirements.py`, `clean_data.py` (drops `Div`, trims stray spaces from team names, writes `data/cleaning_log.json`), `analysis.py` (writes `data/findings.json`, including the league overview and goals per game for every league), and `verify_findings.py` (recomputes the findings independently; 81 of 81 match).
- **Report page** (`index.html`, `script.js`): title, byline, one-paragraph summary that mentions every finding, 4 headline numbers, a leagues table, 10 finding sections, and the closing data and methods section. Every figure is read from `data/findings.json`. Each chart has a short title, axis titles where it has axes, direct value labels or a legend, and the same minus sign and precision as the text. The goals chart shows all 10 leagues with the Bundesliga highlighted. The closing section notes the trimmed team names, France's 2019-20 COVID cut (Ligue 1 279 and Ligue 2 280 of 380 matches), and the Ligue 2 fixtures missing from the source (32 in 2007-08, 1 in 2023-24).
- **Dashboard** (`dashboard.html`, `dashboard.js`): loads `data/matches.csv` in the browser.
  - Filters: season from/to, country, league, team, team plays home/away, result.
  - 6 summary numbers, 4 charts, a measure switch (9 measures), a breakdown switch (league, season, country), a sortable table, and a reset button.
  - With no filters, its first four numbers match the report (78,676 matches, 44.5% home wins, 27.6% draws, -8.9% underdog return).
- **Shared site code:** `charts.js` (formatters and SVG charts used by both pages) and `style.css` (soccer theme, light and dark colors, animations that turn off for reduced motion). Both pages have the same nav bar.
- **README.md:** lists every file and what it does, and links to football-data.co.uk as the data source.
- **Repository:** public at github.com/sammielumpkin/soccer-analysis, incremental commit history, GitHub Pages built from `main` at https://sammielumpkin.github.io/soccer-analysis/.

### Still to do
- **Submission file:** one .txt or .md with four lines: name, student ID, repository URL, live site URL. Keep it out of the public repo.
- **Optional:** read the live pages once end to end; check dark mode and a phone by eye.

### Open issues
- **Dark mode is untested** in a browser, and animations were only seen as still screenshots.
- **Phone layout:** neither page overflows sideways at 390px, but it has not been checked on a real phone.
- **Sparse columns:** shots, cards and half-time fields are blank for many older or lower-tier matches, so those findings use fewer rows than the headline count. The report's methods section gives the row counts.
- **Odds:** 2 matches have an odd of 1.0 or below and 123 have no odds. They are left out of the odds-based numbers, in both `analysis.py` and the dashboard.
- **Data size:** `data/matches.csv` is 8.2 MB, so the dashboard takes a moment to load.
- **Editing files on Windows:** write text files as UTF-8 explicitly (`encoding="utf-8"`), or a dash can be saved as an invalid byte.
