> EDITOR: Pin with the EXE in ECL HUB DESKTOP APP (5590769063605712). Reporting commands require the new backend/bot deployment and an enabled reporter profile. Do not present them as live before activation.

# ECL HUB DESKTOP APP — install and report

**Windows tester build: 1.0.1**
Download the attached **ECL-Hub-Setup-1.0.1.exe**. You only need the EXE.

**1. Install Hub**
Run the installer and follow setup. If League runs as administrator, leave
**Run ECL Hub as administrator when it starts** selected. Windows may ask for
administrator approval when you launch it.

**2. Sign in**
Use your existing ECL email and password. Your ECL profile must have the correct
Ionia Riot name/tag and be KOOK verified. If you still need verification, get
your code from your profile on https://eclchina.lol and send **!verify CODE**.

**3. Open League**
Keep Hub and League open on the same PC. Wait for Hub to show League connected.
Check that the detected League account matches your verified ECL profile.

**4. Connect reporting**
In **Collector**, choose **Connect reporting** and read the upload consent.
This allows the assigned match’s ten-player in-game identifiers and statistics
to be uploaded to ECL for administrator review.

Reporting is a pilot: your profile must be enabled by an administrator. If Hub
says reporting is not enabled or deployed, ask an admin; reinstalling will not
activate the server. Reconnect reporting after restarting Hub or changing accounts.

**5. Play your inhouse**
Use **!inhouse**, then **!ready** in KOOK. Follow the assigned blue/red sides.
All ten players need verified ECL profiles. One participating reporter needs Hub
connected with reporting enabled.

**6. Request the match**
After the game, the Hub reporter sends:

**!report IH_NUMBER GAME_ID**

Example: **!report 28 11363615233**

The first number is the IH session; the second is the actual League Game ID.
Use the ID of the completed match shown by League/Hub, not the IH number twice.
Keep Hub and League open while collection/upload runs.

**The person sending !report must have their own linked Hub connected.**
Having someone else’s Hub open does not send your request to their app.

**7. Check the result**
- **!status 28** — collection and review progress.
- **!no 28** — cancel your own unsubmitted collection request.
- **!hub** — installer location and setup help.

An uploaded match enters administrator review. **No !yes is needed, and no LP
is awarded automatically.** A local saved match or review receipt is not an
official ranked result.

**If something goes wrong**
- League not connected: check both apps are open and the administrator launch
  setting matches League.
- Request waiting: check your ECL login, League identity and **Connect reporting**.
- Wrong Game ID, roster or sides: check **!status IH_NUMBER** and ask an admin
  if the upload has already been received.
- Service temporarily unavailable: keep the apps open and check the retry queue.
  If it stays stuck, ask an admin with the IH number, Game ID and error message.

Never share passwords or League authentication tokens in KOOK.
