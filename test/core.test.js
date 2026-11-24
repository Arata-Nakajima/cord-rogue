import { test } from "node:test";
import assert from "node:assert/strict";
import { createUser, isMeasurementExpired } from "../src/user.js";
import { calculateMV, normalizeHappiness } from "../src/mv.js";
import { rankMatches, pairKey } from "../src/matching.js";
import { applyNoShow, applyReschedule, applyViolation, applyYearlyRenewal } from "../src/penalty.js";

const base = { gas: 80, happiness: 60, gasCutoff: 50 };

test("MV = 0.5*GAS + 0.5*normalised happiness - penalty", () => {
  assert.equal(normalizeHappiness(60), 80);
  assert.equal(calculateMV(createUser(base)), 80);
  assert.equal(calculateMV(createUser({ ...base, penalty: 2 })), 78);
});

test("matching sorts by MV closeness and applies mutual GAS cutoff", () => {
  const me = createUser({ ...base, id: "me" });
  const near = createUser({ ...base, id: "near", gas: 78 });
  const far = createUser({ ...base, id: "far", gas: 55, happiness: 40 });
  const blocked = createUser({ ...base, id: "blocked", gasCutoff: 90 }); // my GAS 80 < 90
  const result = rankMatches(me, [far, blocked, near]);
  assert.deepEqual(result.map((r) => r.user.id), ["near", "far"]);
});

test("happiness below cutoff and past pairs are excluded", () => {
  const me = createUser({ ...base, id: "me" });
  const low = createUser({ ...base, id: "low", happiness: 20 });
  const done = createUser({ ...base, id: "done" });
  const result = rankMatches(me, [low, done], { pastPairs: new Set([pairKey("me", "done")]) });
  assert.equal(result.length, 0);
});

test("measurement older than a year expires", () => {
  const old = createUser({ ...base, measuredAt: "2024-01-01T00:00:00.000Z" });
  assert.equal(isMeasurementExpired(old, new Date("2026-01-01T00:00:00.000Z")), true);
});

test("penalty rules: no-show, reschedule, violation, yearly reset", () => {
  const u = createUser(base);
  assert.equal(applyNoShow(u).penalty, 1);
  assert.equal(applyReschedule(u, { minutesBeforeStart: 60, samePartnerRescheduleCount: 1 }).penalty, 0);
  assert.equal(applyReschedule(u, { minutesBeforeStart: 60, samePartnerRescheduleCount: 3 }).penalty, 1);
  assert.equal(applyReschedule(u, { minutesBeforeStart: 10, samePartnerRescheduleCount: 1 }).penalty, 1);
  let v = u;
  v = applyViolation(v); v = applyViolation(v); v = applyViolation(v);
  assert.equal(v.suspended, true);
  assert.equal(applyYearlyRenewal(v).penalty, 0);
});
