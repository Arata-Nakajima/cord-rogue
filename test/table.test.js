import { test } from "node:test";
import assert from "node:assert/strict";
import { createUser } from "../src/user.js";
import { pairKey } from "../src/matching.js";
import {
  entryFromUser, tombstone, activeEntries, mergeTables, diffTables,
  distanceKm, withinRadius, batchPair, pairWithinRadius,
} from "../src/table.js";

const OSAKA = { name: "大阪", lat: 34.7025, lng: 135.4959 };
const TENNOJI = { name: "天王寺", lat: 34.6457, lng: 135.5139 }; // ~6.5 km from Osaka
const KYOTO = { name: "京都", lat: 34.9855, lng: 135.7585 }; // ~40 km from Osaka
const T1 = "2026-11-01T00:00:00.000Z";
const T2 = "2026-11-20T00:00:00.000Z";

function entry(id, overrides = {}, station = OSAKA, updatedAt = T1) {
  const user = createUser({ id, displayName: id, gasCutoff: 50, ...overrides });
  return entryFromUser(user, { station, updatedAt });
}

// MV reference: mv = 0.5*gas + 0.5*(50 + happiness/2) - penalty
const A = () => entry("a", { gas: 90, happiness: 80 }); // mv 90
const B = () => entry("b", { gas: 85, happiness: 80 }); // mv 87.5
const C = () => entry("c", { gas: 70, happiness: 60 }); // mv 75
const D = () => entry("d", { gas: 60, happiness: 60 }); // mv 70

test("merge keeps the newest entry per user and is order-independent", () => {
  const oldA = A();
  const newA = { ...A(), gas: 95, updatedAt: T2 };
  const b = B();
  const c = C();
  const left = mergeTables([oldA, b], [newA, c]);
  const right = mergeTables([newA, c], [oldA, b]);
  assert.deepEqual(left, right);
  assert.equal(left.find((e) => e.id === "a").gas, 95);
  assert.deepEqual(mergeTables(left, left), left); // idempotent
});

test("tombstones propagate and remove the user from the active set", () => {
  const merged = mergeTables([A(), B()], [tombstone("a", T2)]);
  assert.deepEqual(activeEntries(merged).map((e) => e.id), ["b"]);
});

test("diff returns only entries the other side is missing or holds older", () => {
  const mine = [A(), B()];
  const theirs = [{ ...A(), gas: 95, updatedAt: T2 }, B(), C()];
  const diff = diffTables(mine, theirs);
  assert.deepEqual(diff.map((e) => e.id), ["a", "c"]);
});

test("radius filter keeps nearby stations and drops far ones", () => {
  assert.ok(distanceKm(OSAKA, TENNOJI) < 10);
  assert.ok(distanceKm(OSAKA, KYOTO) > 30);
  const table = [A(), entry("e", { gas: 80, happiness: 80 }, TENNOJI), entry("f", { gas: 80, happiness: 80 }, KYOTO)];
  const near = withinRadius(table, OSAKA, 30);
  assert.deepEqual(near.map((e) => e.id), ["a", "e"]);
});

test("batch pairing pairs from the highest MV down", () => {
  const { pairs, unpaired } = batchPair([D(), B(), A(), C()]); // shuffled input
  assert.deepEqual(pairs.map((p) => [p.a.id, p.b.id]), [["a", "b"], ["c", "d"]]);
  assert.equal(unpaired.length, 0);
});

test("batch pairing skips a partner who fails the mutual GAS cutoff", () => {
  const x = entry("x", { gas: 90, happiness: 80, gasCutoff: 80 }); // mv 90, wants gas>=80
  const y = entry("y", { gas: 70, happiness: 100 }); // mv 85, gas too low for x
  const z = entry("z", { gas: 82, happiness: 60 }); // mv 81, eligible for x
  const { pairs, unpaired } = batchPair([x, y, z]);
  assert.deepEqual(pairs.map((p) => [p.a.id, p.b.id]), [["x", "z"]]);
  assert.deepEqual(unpaired.map((e) => e.id), ["y"]);
});

test("batch pairing excludes low happiness and past pairs", () => {
  const low = entry("low", { gas: 99, happiness: 20 }); // below cutoff 30
  const { pairs } = batchPair([A(), B(), low]);
  assert.deepEqual(pairs.map((p) => [p.a.id, p.b.id]), [["a", "b"]]);

  const past = new Set([pairKey("a", "b")]);
  const again = batchPair([A(), B(), C(), D()], { pastPairs: past });
  assert.ok(!again.pairs.some((p) => pairKey(p.a.id, p.b.id) === pairKey("a", "b")));
});

test("pairWithinRadius only pairs users near the centre station", () => {
  const far = entry("far", { gas: 99, happiness: 100 }, KYOTO); // highest MV but too far
  const { pairs, unpaired } = pairWithinRadius([A(), B(), far], OSAKA, { radiusKm: 30 });
  assert.deepEqual(pairs.map((p) => [p.a.id, p.b.id]), [["a", "b"]]);
  assert.equal(unpaired.length, 0);
});
