// Matching rules (spec 2.1 / 3.3).
// - Both users must clear the happiness cutoff, otherwise no matching.
// - GAS cutoff is mutual: each user must clear the other's gasCutoff.
// - A pair that already had an appointment is never matched again.
// - Candidates are sorted by closeness of MV.

import { calculateMV } from "./mv.js";
import { canUseAppointments } from "./user.js";

export const HAPPINESS_CUTOFF = 30; // tentative initial value

export function pairKey(aId, bId) {
  return [aId, bId].sort().join(":");
}

export function isEligible(me, other, { happinessCutoff = HAPPINESS_CUTOFF, now = new Date() } = {}) {
  if (me.id === other.id) return false;
  if (!canUseAppointments(me, now) || !canUseAppointments(other, now)) return false;
  if (me.happiness < happinessCutoff || other.happiness < happinessCutoff) return false;
  if (other.gas < me.gasCutoff) return false;
  if (me.gas < other.gasCutoff) return false;
  return true;
}

/**
 * Rank eligible partners for `me`, closest MV first.
 * pastPairs: Set of pairKey() strings for pairs already appointed.
 */
export function rankMatches(me, candidates, { pastPairs = new Set(), ...opts } = {}) {
  const myMV = calculateMV(me);
  return candidates
    .filter((other) => isEligible(me, other, opts) && !pastPairs.has(pairKey(me.id, other.id)))
    .map((other) => ({ user: other, mv: calculateMV(other), mvDiff: Math.abs(calculateMV(other) - myMV) }))
    .sort((a, b) => a.mvDiff - b.mvDiff);
}
