// Tournament accounts are fixed registration identities. An owner-approved
// tournament correction must not rewrite the player's general Hub profile.
export function tournamentIdentity(registration: { riotNameSnapshot: string; riotTagSnapshot: string }) {
  return { name: registration.riotNameSnapshot.trim(), tag: registration.riotTagSnapshot.trim().replace(/^#+/, '') };
}
