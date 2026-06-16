# 🧭 ECL ORIGINAL ROADMAP (SOURCE OF TRUTH)

---

# 🏗️ 1. CORE VISION

ECL is a **competitive gaming ecosystem**, not a website.

It consists of 3 connected systems:

```txt id="core"
KOOK BOT → INHOUSE SYSTEM → MATCH DATA → HUB → PLAYER PROFILES → ELO → AWARDS
```

Everything must feed into player progression.

---

# 🌐 2. PUBLIC WEBSITE (DONE / STABLE)

Purpose: information + tournaments + visibility

Pages:

* Home (hero, next match, highlights)
* Teams
* Schedule
* Standings
* Results
* Format
* Rules
* Contact
* Tournament Archives (Winter Cup, Split One, etc.)

✔ This is mostly complete and should NOT be disrupted.

---

# 🧠 3. HUB (MAIN PRODUCT)

The Hub is the **player intelligence system**

Pages inside Hub:

* Dashboard (overview)
* My Profile
* Ranked Ladder
* Players directory
* Champions stats
* Inhouses system
* Weekly Awards
* Search engine (ECL.gg)

---

## HUB PURPOSE

```txt id="hub"
FACEIT + Tracker.gg + Sports Analytics Dashboard style system
```

NOT a website page.

---

## HUB RULES

* Sidebar navigation required
* Card-based UI only
* Compact layout
* NO long scrolling pages
* NO equal-weight sections
* ALWAYS show hierarchy (Top 3 players featured)
* MUST use visuals (avatars, icons, rank badges, champions)

---

# 🤖 4. KOOK BOT (OPERATION LAYER)

KOOK is the **control system**

Commands:

* `!signup`
* `!inhouse`
* `!top / !jungle / !mid / !adc / !support / !fill`
* Queue system
* Auto team balancing (ELO-based)
* Voice channel assignment
* Match creation
* `!report`

---

## KOOK ROLE

```txt id="kook"
KOOK = live operations layer
Website = public layer
Hub = intelligence layer
```

---

# 🎮 5. INHOUSE SYSTEM (CORE GAME LOOP)

Flow:

```txt id="flow"
!inhouse
↓
Players join queue by role
↓
Bot tracks 10 players
↓
Bot pulls ELO
↓
Balances teams
↓
Assigns Red / Blue
↓
Assigns captains
↓
Moves players into voice channels
↓
Game played
↓
!report
↓
Stats updated
↓
ELO updated
↓
Hub updated
```

---

# 📊 6. PLAYER SYSTEM (DATA MODEL)

Each player stores:

* Riot ID
* KOOK ID
* ELO
* Rank tier
* Match history
* Champion pool
* Win/Loss record
* MVP count
* Awards
* Inhouse participation history

---

# 🏆 7. MATCH SYSTEM

Each match includes:

* Teams
* Players
* Roles
* Result
* KDA
* Damage
* Vision
* Gold
* Objectives
* MVP/SVP
* ELO changes

---

# 🔍 8. SEARCH ENGINE (ECL.GG)

Must support:

* Player search (Riot ID)
* Player profiles
* Match history
* Champion stats
* Inhouse performance lookup

---

# ⚠️ 9. SYSTEM RULES

## DO NOT:

* Merge Hub + Website
* Treat everything as one UI system
* Build UI without hierarchy
* Create flat dashboards
* Ignore KOOK → HUB connection

## ALWAYS:

* KOOK drives inhouses
* Matches generate data
* Data updates Hub automatically
* Hub reflects real player progression

---

# 🚀 10. FINAL VISION

```txt id="final"
KOOK BOT = control system
INHOUSE SYSTEM = gameplay engine
HUB = analytics + identity layer
WEBSITE = public front door
```

---

# 🔥 ONE LINE SUMMARY (FOR CODEX)

```txt id="summary"
Build ECL as a connected ecosystem where KOOK runs inhouses, matches generate structured data, and the HUB visualises player progression through ELO, champions, stats, and awards in a Faceit-style analytics dashboard.
```
