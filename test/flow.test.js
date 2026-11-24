import { test } from "node:test";
import assert from "node:assert/strict";
import { createUser } from "../src/user.js";
import { scoreHappiness, HAPPINESS_QUESTIONS } from "../src/questionnaire.js";
import { demoUsers } from "../src/demo.js";
import { rankMatches } from "../src/matching.js";
import { calculateMV } from "../src/mv.js";
import {
  createAppointment, markArrived, closeAppointment,
  recordDateConsent, dateAgreed, applyReport, decidePlace, decideTime,
} from "../src/appointment.js";

test("questionnaire scores 0-100", () => {
  const n = HAPPINESS_QUESTIONS.length;
  assert.equal(scoreHappiness(Array(n).fill(5)), 100);
  assert.equal(scoreHappiness(Array(n).fill(1)), 0);
  assert.equal(scoreHappiness(Array(n).fill(3)), 50);
});

test("demo users: low-happiness demo-kai (25) never matches anyone", () => {
  const me = createUser({ id: "me", gas: 80, happiness: 60 });
  const ids = rankMatches(me, demoUsers()).map((r) => r.user.id);
  assert.ok(!ids.includes("demo-kai"));
  assert.ok(ids.length >= 3);
  const mvs = rankMatches(me, demoUsers()).map((r) => r.mvDiff);
  assert.deepEqual(mvs, [...mvs].sort((a, b) => a - b));
});

test("place and time decision picks the closest shared option", () => {
  assert.equal(decidePlace([
    { placeId: "p1", rankByA: 0, rankByB: 2 },
    { placeId: "p2", rankByA: 1, rankByB: 0 },
  ]), "p2");
  assert.equal(decideTime(["2026-12-01T13:00", "2026-12-01T11:00"], ["2026-12-01T11:00"]), "2026-12-01T11:00");
  assert.equal(decideTime(["2026-12-01T13:00"], ["2026-12-01T15:00"]), null);
});

test("full flow: appointment -> both arrive -> consent -> report rules", () => {
  let appt = createAppointment("me", "demo-aya",
    [{ placeId: "place-umeda", rankByA: 0, rankByB: 0 }],
    ["2026-12-01T11:00"], ["2026-12-01T11:00"]);
  assert.equal(appt.status, "decided");
  appt = markArrived(markArrived(appt, "A"), "B");
  assert.equal(closeAppointment(appt).appointment.status, "met");
  appt = recordDateConsent(appt, "A", true);
  appt = recordDateConsent(appt, "B", false);
  assert.equal(dateAgreed(appt), false);
  // B refused; a report by B against A is valid and penalises A
  const target = createUser({ id: "me", gas: 80, happiness: 60 });
  const res = applyReport(appt, "B", target);
  assert.equal(res.applied, true);
  assert.equal(res.user.violationCount, 1);
  // after mutual consent a report is invalid
  let appt2 = recordDateConsent(recordDateConsent(appt, "B", true), "A", true);
  assert.equal(applyReport(appt2, "B", target).applied, false);
});

test("no-show: only the missing side is penalised", () => {
  let appt = createAppointment("me", "demo-ren",
    [{ placeId: "place-namba", rankByA: 0, rankByB: 0 }],
    ["2026-12-01T11:00"], ["2026-12-01T11:00"]);
  appt = markArrived(appt, "A");
  assert.deepEqual(closeAppointment(appt).penalized, ["B"]);
});

test("MV of a demo user is reproducible", () => {
  const aya = demoUsers().find((u) => u.id === "demo-aya");
  assert.equal(calculateMV(aya), 0.5 * 82 + 0.5 * (50 + 64 / 2));
});
