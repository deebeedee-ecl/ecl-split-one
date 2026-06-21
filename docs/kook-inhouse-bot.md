# KOOK Ranked Inhouse Bot

The web app now exposes the inhouse balancing brain at:

```txt
POST /api/kook/inhouse
```

The KOOK bot should call it with the same shared secret header used by the other KOOK endpoints:

```txt
x-ecl-kook-secret: <ECL_KOOK_BOT_SECRET>
```

## Channel IDs

```txt
Ranked IH:   8024346698320304
Blue Side:   3522831675586808
Red Side:    9801310073341652
```

These can be overridden with:

```txt
KOOK_RANKED_INHOUSE_CHANNEL_ID
KOOK_BLUE_SIDE_CHANNEL_ID
KOOK_RED_SIDE_CHANNEL_ID
```

## Command Flow

For `!inhouse`, the KOOK bot sends the current Ranked IH 1 voice members:

```json
{
  "command": "!inhouse",
  "channelId": "8024346698320304",
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
moveInstructions
```

The KOOK bot should move every `moveInstructions[].kookUserId` to the matching
`targetChannelId`.

## ELO Source

The endpoint resolves each KOOK ID to a verified active `AccountProfile`, then
matches that profile to the `Player` table by Riot ID or email. If no `Player`
row exists yet, the player is still allowed and uses the starting ELO of 800.
