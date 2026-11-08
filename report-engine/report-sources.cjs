"use strict";

function hasRecentGames(source) {
  return Array.isArray(source?.games) && source.games.length > 0;
}

async function findFirstRecentGameSource({
  players,
  fetchSource,
  onLookupError = () => {},
}) {
  const candidates = Array.from(players || []);
  let failures = 0;

  for (let playerIndex = 0; playerIndex < candidates.length; playerIndex += 1) {
    try {
      const source = await fetchSource(candidates[playerIndex], playerIndex);
      if (hasRecentGames(source)) {
        return {
          source,
          playerIndex,
          checked: playerIndex + 1,
          failures,
        };
      }
    } catch (error) {
      failures += 1;
      await onLookupError({
        error,
        playerIndex,
        reporter: playerIndex === 0,
      });
    }
  }

  return {
    source: null,
    playerIndex: null,
    checked: candidates.length,
    failures,
  };
}

module.exports = {
  findFirstRecentGameSource,
  hasRecentGames,
};
