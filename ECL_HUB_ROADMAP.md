# ECL HUB ROADMAP

## Source

This Hub direction is based on the provided Figma dashboard structure:

`ComzX - Sales Analytics Dashboard.fig`

The Figma is a business analytics dashboard layout. ECL Hub should translate that structure into a competitive gaming analytics product.

---

# 1. Product Separation

ECL has two distinct product surfaces.

## Main Website

Purpose:

```txt
ECL Brand
Tournaments
Announcements
News
Results
Archives
```

Visual identity:

```txt
Black
Red
White
```

Reference feel:

```txt
LCS
LEC
Esports Broadcast
```

The main website is the public league face. It should keep the ECL brand identity and should not be disrupted by Hub redesign work.

## ECL Hub

Purpose:

```txt
Player Profiles
ELO
Analytics
Champions
Search
Inhouses
Awards
```

Reference feel:

```txt
Faceit
Tracker.gg
Blitz
OP.GG
Discord
Linear
```

The Hub is a software product: the player operating system of ECL.

---

# 2. Core Layout

The Hub must follow this dashboard structure:

```txt id="layout"
LEFT SIDEBAR
MAIN DASHBOARD AREA
RIGHT INSIGHT PANEL
```

This structure is non-negotiable.

Do not design Hub pages like public website pages. Do not use hero sections. Do not create long scrolling marketing layouts.

---

# 3. Hub Visual System

## Preferred Palette

Use:

```txt
Graphite
Slate
Gunmetal
Silver
White
```

Ranking accents:

```txt
Gold
Silver
Bronze
```

ECL red is allowed only as an accent:

```txt
Active navigation item
Primary buttons
Important actions
Notifications
Alerts
Rank movement indicators
```

Do not make the Hub predominantly red.

## Desired Feel

The Hub should feel like:

```txt
Premium
Professional
Dense
Analytical
Interactive
Sports data platform
```

It should not feel like:

```txt
Tournament website
Landing page
Admin panel
Database table dump
```

---

# 4. Dashboard Home Structure

## Top KPI Row

Translate Figma sales KPI cards into compact ECL stat cards:

```txt id="kpi"
ELO / Current Rating
Rank Tier
Win Rate %
Games Played
MVP Count
```

These must be compact stat cards with clear hierarchy.

## Main Feature Section

The primary visual focus is:

```txt id="top3"
Top 3 Ladder
```

Cards:

```txt
#1 Player hero card
#2 Player card
#3 Player card
```

Each card must include:

```txt
Avatar or champion splash
ELO number
Rank badge
Win rate
Main champions
Recent form
```

## Analytics Section

Translate Figma chart areas into ECL performance analytics:

```txt id="charts"
Win Rate Over Time
ELO Progression Graph
KDA Trend
Champion Performance Breakdown
```

Use charts, not tables:

```txt
Line charts
Radial charts
Bar charts
Compact trend widgets
```

## Data Table Section

Translate Figma transaction/data table into:

```txt id="table"
Recent Matches
```

Columns:

```txt
Player
Champion
KDA
Result
ELO Change
MVP/SVP Tag
```

This is the match feed.

## Right Insight Panel

Use the right panel for live and weekly widgets:

```txt id="rightpanel"
Live Inhouse Queue
Weekly MVP
Most Kills This Week
Fastest Climb
Recent Awards
```

This panel should feel always-updating, not static.

---

# 5. Sidebar Navigation

The Hub sidebar is permanent. It should not change between pages.

```txt id="sidebar"
Dashboard
My Profile
Ranked Ladder
Players
Champions
Inhouses
Weekly Awards
Match History
Search Engine
Settings
```

The active item may use ECL red as an accent.

---

# 6. Hub UI Rules

## Must

* Use left sidebar navigation.
* Use card-based layouts.
* Use compact dashboard density.
* Use clear hierarchy: stats → feature → analytics → table.
* Feature Top 3 ladder prominently.
* Include player avatars.
* Include champion icons or splash art.
* Include rank badges.
* Use charts for analytics.
* Keep the Hub visually separate from the main website.

## Must Not

* Build long scrolling pages.
* Use empty hero sections.
* Create equal-weight sections.
* Make the Hub predominantly red.
* Make Hub pages look like admin pages.
* Make Hub pages look like database views.
* Merge Hub and website logic or visual language.

---

# 7. Final Codex Prompt

```txt id="finalprompt"
Rebuild ECL Hub using the provided dashboard Figma as the strict layout source.

Do not reinterpret layout.

Map components as follows:

- KPI cards → ELO, Rank, Win Rate, Games Played
- Main highlight panel → Top 3 Ladder (player cards)
- Charts → ELO progression, win rate, KDA, champion stats
- Table → recent matches feed
- Sidebar → navigation for Hub sections
- Optional right panel → live inhouse + weekly stats

Rules:
- Must remain a dashboard layout, not a website page
- Must be card-based
- Must preserve hierarchy: stats → feature → analytics → table
- Must feel like a sports analytics system: Faceit / Tracker.gg style
- Main website and Hub are separate products
- Hub palette should be graphite, slate, gunmetal, silver, and white
- Use ECL red only as an accent for active items, buttons, alerts, and important actions
```
