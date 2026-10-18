> EDITOR: Upcoming-release draft. Publish as a preview until deployment and season activation are verified. Patch 2.2 is the community update number, not the installer version.

# ECL Patch 2.2 — ECL Hub and a fresh ranked season

Patch 2.2 brings the ECL Hub desktop app, a fresh ranked ladder and a clearer
KOOK reporting flow. Everyone will begin the next season at **800 LP**, with
prizes for the top three players when the ladder ends on **14 January 2027**.

The season start and reporting activation will be announced in KOOK. This
preview does not mark the beginning of the new ladder.

## ECL Hub for Windows

ECL Hub puts your ECL profile, ranked ladder, inhouse history and saved League
history in a native desktop app, with English and Chinese support.

- Sign in with your existing ECL account.
- View match scoreboards with team statistics, damage bars and recorded
  MVP/SVP awards where available.
- Check saved League ranks and champion snapshots, with source/update labels.
- Collect completed matches locally, with retries when the League connection
  or match service is unavailable.
- Connect reporting separately to upload an assigned inhouse for administrator
  review when your reporter profile is enabled.

The Windows installer will be pinned in **ECL HUB DESKTOP APP** on KOOK.
There is no separate website installer download for this rollout.

If League runs as administrator, keep the installer's administrator launch
option selected so Hub can connect. Windows may ask you to approve the launch.

## Ranked reset

The next season starts everyone at **800 LP**. Season wins, losses and streaks
restart from zero. **Old match history stays available.**

The opening three-game placement bonus is removed. Normal scoring applies from
game one, including ordinary win/loss streaks. There is no opening +65 LP win
bonus or placement-loss protection.

| Normal result, before streaks and other modifiers | LP |
| --- | ---: |
| Win | +29 |
| Win with MVP | +33 |
| Loss | -18 |
| Loss with SVP | -15 |

The remaining LP rules stay in place:

- **Winning streaks:** consecutive wins 3–5 give +44 each, or +48 with MVP.
  Win 6 onward gives +59, or +63 with MVP, before other modifiers.
- **Losing streaks:** the third consecutive loss is -20, the fourth -22,
  increasing by 2 for each further consecutive loss. SVP reduces the loss by 3.
- **Thursday/Friday bonus:** the first ranked game of the day has doubled
  winning LP if it is a win, using China time. A first-game loss uses that
  day's opportunity; a later win is not doubled.
- **Higher ratings:** above 1400 effective LP, wins lose 1 LP per complete
  25 above 1400, and losses increase by 1 per complete 35 above 1400.
- **Inactivity:** after seven inactive China calendar days, decay is 10 LP per
  additional day and stops at 600. Match losses can still take LP below 600.
  Old-season inactivity does not carry into a fresh zero-game record.

For example, three opening wins without MVP or other modifiers give:
**800 → 829 → 858 → 902 LP**. The third win earns the normal streak bonus.

## KOOK and Hub reporting

The new flow keeps KOOK for organising the game and uses the participating
reporter's Hub to collect the match:

**!inhouse → !ready → play → !report IH_NUMBER GAME_ID → Hub upload → admin review**

All ten players need verified, active ECL profiles with matching Ionia Riot IDs.
At least one participant must have Hub installed and connected, with reporting
enabled. **The person sending !report must be that reporter.**

- **!hub:** installer location and setup instructions.
- **!status IH_NUMBER:** collection and review progress for that game.
- **!no IH_NUMBER:** cancel your own unsubmitted report request.
- **!cancel IH_NUMBER:** administrator cancellation of a specific inhouse.
- **!inhouse** and **!report** include Hub reminders. An unclaimed request gets
  a one-time waiting reminder while the bot remains running.
- App reports no longer use **!yes** to submit a result.

Local collection, an uploaded match and an official ranked result are separate
states. **Uploading or marking an upload reviewed does not automatically award
LP or create an official ranked result.** The reporting rollout begins with
enabled pilot reporters and administrator review.

## Ladder finish and prizes

The ranked ladder ends **14 January 2027**. The exact closing time, season
start and final standings/eligibility details will be announced in KOOK before
the season begins.

| Final place | Prize |
| --- | --- |
| 1st | Signed Faker merchandise or other pro-player merchandise, subject to availability |
| 2nd | 300 RMB |
| 3rd | 150 RMB |

That is **450 RMB in cash prizes, plus the first-place merchandise prize**.
Watch KOOK for the start notice, install Hub and get your account ready.
