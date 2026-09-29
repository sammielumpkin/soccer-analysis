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
- **Data set:** European football match results, 10 leagues, 20 seasons (2005-06 onward). `data/matches.csv` has 78,676 rows and 28 columns (one row is one match). Raw download kept in `data/matches_raw.csv`.
- **Scripts** (`scripts/`): `download_data.py`, `check_requirements.py`, `clean_data.py`, `analysis.py` (writes `data/findings.json`), and `verify_findings.py` (recomputes the findings independently).
- **Report page** (`index.html`, `script.js`, `style.css`): title, byline, summary, headline-number block, 12 finding sections, and the closing "About the data" section. Every figure is read from `data/findings.json`.
- **Findings covered:** home advantage and its trend, team home/away gaps, favorites, odds calibration, underdog flat-betting P&L, goals per game, most common scores, half-time comebacks, shots on target, red cards, and biggest upsets.

### Still to do
- **`dashboard.html` and its script.** Nothing exists yet. It needs:
  - filters for 4+ variables, including season and team
  - 4+ summary numbers
  - 4+ charts with a measure switch and a breakdown switch
  - a table of the numbers behind the view
  - a reset button
  - It must load `data/matches.csv` in the browser.
- **Link the dashboard from the report nav bar,** and give both pages the same nav bar.
- **README.md:** list every file and what it does, and say where the data came from.
- **Publish:** enable GitHub Pages from `main`, then open the live URL and check that both pages load.
- **Submission file:** one .txt or .md with name, student ID, repo URL, and live site URL.
- **Cross-check:** dashboard numbers must match the report and the data when the filters are all cleared.

### Open issues
- **Untested in a browser:** the report has not been opened yet, so chart rendering and the `fetch` of `findings.json` are unchecked. `fetch` needs a web server, so test with a local server or on Pages, not by double-clicking the file.
- **Sparse columns:** shots, cards, and half-time fields are blank for many older or lower-tier matches, so those findings use fewer rows than the headline count. The methods section should say which rows each figure uses.
- **Odds:** corrupted 0.0 odds values caused a division by zero earlier, and `analysis.py` now guards against that. The dashboard needs the same guard.
- **Data size:** `matches.csv` is 8.4 MB, which may make the dashboard slow to load. Consider whether `matches_raw.csv` (10 MB) needs to stay in the repo.
- **Commit history:** the site files were untracked until now, so the history has no incremental commits for the report page. Commit the dashboard in small steps.
