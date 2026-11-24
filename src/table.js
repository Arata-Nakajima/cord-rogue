// Replicated user table for serverless P2P sync (gossip model).
//
// Every device holds a full copy of this table. When two devices
// meet (over any transport: internet P2P, nearby radio, QR), they
// exchange entries and merge them. The merge rule is deliberately
// tiny - for each user id, the entry with the newest `updatedAt`
// wins - so every device converges to the same table no matter in
// which order updates arrive (eventual consistency).
//
// This module is transport-independent on purpose: it knows nothing
// about how entries travel. Signing entries (to stop tampering with
// other people's rows) belongs to the transport layer and will use
// a per-device key pair whose public key becomes the user id.
//
// An entry carries only the minimum data matching needs: no photos,
// no face data, no contact details.

import { calculateMV } from "./mv.js";
import { canUseAppointments } from "./user.js";
import { isEligible, pairKey, HAPPINESS_CUTOFF } from "./matching.js";

export const DEFAULT_RADIUS_KM = 30;

/** Build a table entry from a user object plus station coordinates. */
export function entryFromUser(user, { station = null, updatedAt = new Date().toISOString() } = {}) {
  return {
    id: user.id,
    displayName: user.displayName,
    orientation: user.orientation,
    station, // { name, lat, lng } or null when unknown
    gas: user.gas,
    happiness: user.happiness,
    penalty: user.penalty,
    gasCutoff: user.gasCutoff,
    measuredAt: user.measuredAt,
    suspended: user.suspended,
    mv: calculateMV(user),
    updatedAt,
    deleted: false,
  };
}

/** A tombstone marks a user as withdrawn; it still propagates. */
export function tombstone(id, updatedAt = new Date().toISOString()) {
  return { id, updatedAt, deleted: true };
}

/** Entries that represent live users (tombstones removed). */
export function activeEntries(table) {
  return table.filter((e) => !e.deleted);
}

function byIdSorted(entries) {
  return [...entries].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Merge two tables. Newest updatedAt wins per id; on an exact tie a
 * tombstone wins (withdrawal is sticky). Commutative, associative
 * and idempotent, so gossip order never matters.
 */
export function mergeTables(a, b) {
  const map = new Map();
  for (const entry of [...a, ...b]) {
    const prev = map.get(entry.id);
    if (!prev) {
      map.set(entry.id, entry);
    } else if (entry.updatedAt > prev.updatedAt) {
      map.set(entry.id, entry);
    } else if (entry.updatedAt === prev.updatedAt && entry.deleted && !prev.deleted) {
      map.set(entry.id, entry);
    }
  }
  return byIdSorted([...map.values()]);
}

/**
 * Entries in `theirs` that `mine` is missing or holds an older copy
 * of - i.e. the payload worth sending to the owner of `mine`.
 */
export function diffTables(mine, theirs) {
  const myVersion = new Map(mine.map((e) => [e.id, e.updatedAt]));
  return theirs.filter((e) => {
    const v = myVersion.get(e.id);
    return v === undefined || e.updatedAt > v;
  });
}

/** Great-circle distance in kilometres between {lat, lng} points. */
export function distanceKm(a, b) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Live entries whose station is within radiusKm of the centre. */
export function withinRadius(table, center, radiusKm = DEFAULT_RADIUS_KM) {
  return activeEntries(table).filter(
    (e) => e.station && distanceKm(e.station, center) <= radiusKm
  );
}

/**
 * Batch pairing over a whole table (spec: sort by MV and pair from
 * the top). Everyone holding the same table computes the same
 * pairs, which is what makes serverless matching workable.
 *
 * Rules: both sides must pass the shared eligibility checks
 * (happiness cutoff, mutual GAS cutoff, measurement still valid,
 * not suspended - see matching.js), pairs that already had an
 * appointment are skipped, and each user pairs with the
 * highest-MV remaining partner who is mutually eligible.
 * Sorting is MV descending with id as a deterministic tie-break.
 */
export function batchPair(entries, { now = new Date(), happinessCutoff = HAPPINESS_CUTOFF, pastPairs = new Set() } = {}) {
  const pool = activeEntries(entries)
    .filter((e) => canUseAppointments(e, now) && e.happiness >= happinessCutoff)
    .sort((x, y) => y.mv - x.mv || (x.id < y.id ? -1 : 1));
  const used = new Set();
  const pairs = [];
  for (let i = 0; i < pool.length; i++) {
    const me = pool[i];
    if (used.has(me.id)) continue;
    for (let j = i + 1; j < pool.length; j++) {
      const other = pool[j];
      if (used.has(other.id)) continue;
      if (pastPairs.has(pairKey(me.id, other.id))) continue;
      if (!isEligible(me, other, { happinessCutoff, now })) continue;
      pairs.push({ a: me, b: other });
      used.add(me.id);
      used.add(other.id);
      break;
    }
  }
  const unpaired = pool.filter((e) => !used.has(e.id));
  return { pairs, unpaired };
}

/** Batch pairing restricted to users within radiusKm of a station. */
export function pairWithinRadius(table, center, { radiusKm = DEFAULT_RADIUS_KM, ...opts } = {}) {
  return batchPair(withinRadius(table, center, radiusKm), opts);
}
