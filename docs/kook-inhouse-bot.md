# KOOK Ranked Inhouse Bot

The web app now exposes the inhouse balancing brain at:

```txt
POST /api/kook/inhouse
```

The KOOK bot should call it with the same shared secret header used by the other KOOK endpoints:

```txt
x-ecl-kook-secret: <ECL_KOOK_BOT_SECRET>
```

## General Commands

For general text commands, the KOOK bot can call:

```txt
POST /api/kook/commands
```

Body:

```json
{
  "command": "!me",
  "kookUserId": "kook-user-id"
}
```

Supported commands:

```txt
!welcome     Returns the bilingual ECL welcome/onboarding message.
!help        Lists all player commands.
!verify      Explains where to find the verification code and how to use it.
!me          Shows whether the user is verified and their ECL profile summary.
!rank        Shows the user's ECL leaderboard rank.
!leaderboard Shows the ECL top 10.
!status      Shows active inhouse status, or current queue count if voice members are included.
!cancel      Admin only. Cancels the active saved inhouse session.
```

For admin-only commands, the KOOK bot should verify the user's KOOK role first,
then include `"isAdmin": true` in the request body.

Actual code confirmation still uses the existing verification endpoint:

```txt
POST /api/kook/verify
```

Body:

```json
{
  "code": "AB12CD",
  "kookUserId": "kook-user-id",
  "kookUsername": "KOOK display name"
}
```

## Welcome Message

Use this when someone joins KOOK, or when someone types `!welcome`:

```txt
Welcome to the Expat China League (ECL)
欢迎来到 Expat China League（ECL）

We're a League of Legends community in China, active since 2016 - mixing expats and local players.
我们是一个在中国活跃的英雄联盟社区，成立于2016年，汇聚来自世界各地的玩家与中国本地玩家。

━━━━━━━━━━━━━━━

Start here / 新手指南:
- Jump into any channel
- DM an admin if you need help
- Check the guide if you're new to CN servers

- 可以加入任意频道交流
- 有问题可以私信管理员
- 新玩家请查看新手指南

━━━━━━━━━━━━━━━

Want to play? / 想参加比赛？

Find a team, sign up as a free agent, or verify your account for ranked inhouses:
寻找队伍、以自由人身份报名，或验证账号参加排位内战：

https://eclchina.lol

To play ranked inhouses, create/log in to your ECL account, open your Hub/profile, copy your KOOK verification code, then type:
如果想参加排位内战，请登录 ECL 账号，进入 Hub / 个人资料页面，复制 KOOK 验证码，然后输入：

!verify YOURCODE
```

## Channel IDs

```txt
Ranked Inhouse category: 8024346698320304
Ranked IH #1 voice:     4175549527235352
Blue Side:              3522831675586808
Red Side:               9801310073341652
```

These can be overridden with:

```txt
KOOK_RANKED_INHOUSE_CATEGORY_ID
KOOK_RANKED_INHOUSE_CHANNEL_ID
KOOK_BLUE_SIDE_CHANNEL_ID
KOOK_RED_SIDE_CHANNEL_ID
```

## Command Flow

For `!inhouse`, the KOOK bot sends the current Ranked IH 1 voice members:

```json
{
  "command": "!inhouse",
  "channelId": "4175549527235352",
  "members": [
    { "id": "kook-user-id-1", "username": "Player 1" }
  ]
}
```

Responses:

```txt
WAITING           Fewer than 10 users are in the voice channel.
TOO_MANY_PLAYERS  More than 10 users are in the voice channel.
UNVERIFIED_PLAYERS One or more KOOK users are not linked to verified ECL profiles.
READY_CHECK       Exactly 10 verified users are present. Bot should post the roster and ask for !ready.
```

For `!ready`, send the same body with `"command": "!ready"`.

The response includes:

```txt
blueTeam
redTeam
session
moveInstructions
```

The KOOK bot should move every `moveInstructions[].kookUserId` to the matching
`targetChannelId`.

## Report Flow

After the game, any player from that inhouse can type `!report`.

The KOOK bot should call:

```txt
POST /api/kook/inhouse/report
```

Body:

```json
{
  "command": "!report",
  "reporterKookUserId": "kook-user-id"
}
```

The site will:

```txt
1. Find the most recent active inhouse session containing that KOOK user.
2. Look up the reporter's verified ECL profile.
3. Fetch the reporter's latest Lzyumi match.
4. Compare that match against the 10 players saved from !ready.
5. Ingest the match only if the latest game matches the inhouse lobby.
6. Apply LP changes and mark the inhouse session completed.
```

Responses:

```txt
INGESTED            Match was accepted and LP was applied.
NO_ACTIVE_SESSION   Reporter was not found in an active saved inhouse.
NO_LATEST_MATCH     Lzyumi has not exposed the latest match yet.
MATCH_NOT_CONFIRMED Latest Lzyumi game did not match enough inhouse players.
ALREADY_REPORTED    That Lzyumi game was already ingested.
```

## ELO Source

The endpoint resolves each KOOK ID to a verified active `AccountProfile`, then
matches that profile to the `Player` table by Riot ID or email. If no `Player`
row exists yet, the player is still allowed and uses the starting ELO of 800.
